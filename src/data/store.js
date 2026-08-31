/**
 * Uygulama durumu ve veri işlemleri.
 *
 * Bellekte tek gerçek kaynak `state.words`: tanım + ilerleme birleştirilmiş
 * düz kayıtlar. Arayüz sadece bunu görür. Diske yazarken kayıt ikiye
 * ayrılır (words / progress depoları), böylece içerik paketi güncellenebilir
 * ve kullanıcının ilerlemesi kaybolmaz.
 *
 * Filtreleme ve sıralama bellekte yapılır — 10 bin kelimede bile birkaç MB,
 * bu yüzden IndexedDB'de indeksli sorguya gerek yok.
 */
import { applyResult, MAX_LEVEL, scheduleNext } from '../core/srs.js';
import { isSameDay, todayISO } from '../core/time.js';
import {
	createDefinition,
	createProgress,
	merge,
	normalizeDefinition,
	normalizeProgress,
	normalizeWord
} from '../core/word.js';
import {
	bulkPut,
	bulkPutMulti,
	bulkRemove,
	clearAll,
	getAll,
	getMeta,
	isSupported,
	setMeta,
	STORE_PROGRESS,
	STORE_WORDS
} from './idb.js';
import { analyzeProgress, repairProgress, runMigration } from './migrate.js';

export const DEFAULT_SETTINGS = {
	dailyGoal: 10,
	todayAdded: 0,
	today: null
};

/** @type {{words: object[], settings: object, ready: boolean, packs: object}} */
export const state = {
	words: [],
	settings: { ...DEFAULT_SETTINGS, today: todayISO() },
	ready: false,
	packs: {}
};

/** Hızlı arama için kimlik -> kayıt eşlemesi. */
let byId = new Map();

/** @type {Set<Function>} */
const listeners = new Set();

export function subscribe(fn) {
	listeners.add(fn);
	return () => listeners.delete(fn);
}

function emit() {
	for (const fn of listeners) fn(state);
}

let onStorageError = null;
export function setStorageErrorHandler(fn) {
	onStorageError = fn;
}

function reportError(e, context) {
	const message =
		e && e.name === 'QuotaExceededError'
			? 'Cihaz depolama alanı doldu. Lütfen JSON yedeği alın.'
			: `Kayıt başarısız (${context}): ${(e && e.message) || 'bilinmeyen hata'}`;
	if (onStorageError) onStorageError(message);
	else console.error(context, e);
}

function reindex() {
	byId = new Map(state.words.map((w) => [w.id, w]));
}

/** Düz kayıttan ilerleme parçasını ayırır. */
function toProgress(w) {
	return {
		wordId: w.id,
		level: w.level,
		nextReviewAt: w.nextReviewAt,
		addedAt: w.addedAt,
		history: w.history,
		learnedManually: !!w.learnedManually
	};
}

/** Düz kayıttan tanım parçasını ayırır. */
function toDefinition(w) {
	const { level, nextReviewAt, addedAt, history, learnedManually, ...definition } = w;
	return definition;
}

/** Tek kaydın ilerlemesini diske yazar. */
async function persistProgress(word) {
	try {
		await bulkPut(STORE_PROGRESS, [toProgress(word)]);
	} catch (e) {
		reportError(e, 'ilerleme');
	}
}

async function persistSettings() {
	try {
		await setMeta('settings', state.settings);
	} catch (e) {
		reportError(e, 'ayarlar');
	}
}

// ===================== Yaşam döngüsü =====================

/**
 * Veriyi yükler. Sırayla:
 *   1. localStorage'daki 1.0 verisini IndexedDB'ye taşı (bir kez)
 *   2. İçerik paketi kuruluysa atla, değilse kur
 *   3. Tanım + ilerlemeyi belleğe al
 *
 * @param {{packUrl?: string}} [options]
 */
export async function init({ packUrl } = {}) {
	if (!isSupported()) {
		reportError(new Error('IndexedDB kullanılamıyor'), 'başlangıç');
		state.ready = true;
		emit();
		return { ok: false };
	}

	const result = { migrated: false, packInstalled: false };

	try {
		// İçerik paketini önce oku: göç sırasında kararlı kimlik eşleştirmesi
		// için paketteki tanımlara ihtiyaç var.
		const pack = packUrl ? await fetchPack(packUrl) : null;

		const migration = await runMigration({ packDefinitions: pack ? pack.words : [] });
		result.migrated = migration.migrated;
		result.migrationReport = migration.report;

		if (pack) result.packInstalled = await installPackIfNeeded(pack);

		await loadIntoMemory();
		result.repair = await runAutoRepairOnce();

		state.settings = { ...DEFAULT_SETTINGS, ...((await getMeta('settings')) || {}) };
		if (!state.settings.today) state.settings.today = todayISO();
		if (!isSameDay(state.settings.today, new Date())) {
			state.settings.today = todayISO();
			state.settings.todayAdded = 0;
			await persistSettings();
		}
	} catch (e) {
		reportError(e, 'başlangıç');
	}

	state.ready = true;
	emit();
	return { ok: true, ...result };
}

async function fetchPack(url) {
	try {
		const res = await fetch(url, { cache: 'no-store' });
		if (!res.ok) return null;
		const data = await res.json();
		if (!data || !Array.isArray(data.words)) return null;
		const source = (data.pack && data.pack.id) || 'core';
		return {
			meta: data.pack || { id: source, version: 1 },
			words: data.words.map((w) => normalizeDefinition(w, { source })).filter(Boolean)
		};
	} catch {
		return null;
	}
}

/**
 * Paketi kurar veya yeni sürümü uygular.
 *
 * Sürüm yükseltmede tanımlar güncellenir, ilerleme dokunulmadan kalır —
 * kimlikler kararlı olduğu için eşleşme kendiliğinden korunur.
 */
async function installPackIfNeeded(pack) {
	const packs = (await getMeta('packs')) || {};
	const installed = packs[pack.meta.id];
	if (installed && installed.version >= (pack.meta.version || 1)) {
		state.packs = packs;
		return false;
	}

	const now = todayISO();
	const existingProgress = new Set((await getAll(STORE_PROGRESS)).map((p) => p.wordId));

	// İlk kurulumda her kelimeye sıfır ilerleme yazılır; böylece "ne zaman
	// havuza girdi" bilgisi kaybolmaz ve istatistikler tutarlı olur.
	const newProgress = pack.words
		.filter((d) => !existingProgress.has(d.id))
		.map((d) => createProgress(d.id, { now }));

	await bulkPutMulti({ [STORE_WORDS]: pack.words, [STORE_PROGRESS]: newProgress });

	packs[pack.meta.id] = {
		version: pack.meta.version || 1,
		installedAt: new Date().toISOString(),
		wordCount: pack.words.length
	};
	await setMeta('packs', packs);
	state.packs = packs;
	return true;
}

/**
 * 1.0'dan gelen hatali "ogrenilmis" isaretlerini bir kez onarir.
 *
 * 1.0'da iki kusur vardi: otomatik "ogrenilmis" isareti gecmisteki TOPLAM
 * dogruyu sayiyordu (aradaki yanlislari yok sayarak), ve "Ogrenilmise al"
 * dugmesi gecmise hic bakmadan en ust seviyeye tasiyordu. Sonuc: ogrenilmis
 * isaretli kelimelerin buyuk cogunlugu bu etiketi hak etmiyor ve ogrenilmis
 * kelimeler tekrar kuyruguna hic girmedigi icin bir daha sorulmuyor.
 *
 * 'verify' kipi kayipsizdir: gecmis aynen korunur, kelime yalnizca bir kez
 * daha sorulacak seviyeye alinir. Dogru bilinirse etiket geri kazanilir.
 *
 * Yalnizca bir kez calisir. Kullanici sonradan Ayarlar > Ilerleme
 * denetimi'nden diger kipleri secebilir.
 */
async function runAutoRepairOnce() {
	if (await getMeta('autoRepair')) return null;

	const analysis = analyzeProgress(state.words);
	if (!analysis.suspect) {
		await setMeta('autoRepair', { mode: 'none', at: new Date().toISOString(), changed: 0 });
		return null;
	}

	const { changed } = await applyRepair('verify');
	await setMeta('autoRepair', { mode: 'verify', at: new Date().toISOString(), changed });
	return { mode: 'verify', changed, analysis: {
		learnedCount: analysis.learnedCount,
		earned: analysis.earned,
		weak: analysis.weak,
		noHistory: analysis.noHistory
	} };
}

async function loadIntoMemory() {
	const [definitions, progressRows] = await Promise.all([getAll(STORE_WORDS), getAll(STORE_PROGRESS)]);
	const progressById = new Map(progressRows.map((p) => [p.wordId, p]));

	state.words = definitions.map((d) => merge(d, progressById.get(d.id)));
	// En son eklenen üstte görünsün
	state.words.sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
	reindex();
}

// ===================== Kelime işlemleri =====================

export function hasWord(en) {
	const key = String(en || '').trim().toLowerCase();
	if (!key) return false;
	return state.words.some((w) => w.en.toLowerCase() === key);
}

export function getWord(id) {
	return byId.get(id);
}

/**
 * Yeni kullanıcı kelimesi ekler.
 * @param {{en: string, tr: string, example?: string, tags?: string}} input
 */
export async function addWord(input) {
	const definition = createDefinition(input);
	if (!definition) return { ok: false, reason: 'invalid' };
	if (hasWord(definition.en)) return { ok: false, reason: 'duplicate' };

	const progress = createProgress(definition.id);
	const record = merge(definition, progress);

	state.words.unshift(record);
	byId.set(record.id, record);
	state.settings.todayAdded += 1;
	emit();

	try {
		await bulkPutMulti({ [STORE_WORDS]: [definition], [STORE_PROGRESS]: [progress] });
		await persistSettings();
	} catch (e) {
		reportError(e, 'kelime ekleme');
	}
	return { ok: true, word: record };
}

/** Bir cevabı kaydeder ve tekrar takvimini günceller. */
export async function markResult(id, known) {
	const current = byId.get(id);
	if (!current) return null;

	const updated = { ...current, ...pickProgress(applyResult(current, known)) };
	replaceInMemory(updated);
	emit();
	await persistProgress(updated);
	return updated;
}

/** applyResult tüm kaydı döner; sadece ilerleme alanlarını al. */
function pickProgress(result) {
	return {
		level: result.level,
		nextReviewAt: result.nextReviewAt,
		history: result.history
	};
}

function replaceInMemory(updated) {
	const index = state.words.findIndex((w) => w.id === updated.id);
	if (index !== -1) state.words[index] = updated;
	byId.set(updated.id, updated);
}

/** Kelimeyi elle "öğrenilmiş" seviyesine taşır. */
export async function markLearned(id) {
	const current = byId.get(id);
	if (!current) return;
	const updated = {
		...current,
		level: MAX_LEVEL,
		nextReviewAt: scheduleNext(MAX_LEVEL),
		learnedManually: true
	};
	replaceInMemory(updated);
	emit();
	await persistProgress(updated);
}

export async function deleteWord(id) {
	const before = state.words.length;
	state.words = state.words.filter((w) => w.id !== id);
	if (state.words.length === before) return false;
	byId.delete(id);
	emit();

	try {
		await Promise.all([bulkRemove(STORE_WORDS, [id]), bulkRemove(STORE_PROGRESS, [id])]);
	} catch (e) {
		reportError(e, 'silme');
	}
	return true;
}

// ===================== Ayarlar =====================

export async function setDailyGoal(value) {
	const v = Number.parseInt(value, 10);
	state.settings.dailyGoal = Math.max(1, Math.min(1000, Number.isFinite(v) ? v : 10));
	emit();
	await persistSettings();
}

export async function resetTodayCounter() {
	state.settings.today = todayISO();
	state.settings.todayAdded = 0;
	emit();
	await persistSettings();
}

/** Tüm veriyi siler. Paket bir sonraki açılışta yeniden kurulur. */
export async function wipeAll() {
	state.words = [];
	byId.clear();
	state.settings = { ...DEFAULT_SETTINGS, today: todayISO() };
	state.packs = {};
	emit();
	try {
		await clearAll();
	} catch (e) {
		reportError(e, 'tüm veriyi silme');
	}
}

// ===================== İçe / dışa aktarma =====================

/**
 * Yedek dosyasını mevcut havuzla birleştirir.
 *
 * Aynı kelime zaten varsa: tanım korunur, ancak gelen İLERLEME daha
 * ileriyse alınır. Böylece başka cihazdaki çalışma kaybolmaz.
 *
 * @param {unknown} data
 */
export async function mergeImported(data) {
	if (!data || !Array.isArray(/** @type {any} */ (data).words)) {
		throw new Error('Geçersiz dosya: "words" dizisi bulunamadı.');
	}

	const incoming = /** @type {any} */ (data).words;
	const byKey = new Map(state.words.map((w) => [w.en.toLowerCase(), w]));

	const newDefinitions = [];
	const newProgress = [];
	let added = 0;
	let updated = 0;
	let skipped = 0;

	for (const raw of incoming) {
		const record = normalizeWord(raw, { source: 'user' });
		if (!record) {
			skipped++;
			continue;
		}

		const existing = byKey.get(record.en.toLowerCase());
		if (existing) {
			// Gelen kayıt daha çok çalışılmışsa ilerlemesini al.
			if ((record.history || []).length > (existing.history || []).length) {
				const merged = { ...existing, ...pickProgress(record), learnedManually: record.learnedManually };
				replaceInMemory(merged);
				newProgress.push(toProgress(merged));
				updated++;
			} else {
				skipped++;
			}
			continue;
		}

		state.words.unshift(record);
		byId.set(record.id, record);
		byKey.set(record.en.toLowerCase(), record);
		newDefinitions.push(toDefinition(record));
		newProgress.push(toProgress(record));
		added++;
	}

	const goal = /** @type {any} */ (data).settings?.dailyGoal;
	if (goal) state.settings.dailyGoal = goal;

	emit();
	try {
		await bulkPutMulti({ [STORE_WORDS]: newDefinitions, [STORE_PROGRESS]: newProgress });
		await persistSettings();
	} catch (e) {
		reportError(e, 'içe aktarma');
	}
	return { added, updated, skipped };
}

/** Yedek dosyasının içeriği. Tanım + ilerleme birlikte dışa aktarılır. */
export function exportPayload() {
	return {
		version: 2,
		words: state.words,
		settings: state.settings,
		packs: state.packs,
		exportedAt: new Date().toISOString()
	};
}

// ===================== İlerleme onarımı =====================

/** "Öğrenilmiş" etiketinin hak edilip edilmediğini inceler. Değiştirmez. */
export function inspectProgress() {
	return analyzeProgress(state.words);
}

/**
 * Seçilen onarımı uygular.
 * @param {'verify'|'replay'|'reset'} mode
 */
export async function applyRepair(mode) {
	const { updates, changed } = repairProgress(state.words, mode);
	if (!changed) return { changed: 0 };

	for (const p of updates) {
		const current = byId.get(p.wordId);
		if (!current) continue;
		replaceInMemory({
			...current,
			level: p.level,
			nextReviewAt: p.nextReviewAt,
			history: p.history,
			learnedManually: p.learnedManually
		});
	}

	emit();
	try {
		await bulkPut(STORE_PROGRESS, updates);
		await setMeta('repair', { mode, at: new Date().toISOString(), changed });
	} catch (e) {
		reportError(e, 'ilerleme onarımı');
	}
	return { changed };
}

// ===================== Türetilmiş sayılar =====================

/**
 * Üst rozetlerdeki sayılar.
 *
 * @param {(iso: string) => boolean} isDue
 * @param {object[]} [scope] Yalnızca bu kelimeleri say (seviye süzgeci için).
 *   Verilmezse tüm havuz.
 */
export function getStats(isDue, scope) {
	const words = Array.isArray(scope) ? scope : state.words;
	const total = words.length;
	let due = 0;
	let learned = 0;
	let addedToday = 0;
	const now = new Date();

	for (const w of words) {
		if (w.level >= MAX_LEVEL) learned++;
		else if (isDue(w.nextReviewAt)) due++;
		// Sadece kullanıcının kendi eklediklerini say; paket kurulumu
		// "bugün 1658 kelime ekledin" demek olmasın.
		if (w.source === 'user' && isSameDay(w.addedAt, now)) addedToday++;
	}

	return { total, due, learned, addedToday, unlearned: total - learned };
}
