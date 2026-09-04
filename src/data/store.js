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
import { NO_ACCOUNT } from '../core/account.js';
import { DEFAULT_PLAN_PREFS } from '../core/plan.js';
import { isStruggling } from '../core/stats.js';
import { isWorthSyncing } from '../core/sync.js';
import { accessibleWords, grantPremium, isPremiumActive, NO_PREMIUM } from '../core/entitlements.js';
import { applyRating } from '../core/scheduler.js';
import { applyResult, MAX_LEVEL, scheduleNext } from '../core/srs.js';
import { isSameDay, todayISO } from '../core/time.js';
import {
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
	today: null,
	/** Seslendirme hızı: 0.75 yavaş, 1.0 normal, 1.25 hızlı. */
	speechRate: 0.9,
	/** Seçili İngilizce aksan (ör. 'en-GB'). Boş = cihazın seçimi. */
	accent: ''
};

/**
 * Kullanıcı profili: hedef seviye ve çalışma alışkanlığı.
 * İçerikten ve ilerlemeden ayrı tutuluyor — ikisi de kelime bazlı,
 * bu ise kullanıcı bazlı.
 */
export const DEFAULT_PROFILE = {
	/** Seviye belirleme testinin ya da elle seçimin sonucu. */
	level: null,
	placedAt: null,
	/** Üst üste çalışılan gün sayısı. */
	streak: 0,
	longestStreak: 0,
	/** Son çalışılan günün ISO tarihi. */
	lastStudyDate: null,
	/** Bugün verilen cevap sayısı. */
	studiedToday: 0,
	/** Günlük hatırlatma. Varsayılan kapalı — izin istemeden açılmaz. */
	reminder: { enabled: false, hour: 20, minute: 0 },
	/** Abonelik durumu. Satın alma yapılana kadar pasif. */
	premium: { ...NO_PREMIUM },
	/**
	 * Yerel profil (ad, e-posta). Sunucu yok — bu bilgiler cihazda
	 * kalır ve yedek görevi görmez.
	 */
	account: { ...NO_ACCOUNT },
	/** Öğrenme hedefi ve günlük ayrılan süre; günlük planı belirler. */
	goal: DEFAULT_PLAN_PREFS.goal,
	dailyMinutes: DEFAULT_PLAN_PREFS.dailyMinutes,
	/** Hedef soruldu mu? Sorulmadıysa ana ekran soruyor. */
	goalAskedAt: null,
	/** Bugün tamamlanan görevler: { date, ids[] } */
	dailyDone: { date: null, ids: [] },
	/** Quizi geçilmiş dilbilgisi dersleri. */
	lessonsDone: [],
	/** Soruları geçilmiş okuma parçaları. */
	textsDone: [],
	/** Tamamlanmış yazma ve e-posta görevleri. */
	tasksDone: [],
	/**
	 * Kişisel kelime listeleri: [{ id, name, wordIds[], createdAt }].
	 *
	 * Yalnızca kimlik tutuyor, tanım kopyalamıyor — paket güncellenince
	 * listedeki kelime de düzelsin diye.
	 */
	lists: [],
	/**
	 * Yazma taslakları: { [gorevId]: metin }.
	 *
	 * Profilde duruyor çünkü kullanıcı 150 kelime yazıp sekme
	 * değiştirdiğinde metnin kaybolması bu ekranın en can sıkıcı
	 * hatası olurdu.
	 */
	drafts: {}
};

/** @type {{words: object[], settings: object, profile: object, ready: boolean, packs: object}} */
export const state = {
	words: [],
	settings: { ...DEFAULT_SETTINGS, today: todayISO() },
	profile: { ...DEFAULT_PROFILE },
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
		learnedManually: !!w.learnedManually,
		ease: w.ease,
		interval: w.interval,
		reps: w.reps,
		lapses: w.lapses
	};
}

/** Düz kayıttan tanım parçasını ayırır. */
function toDefinition(w) {
	const {
		level, nextReviewAt, addedAt, history, learnedManually,
		ease, interval, reps, lapses,
		...definition
	} = w;
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

async function persistProfile() {
	try {
		await setMeta('profile', state.profile);
	} catch (e) {
		reportError(e, 'profil');
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

		const savedProfile = (await getMeta('profile')) || {};
		state.profile = {
			...DEFAULT_PROFILE,
			...savedProfile,
			// İç içe nesneler yüzeysel birleştirmede kaybolur
			reminder: { ...DEFAULT_PROFILE.reminder, ...(savedProfile.reminder || {}) },
			premium: { ...NO_PREMIUM, ...(savedProfile.premium || {}) },
			account: { ...NO_ACCOUNT, ...(savedProfile.account || {}) },
			dailyDone: { date: null, ids: [], ...(savedProfile.dailyDone || {}) },
			lessonsDone: savedProfile.lessonsDone || [],
			textsDone: savedProfile.textsDone || [],
			tasksDone: savedProfile.tasksDone || [],
			lists: Array.isArray(savedProfile.lists) ? savedProfile.lists : [],
			drafts: { ...(savedProfile.drafts || {}) }
		};
		refreshStreak();
		state.settings = { ...DEFAULT_SETTINGS, ...((await getMeta('settings')) || {}) };
		if (!state.settings.today) state.settings.today = todayISO();
		if (!isSameDay(state.settings.today, new Date())) {
			state.settings.today = todayISO();
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

export function getWord(id) {
	return byId.get(id);
}

/** Bir cevabı kaydeder ve tekrar takvimini günceller. */
export async function markResult(id, known) {
	// Eski iki düğmeli arayüz için: bildim -> good, unuttum -> again
	return rateWord(id, known ? 'good' : 'again');
}

/**
 * Dört seçenekli değerlendirmeyi uygular (again / hard / good / easy).
 *
 * markResult'ın yerini alır; o da geriye dönük uyumluluk için duruyor
 * ve buraya yönleniyor.
 *
 * @param {string} id
 * @param {'again'|'hard'|'good'|'easy'} rating
 */
export async function rateWord(id, rating) {
	const current = byId.get(id);
	if (!current) return null;

	const updated = applyRating(current, rating);
	replaceInMemory(updated);
	emit();
	await persistProgress(updated);
	await recordStudyActivity();
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

/** Tüm veriyi siler. Paket bir sonraki açılışta yeniden kurulur. */
export async function wipeAll() {
	state.words = [];
	byId.clear();
	state.settings = { ...DEFAULT_SETTINGS, today: todayISO() };
	state.profile = {
		...DEFAULT_PROFILE,
		premium: { ...NO_PREMIUM },
		account: { ...NO_ACCOUNT }
	};
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

// ===================== Bulut eşitleme =====================

/**
 * Buluta gönderilecek ilerleme kayıtları.
 * Dokunulmamış kayıtlar elenir: paket 5276 kayıt kuruyor ve hepsini
 * göndermek kullanıcı başına ~1 MB demek, üstelik bilgi taşımıyor.
 */
export function progressForSync() {
	return state.words.map(toProgress).filter(isWorthSyncing);
}

/**
 * Buluttan gelen ilerlemeyi yerele uygular.
 *
 * Yalnızca ilerleme alanları yazılır; tanım (anlam, örnek cümle,
 * seviye) içerik paketine ait ve bulutta tutulmuyor.
 */
export async function applySyncedProgress(records) {
	const updates = [];
	for (const r of records || []) {
		if (!r || !r.wordId) continue;
		const mevcut = byId.get(r.wordId);
		if (!mevcut) continue;
		const birlesik = {
			...mevcut,
			level: r.level,
			nextReviewAt: r.nextReviewAt,
			history: r.history,
			learnedManually: !!r.learnedManually,
			ease: r.ease,
			interval: r.interval,
			reps: r.reps,
			lapses: r.lapses
		};
		replaceInMemory(birlesik);
		updates.push(toProgress(birlesik));
	}
	if (!updates.length) return { applied: 0 };

	emit();
	try {
		await bulkPut(STORE_PROGRESS, updates);
	} catch (e) {
		reportError(e, 'bulut eşitleme');
	}
	return { applied: updates.length };
}

/** Profilin eşitlenecek bölümünü verir (hesap bilgisi hariç). */
export function profileForSync() {
	const { level, placedAt, streak, longestStreak, lastStudyDate, studiedToday } = state.profile;
	return { level, placedAt, streak, longestStreak, lastStudyDate, studiedToday };
}

/** Buluttan gelen profil alanlarını uygular. */
export async function applySyncedProfile(profile) {
	if (!profile) return;
	state.profile = { ...state.profile, ...profile };
	emit();
	await persistProfile();
}

// ===================== Profil ve çalışma alışkanlığı =====================

/**
 * Seriyi gün değişimine göre tazeler.
 *
 * Bir gün atlanırsa seri sıfırlanır. Bugün ya da dün çalışılmışsa
 * seri korunur — "dün çalıştım, bugün henüz başlamadım" durumunda
 * seriyi düşürmek haksız olur.
 */
function refreshStreak() {
	const last = state.profile.lastStudyDate;
	if (!last) return;

	const now = new Date();
	if (isSameDay(last, now)) return;

	const yesterday = new Date(now);
	yesterday.setDate(yesterday.getDate() - 1);
	if (isSameDay(last, yesterday)) {
		// Seri duruyor ama bugünün sayacı sıfırlanmalı
		state.profile.studiedToday = 0;
		return;
	}

	// Bir günden fazla ara verilmiş
	state.profile.streak = 0;
	state.profile.studiedToday = 0;
}

/** Seviye belirleme testinin sonucunu kaydeder. */
export async function savePlacement(result) {
	state.profile.level = result.level;
	state.profile.placedAt = new Date().toISOString();
	emit();
	await persistProfile();
}

/**
 * Yerel profili kaydeder.
 * createdAt yalnizca ilk kayitta yaziliyor: goruntu kimligi ondan
 * turetiliyor ve her duzenlemede degismemeli.
 */
export async function saveAccount(account) {
	const onceki = state.profile.account || NO_ACCOUNT;
	state.profile.account = {
		...onceki,
		...account,
		createdAt: onceki.createdAt || new Date().toISOString()
	};
	emit();
	await persistProfile();
	return state.profile.account;
}

/**
 * Öğrenme hedefini ve günlük süreyi kaydeder.
 */
export async function savePlanPrefs({ goal, dailyMinutes }) {
	if (goal) state.profile.goal = goal;
	if (dailyMinutes) state.profile.dailyMinutes = Number(dailyMinutes);
	state.profile.goalAskedAt = new Date().toISOString();
	emit();
	await persistProfile();
}

/**
 * Bir günlük görevi tamamlanmış işaretler.
 * Gün değişince liste sıfırlanır; dünün görevleri bugünü etkilemez.
 */
export async function markTaskDone(taskId) {
	const bugun = todayISO();
	const d = state.profile.dailyDone || { date: null, ids: [] };
	const ids = d.date === bugun ? d.ids.slice() : [];
	if (!ids.includes(taskId)) ids.push(taskId);
	state.profile.dailyDone = { date: bugun, ids };
	emit();
	await persistProfile();
}

/**
 * Dilbilgisi dersini tamamlanmış işaretler.
 * Bir kez geçilen ders geçilmiş kalır; tekrar denemek işareti
 * kaldırmaz, çünkü öğrenilen şey geri alınmıyor.
 */
export async function markLessonDone(lessonId) {
	const liste = state.profile.lessonsDone || [];
	if (liste.includes(lessonId)) return;
	state.profile.lessonsDone = [...liste, lessonId];
	emit();
	await persistProfile();
}

/** Okuma parçasını tamamlanmış işaretler. */
export async function markTextDone(textId) {
	const liste = state.profile.textsDone || [];
	if (liste.includes(textId)) return;
	state.profile.textsDone = [...liste, textId];
	emit();
	await persistProfile();
}

/**
 * Yazma / e-posta görevini tamamlanmış işaretler.
 *
 * `markTaskDone` adı GÜNLÜK PLAN görevlerine ait; bu ayrı bir liste.
 * İkisini karıştırmak günlük planı yazma görevleriyle doldururdu.
 */
export async function markWritingDone(taskId) {
	const liste = state.profile.tasksDone || [];
	if (liste.includes(taskId)) return;
	state.profile.tasksDone = [...liste, taskId];
	emit();
	await persistProfile();
}

/**
 * Yazma taslağını saklar.
 *
 * `emit()` çağrılmıyor: taslak her tuş vuruşunda yazılıyor ve her
 * seferinde tüm arayüzü yeniden çizmek yazma alanının odağını ve
 * imleç konumunu kaybettiriyor.
 */
export async function saveDraft(taskId, metin) {
	const d = state.profile.drafts || (state.profile.drafts = {});
	if (d[taskId] === metin) return;
	d[taskId] = metin;
	await persistProfile();
}

/**
 * Kişisel listeleri yazar.
 *
 * `core/lists.js` saf: yeni bir dizi döndürüyor, yerinde değiştirmiyor.
 * Burada yalnızca atama ve kalıcılaştırma var.
 */
export async function saveLists(lists) {
	state.profile.lists = Array.isArray(lists) ? lists : [];
	emit();
	await persistProfile();
}

/** Bugün tamamlanan görev kimlikleri. */
export function todayDoneIds() {
	const d = state.profile.dailyDone;
	return d && d.date === todayISO() ? d.ids : [];
}

/** Yerel profili siler. */
export async function clearAccount() {
	state.profile.account = { ...NO_ACCOUNT };
	emit();
	await persistProfile();
}

/** Abonelik şu an geçerli mi? */
export function hasPremium() {
	return isPremiumActive(state.profile.premium);
}

/** Kullanıcının erişebildiği kelimeler (kilitliler hariç). */
export function unlockedWords() {
	return accessibleWords(state.words, state.profile.premium);
}

/**
 * Satın alma sonrası aboneliği kaydeder.
 * @param {string} product
 */
export async function activatePremium(product) {
	state.profile.premium = grantPremium(product);
	emit();
	await persistProfile();
	return state.profile.premium;
}

/** Aboneliği kaldırır (geri yükleme başarısızsa ya da test için). */
export async function clearPremium() {
	state.profile.premium = { ...NO_PREMIUM };
	emit();
	await persistProfile();
}

/** Seslendirme hızını kaydeder. */
export async function setSpeechRate(rate) {
	state.settings.speechRate = Number(rate);
	emit();
	await persistSettings();
}

/** Seçili aksanı kaydeder. */
export async function setAccentSetting(lang) {
	state.settings.accent = String(lang || '');
	emit();
	await persistSettings();
}

/** Günlük hatırlatma ayarını kaydeder. */
export async function setReminder(reminder) {
	state.profile.reminder = { ...state.profile.reminder, ...reminder };
	emit();
	await persistProfile();
	return state.profile.reminder;
}

/** Hedef seviyeyi elle ayarlar. */
export async function setProfileLevel(level) {
	state.profile.level = level;
	emit();
	await persistProfile();
}

/**
 * Bir cevabı çalışma alışkanlığına işler.
 * Seri, günde en az bir cevap verildiğinde ilerler.
 */
async function recordStudyActivity() {
	const now = new Date();
	const last = state.profile.lastStudyDate;

	if (last && isSameDay(last, now)) {
		state.profile.studiedToday++;
	} else {
		const yesterday = new Date(now);
		yesterday.setDate(yesterday.getDate() - 1);
		state.profile.streak = last && isSameDay(last, yesterday) ? state.profile.streak + 1 : 1;
		state.profile.longestStreak = Math.max(state.profile.longestStreak, state.profile.streak);
		state.profile.studiedToday = 1;
		state.profile.lastStudyDate = todayISO();
	}
	await persistProfile();
}

// ===================== Türetilmiş sayılar =====================

/**
 * Ana ekran özeti: seviye ilerlemesi, bugünkü durum, seri.
 *
 * @param {(iso: string) => boolean} isDue
 * @param {string[]} levels Kapsanacak CEFR seviyeleri (boşsa hepsi)
 */
export function getOverview(isDue, levels = []) {
	const scope = levels.length ? state.words.filter((w) => levels.includes(w.cefr)) : state.words;

	let due = 0;
	let learned = 0;
	let inProgress = 0;
	for (const w of scope) {
		if (w.level >= MAX_LEVEL) learned++;
		else {
			if (w.history.length) inProgress++;
			if (isDue(w.nextReviewAt)) due++;
		}
	}

	const total = scope.length;
	return {
		total,
		due,
		learned,
		inProgress,
		untouched: total - learned - inProgress,
		percent: total ? Math.round((learned / total) * 100) : 0,
		streak: state.profile.streak,
		longestStreak: state.profile.longestStreak,
		studiedToday: state.profile.studiedToday,
		dailyGoal: state.settings.dailyGoal,
		level: state.profile.level
	};
}

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
	let hard = 0;

	for (const w of words) {
		if (w.level >= MAX_LEVEL) learned++;
		else if (isDue(w.nextReviewAt)) due++;
		if (isStruggling(w)) hard++;
	}

	return { total, due, learned, hard, unlearned: total - learned };
}
