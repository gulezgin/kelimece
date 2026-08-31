/**
 * localStorage (1.0 biçimi) -> IndexedDB (1.2 biçimi) göçü.
 *
 * İki kural:
 *   1. Kullanıcının eski verisi SİLİNMEZ. localStorage olduğu gibi bırakılır;
 *      göç yanlış giderse geri dönülebilecek tek kopya odur.
 *   2. Göç hiçbir ilerlemeyi "düzeltmez". Yanlış hesaplanmış seviyeler
 *      olduğu gibi taşınır; onarım ayrı ve kullanıcının onayına bağlı bir
 *      işlemdir (bkz. analyzeProgress / repairProgress).
 */
import { correctStreak, MAX_LEVEL, scheduleNext } from '../core/srs.js';
import { todayISO } from '../core/time.js';
import { makeId, normalizeDefinition, normalizeProgress } from '../core/word.js';
import { bulkPutMulti, getMeta, setMeta, STORE_PROGRESS, STORE_WORDS } from './idb.js';

const LEGACY_WORDS_KEY = 'word_pool_v1';
const LEGACY_SETTINGS_KEY = 'word_pool_settings_v1';
const MIGRATION_KEY = 'migration';

/** Eşleştirme için kelimeyi sadeleştirir. */
function matchKey(en) {
	return String(en || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Göç daha önce yapıldı mı? */
export async function isMigrated() {
	return !!(await getMeta(MIGRATION_KEY));
}

/** Taşınacak eski veri var mı? */
export function hasLegacyData() {
	try {
		const raw = localStorage.getItem(LEGACY_WORDS_KEY);
		if (!raw) return false;
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) && parsed.length > 0;
	} catch {
		return false;
	}
}

/** Eski biçimdeki kelimeleri okur. */
export function readLegacyWords() {
	try {
		const raw = localStorage.getItem(LEGACY_WORDS_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

/** Eski ayarları okur. */
export function readLegacySettings() {
	try {
		const raw = localStorage.getItem(LEGACY_SETTINGS_KEY);
		return raw ? JSON.parse(raw) : null;
	} catch {
		return null;
	}
}

/**
 * Eski kayıtları tanım + ilerlemeye ayırır ve mümkün olduğunca içerik
 * paketindeki kararlı kimliklerle eşleştirir.
 *
 * Eşleşen kelimeler paket kimliğini alır: paket güncellendiğinde
 * (yazım düzeltmesi, örnek cümle eklenmesi) ilerleme kaybolmaz.
 * Eşleşmeyenler kullanıcının kendi kelimesi olarak korunur.
 *
 * @param {object[]} legacyWords
 * @param {object[]} packDefinitions İçerik paketindeki tanımlar
 */
export function planMigration(legacyWords, packDefinitions = []) {
	// Hem güncel yazım hem eski yazımlar (aliases) üzerinden eşleştir.
	// Paket üreticisi "prosperity, welfare, wealth" kaydını "prosperity"e
	// indirdiğinde, kullanıcının o kelimedeki ilerlemesi eski yazımda
	// duruyor; takma ad olmadan kayıt iki kez oluşuyordu.
	const packByKey = new Map();
	for (const def of packDefinitions) {
		packByKey.set(matchKey(def.en), def);
		for (const alias of def.aliases || []) {
			const key = matchKey(alias);
			if (!packByKey.has(key)) packByKey.set(key, def);
		}
	}

	const definitions = [];
	const progress = [];
	const usedIds = new Set();
	const report = { total: legacyWords.length, matched: 0, userOwned: 0, skipped: 0, collisions: 0 };

	for (const raw of legacyWords) {
		const key = matchKey(raw && raw.en);
		if (!key) {
			report.skipped++;
			continue;
		}

		let packDef = packByKey.get(key);

		// Aynı paket kelimesine iki eski kayıt düşerse (paket üreticisi
		// mükerrerleri birleştirdiği için olur), ikincisi kullanıcının
		// kendi kopyası olarak korunur - ilerlemesi kaybolmasın.
		if (packDef && usedIds.has(packDef.id)) {
			report.collisions++;
			packDef = null;
		}

		const id = packDef ? packDef.id : makeId('user', raw.en);
		usedIds.add(id);

		// Tanım: paket varsa paketinki esas alınır, kullanıcının örnek
		// cümlesi ve etiketleri korunur.
		const base = packDef
			? { ...packDef, id }
			: normalizeDefinition({ ...raw, id, source: 'user' }, { source: 'user' });
		if (!base) {
			report.skipped++;
			continue;
		}

		const def = { ...base };
		if (raw.example && !def.example) def.example = String(raw.example).trim();
		if (Array.isArray(raw.tags) && raw.tags.length) {
			const merged = new Set([...(def.tags || []), ...raw.tags.map((t) => String(t).trim()).filter(Boolean)]);
			def.tags = [...merged];
		}

		definitions.push(def);
		progress.push(normalizeProgress(raw, id));

		if (packDef) report.matched++;
		else report.userOwned++;
	}

	return { definitions, progress, report };
}

/**
 * Göçü uygular. Zaten yapılmışsa hiçbir şey yapmaz.
 *
 * @param {{packDefinitions?: object[]}} [options]
 * @returns {Promise<{migrated: boolean, report?: object}>}
 */
export async function runMigration({ packDefinitions = [] } = {}) {
	if (await isMigrated()) return { migrated: false };
	if (!hasLegacyData()) {
		// Taşınacak veri yok; yine de göç yapıldı olarak işaretle ki her
		// açılışta localStorage taraması yapılmasın.
		await setMeta(MIGRATION_KEY, { from: 'none', at: new Date().toISOString() });
		return { migrated: false };
	}

	const legacy = readLegacyWords();
	const { definitions, progress, report } = planMigration(legacy, packDefinitions);

	await bulkPutMulti({ [STORE_WORDS]: definitions, [STORE_PROGRESS]: progress });

	const settings = readLegacySettings();
	if (settings) await setMeta('settings', settings);

	await setMeta(MIGRATION_KEY, {
		from: 'localStorage-v1',
		at: new Date().toISOString(),
		report
	});

	// localStorage KASITLI olarak silinmiyor: göç sonrası tek yedek o.
	return { migrated: true, report };
}

// ===================== İLERLEME DENETİMİ =====================

/**
 * "Öğrenilmiş" işaretli kelimelerin bu etiketi gerçekten hak edip
 * etmediğini inceler. Hiçbir şeyi değiştirmez — sadece rapor üretir.
 *
 * 1.0'daki hata: otomatik "öğrenilmiş" işareti geçmişteki TOPLAM doğruyu
 * sayıyordu, aradaki yanlışları yok sayıyordu. Ayrıca "Öğrenilmişe al"
 * düğmesi geçmişe hiç bakmadan en üst seviyeye taşıyordu.
 *
 * @param {object[]} records Düz kayıtlar (merge edilmiş)
 */
export function analyzeProgress(records) {
	const learned = records.filter((r) => r.level >= MAX_LEVEL);
	const groups = { earned: [], weak: [], noHistory: [] };

	for (const r of learned) {
		const history = Array.isArray(r.history) ? r.history : [];
		if (!history.length) groups.noHistory.push(r);
		else if (correctStreak(r) >= 5) groups.earned.push(r);
		else groups.weak.push(r);
	}

	return {
		total: records.length,
		learnedCount: learned.length,
		earned: groups.earned.length,
		weak: groups.weak.length,
		noHistory: groups.noHistory.length,
		suspect: groups.weak.length + groups.noHistory.length,
		groups
	};
}

/**
 * Seçilen onarım kipini uygular ve GÜNCELLENMİŞ ilerleme kayıtlarını döner.
 * Girdiyi değiştirmez.
 *
 * Kipler:
 *   'verify' — Kelime "öğrenilmiş" kalır ama bir kez daha sorulur.
 *              Seviye korunur, sadece tekrar tarihi bugüne çekilir.
 *              (Kayıpsız: doğru bilirsen etiketin geri kazanılır.)
 *   'replay' — Geçmiş, düzeltilmiş algoritmayla baştan oynatılır.
 *              Kanıta dayalı gerçek seviyeyi verir.
 *   'reset'  — Şüpheli kelimeler 0. seviyeye döner.
 *
 * @param {object[]} records
 * @param {'verify'|'replay'|'reset'} mode
 * @param {{now?: string}} [options]
 * @returns {{updates: object[], changed: number}}
 */
export function repairProgress(records, mode, { now = todayISO() } = {}) {
	const analysis = analyzeProgress(records);
	const suspect = new Set([...analysis.groups.weak, ...analysis.groups.noHistory].map((r) => r.id));

	const updates = [];
	for (const r of records) {
		if (!suspect.has(r.id)) continue;

		if (mode === 'verify') {
			// Seviye ve geçmiş korunur; sadece bir kez daha karşına çıkar.
			// MAX_LEVEL kelimeler tekrar kuyruğuna girmediği için seviyeyi
			// bir basamak düşürmek gerekiyor - aksi hâlde asla sorulmaz.
			updates.push({
				...toProgress(r),
				level: MAX_LEVEL - 1,
				nextReviewAt: now,
				learnedManually: false
			});
		} else if (mode === 'replay') {
			const level = replayLevel(r.history);
			updates.push({
				...toProgress(r),
				level,
				nextReviewAt: level >= MAX_LEVEL ? scheduleNext(level, now) : now,
				learnedManually: false
			});
		} else if (mode === 'reset') {
			updates.push({ ...toProgress(r), level: 0, nextReviewAt: now, learnedManually: false });
		}
	}

	return { updates, changed: updates.length };
}

/** Düz kayıttan ilerleme parçasını çıkarır. */
function toProgress(r) {
	return {
		wordId: r.id,
		level: r.level,
		nextReviewAt: r.nextReviewAt,
		addedAt: r.addedAt,
		history: Array.isArray(r.history) ? r.history : [],
		learnedManually: !!r.learnedManually
	};
}

/**
 * Geçmişi düzeltilmiş algoritmayla baştan oynatarak gerçek seviyeyi bulur.
 * @param {Array<{known?: boolean}>} history
 */
export function replayLevel(history) {
	const h = Array.isArray(history) ? history : [];
	let level = 0;
	let streak = 0;

	for (const entry of h) {
		if (entry && entry.known) {
			level = Math.min(level + 1, MAX_LEVEL);
			streak++;
			if (streak >= 5) level = MAX_LEVEL;
		} else {
			level = 0;
			streak = 0;
		}
	}
	return level;
}
