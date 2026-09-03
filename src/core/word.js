/**
 * Kelime modeli: TANIM ile İLERLEME'nin ayrıldığı yer.
 *
 * Neden ayrı:
 *   Tanım (en, tr, örnek, CEFR seviyesi...) uygulamayla birlikte gelen,
 *   sürümlenen, herkeste aynı olan içeriktir. İlerleme (seviye, tekrar
 *   tarihi, geçmiş) kullanıcıya özeldir.
 *
 *   1.0'da ikisi tek nesnedeydi. Bu yüzden yeni bir kelime paketi
 *   göndermek, kullanıcının ilerlemesini ezmeden mümkün değildi —
 *   A1-C2 müfredatı için önce bu ayrımın yapılması gerekiyordu.
 *
 * Arayüz bu ayrımı görmez: merge() ikisini tek düz nesnede birleştirir,
 * split() kaydederken tekrar ayırır.
 */
import { EASE_DEFAULT, readSchedule } from './scheduler.js';
import { MAX_LEVEL, scheduleNext } from './srs.js';
import { todayISO, toValidISO } from './time.js';

/** Çakışma olasılığı ihmal edilebilir kısa kimlik. */
export function uid() {
	return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * Kimlikte kullanılabilir hâle getirir: "look down on" -> "look-down-on"
 * Kimlikler kararlı olmalı; paket güncellendiğinde ilerlemenin doğru
 * kelimeye bağlı kalması buna dayanıyor.
 */
export function slugify(text) {
	return String(text || '')
		.trim()
		.toLowerCase()
		.replace(/['']/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

/**
 * Kararlı kelime kimliği üretir.
 * Paket kelimeleri: "core:look-down-on" — sürümler arası aynı kalır.
 * Kullanıcı kelimeleri: "user:<rastgele>" — çakışma riski yok.
 */
export function makeId(source, en) {
	if (source === 'user') return 'user:' + uid();
	const slug = slugify(en);
	return slug ? `${source}:${slug}` : `${source}:${uid()}`;
}

/**
 * "verb, academic" -> ["verb", "academic"]
 * @param {string|string[]|unknown} input
 */
export function parseTags(input) {
	const raw = Array.isArray(input) ? input : String(input == null ? '' : input).split(',');
	const seen = new Set();
	const out = [];
	for (const t of raw) {
		const tag = String(t).trim();
		if (!tag) continue;
		const key = tag.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(tag);
	}
	return out;
}

// ===================== TANIM =====================

/**
 * @typedef {object} Definition
 * @property {string} id
 * @property {string} en
 * @property {string} tr
 * @property {string} example
 * @property {string} exampleTr
 * @property {string[]} synonyms   Eş anlamlılar (kart ön yüzünü kalabalıklaştırmaz)
 * @property {string[]} aliases    Bu kaydın eski yazımları (göç/eşleştirme için)
 * @property {string[]} tags
 * @property {string|null} cefr    "A1".."C2" — Faz 2'de dolacak
 * @property {string|null} pos     "noun"|"verb"|"adjective"|...
 * @property {string|null} ipa     Telaffuz
 * @property {string|null} topic   Konu başlığı
 * @property {number|null} freqRank Sıklık sırası (düşük = daha yaygın)
 * @property {string|null} audio   Ses dosyası yolu
 * @property {string} source       Paket kimliği veya "user"
 */

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

/** Geçerli bir CEFR seviyesi mi? Değilse null. */
export function normalizeCefr(value) {
	const v = String(value || '').trim().toUpperCase();
	return CEFR_LEVELS.includes(v) ? v : null;
}

/**
 * Ham veriden tanım üretir. Kurtarılamayan kayıtta null döner.
 * @param {unknown} raw
 * @param {{source?: string}} [options]
 * @returns {Definition|null}
 */
export function normalizeDefinition(raw, { source } = {}) {
	if (!raw || typeof raw !== 'object') return null;
	const r = /** @type {Record<string, any>} */ (raw);

	const en = String(r.en || '').trim();
	const tr = String(r.tr || '').trim();
	if (!en || !tr) return null;

	const src = String(source || r.source || 'user');
	const str = (v) => {
		const s = String(v == null ? '' : v).trim();
		return s || null;
	};

	return {
		id: String(r.id || makeId(src, en)),
		en,
		tr,
		example: String(r.example || '').trim(),
		exampleTr: String(r.exampleTr || '').trim(),
		synonyms: parseTags(r.synonyms),
		// Kaydın önceki yazımları — eski yedekleri doğru kelimeye bağlar
		aliases: parseTags(r.aliases),
		tags: parseTags(r.tags),
		cefr: normalizeCefr(r.cefr),
		pos: str(r.pos),
		ipa: str(r.ipa),
		topic: str(r.topic),
		freqRank: Number.isFinite(Number(r.freqRank)) && r.freqRank !== null ? Number(r.freqRank) : null,
		audio: str(r.audio),
		source: src
	};
}

// ===================== İLERLEME =====================

/**
 * @typedef {object} Progress
 * @property {string} wordId
 * @property {number} level
 * @property {string} nextReviewAt
 * @property {string} addedAt        Kullanıcının havuzuna girdiği an
 * @property {Array<{date: string, known: boolean, rating?: string}>} history
 * @property {boolean} learnedManually "Öğrenilmişe al" ile mi işaretlendi
 * @property {number} ease     Kolaylık katsayısı (SM-2)
 * @property {number} interval Sonraki tekrara kaç gün
 * @property {number} reps     Üst üste doğru cevap sayısı
 * @property {number} lapses   Kaç kez unutuldu
 */

/**
 * Yeni kelime için sıfır ilerleme.
 * nextReviewAt = bugün: yeni kelime hemen çalışılabilir olmalı.
 */
export function createProgress(wordId, { now = todayISO() } = {}) {
	return {
		wordId,
		level: 0,
		nextReviewAt: now,
		addedAt: now,
		history: [],
		learnedManually: false,
		ease: EASE_DEFAULT,
		interval: 0,
		reps: 0,
		lapses: 0
	};
}

/**
 * Ham veriden ilerleme üretir. Bozuk alanları düzeltir.
 * @param {unknown} raw
 * @param {string} [wordId] Kayıtta yoksa kullanılacak kimlik
 * @returns {Progress|null}
 */
export function normalizeProgress(raw, wordId) {
	const r = raw && typeof raw === 'object' ? /** @type {Record<string, any>} */ (raw) : {};
	const id = String(r.wordId || wordId || '');
	if (!id) return null;

	let level = Number.parseInt(r.level, 10);
	if (!Number.isFinite(level) || level < 0) level = 0;
	level = Math.min(level, MAX_LEVEL);

	const addedAt = toValidISO(r.addedAt) || toValidISO(r.createdAt) || todayISO();

	return {
		wordId: id,
		level,
		nextReviewAt: toValidISO(r.nextReviewAt) || scheduleNext(level, addedAt),
		addedAt,
		history: Array.isArray(r.history)
			? r.history
					.filter((h) => h && typeof h === 'object')
					.map((h) => {
						const entry = { date: toValidISO(h.date) || todayISO(), known: !!h.known };
						if (h.rating) entry.rating = String(h.rating);
						return entry;
					})
			: [],
		learnedManually: !!r.learnedManually,
		// Zamanlama alanları yoksa eski `level` alanından türetilir,
		// böylece 1.0/1.2 verisi kayıpsız geçer.
		...(() => {
			const sch = readSchedule(r);
			return { ease: sch.ease, interval: sch.interval, reps: sch.reps, lapses: sch.lapses };
		})()
	};
}

// ===================== BİRLEŞTİR / AYIR =====================

/**
 * Tanım + ilerleme -> arayüzün gördüğü düz kayıt.
 * @param {Definition} definition
 * @param {Progress} [progress]
 */
export function merge(definition, progress) {
	const p = progress || createProgress(definition.id, { now: todayISO() });
	return {
		...definition,
		level: p.level,
		nextReviewAt: p.nextReviewAt,
		addedAt: p.addedAt,
		history: p.history,
		learnedManually: p.learnedManually,
		ease: p.ease,
		interval: p.interval,
		reps: p.reps,
		lapses: p.lapses
	};
}

/**
 * Düz kayıt -> { definition, progress }
 * @param {object} flat
 */
export function split(flat) {
	const definition = normalizeDefinition(flat, { source: flat.source });
	if (!definition) return null;
	definition.id = flat.id || definition.id;
	return { definition, progress: normalizeProgress(flat, definition.id) };
}

/**
 * Dışarıdan gelen tek kaydı (yedek dosyası, eski sürüm) düz kayda çevirir.
 * İçe aktarma yolunun güven sınırı.
 * @returns {object|null}
 */
export function normalizeWord(raw, options = {}) {
	const definition = normalizeDefinition(raw, options);
	if (!definition) return null;
	const progress = normalizeProgress(raw, definition.id);
	return merge(definition, progress);
}

/** Dizi hâlinde normalize eder, kurtarılamayanları atar. */
export function normalizeWords(list, options = {}) {
	if (!Array.isArray(list)) return [];
	return list.map((r) => normalizeWord(r, options)).filter(Boolean);
}
