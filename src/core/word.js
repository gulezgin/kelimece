/**
 * Kelime kaydının şeması, oluşturulması ve doğrulanması.
 *
 * normalizeWord() bu uygulamadaki tek "güven sınırı": localStorage'dan,
 * içe aktarılan dosyadan veya içerik paketinden gelen HER kayıt buradan
 * geçer. Bu sayede eksik/bozuk alanlar arayüzü çökertemez.
 */
import { MAX_LEVEL, scheduleNext } from './srs.js';
import { todayISO, toValidISO } from './time.js';

/** Çakışma olasılığı ihmal edilebilir kısa kimlik. */
export function uid() {
	return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * @typedef {object} Word
 * @property {string} id
 * @property {string} en           İngilizce kelime
 * @property {string} tr           Türkçe karşılık
 * @property {string} example      Örnek cümle (boş olabilir)
 * @property {string[]} tags
 * @property {number} level        SRS seviyesi, 0..MAX_LEVEL
 * @property {string} nextReviewAt ISO tarih
 * @property {string} createdAt    ISO tarih
 * @property {Array<{date: string, known: boolean}>} history
 */

/**
 * Formdan yeni kelime oluşturur.
 * @returns {Word|null} Zorunlu alanlar eksikse null
 */
export function createWord({ en, tr, example = '', tags = '' }) {
	const trimmedEn = String(en || '').trim();
	const trimmedTr = String(tr || '').trim();
	if (!trimmedEn || !trimmedTr) return null;

	return {
		id: uid(),
		en: trimmedEn,
		tr: trimmedTr,
		example: String(example || '').trim(),
		tags: parseTags(tags),
		level: 0,
		// Yeni kelime BUGUN calisilabilir olmali. (Onceden scheduleNext(0)
		// kullaniliyordu; bu, bugun eklenen kelimeyi yarina erteliyor ve
		// "Tekrar Et"e basan kullaniciya "bugun tekrar yok" dedirtiyordu.)
		nextReviewAt: todayISO(),
		createdAt: todayISO(),
		history: []
	};
}

/**
 * "verb, academic" -> ["verb", "academic"]
 * @param {string|string[]} input
 * @returns {string[]}
 */
export function parseTags(input) {
	const raw = Array.isArray(input) ? input : String(input || '').split(',');
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

/**
 * Dışarıdan gelen kaydı güvenli hâle getirir: eksik alanları tamamlar,
 * bozuk değerleri düzeltir, kurtarılamayacak kayıt için null döner.
 *
 * @param {unknown} raw
 * @returns {Word|null}
 */
export function normalizeWord(raw) {
	if (!raw || typeof raw !== 'object') return null;
	const r = /** @type {Record<string, any>} */ (raw);

	const en = String(r.en || '').trim();
	const tr = String(r.tr || '').trim();
	if (!en || !tr) return null;

	let level = Number.parseInt(r.level, 10);
	if (!Number.isFinite(level) || level < 0) level = 0;
	level = Math.min(level, MAX_LEVEL);

	const createdAt = toValidISO(r.createdAt) || todayISO();

	return {
		id: String(r.id || uid()),
		en,
		tr,
		example: String(r.example || '').trim(),
		tags: parseTags(r.tags),
		level,
		nextReviewAt: toValidISO(r.nextReviewAt) || scheduleNext(level, createdAt),
		createdAt,
		history: Array.isArray(r.history)
			? r.history
					.filter((h) => h && typeof h === 'object')
					.map((h) => ({ date: toValidISO(h.date) || todayISO(), known: !!h.known }))
			: []
	};
}

/** Bir kelime dizisini normalize eder, kurtarılamayanları atar. */
export function normalizeWords(list) {
	if (!Array.isArray(list)) return [];
	return list.map(normalizeWord).filter(Boolean);
}
