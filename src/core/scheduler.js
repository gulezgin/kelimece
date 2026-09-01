/**
 * SM-2 tabanlı aralıklı tekrar zamanlayıcısı.
 *
 * 1.0'daki sistem sabit bir merdivendi: her doğru cevap bir basamak
 * yukarı, her yanlış en başa. Bunun iki sorunu vardı:
 *   - Zor kelime ile kolay kelime aynı hızda ilerliyordu.
 *   - Tek yanlış, aylarca süren ilerlemeyi sıfırlıyordu.
 *
 * Bu sürüm her kelimeye bir "kolaylık katsayısı" (ease) tutar. Kolay
 * bulduğun kelimenin aralığı hızla açılır, zorlandığın kelimeninki
 * dar kalır. Yanlış cevap aralığı kısaltır ama katsayıyı tamamen
 * silmez — kelimeyi tamamen unutmadığın varsayılır.
 *
 * Dört seçenekli değerlendirme (Anki'nin de kullandığı model):
 *   again — hiç hatırlamadım
 *   hard  — hatırladım ama zorlandım
 *   good  — hatırladım
 *   easy  — anında hatırladım
 *
 * Saf fonksiyonlar: DOM, depolama ve global duruma dokunmaz.
 */
import { addDays, todayISO } from './time.js';

/** @typedef {'again'|'hard'|'good'|'easy'} Rating */

export const RATINGS = /** @type {Rating[]} */ (['again', 'hard', 'good', 'easy']);

export const EASE_DEFAULT = 2.5;
export const EASE_MIN = 1.3;
export const EASE_MAX = 3.0;

/** Bu aralığa ulaşan kelime "öğrenilmiş" sayılır (gün). */
export const LEARNED_INTERVAL = 60;

/** İlk doğru cevaplardan sonraki sabit aralıklar (gün). */
const FIRST_INTERVAL = 1;
const SECOND_INTERVAL = 3;

/** Değerlendirmeye göre kolaylık katsayısı değişimi. */
const EASE_DELTA = { again: -0.2, hard: -0.15, good: 0, easy: 0.15 };

/** Bir sayıyı verilen aralığa sıkıştırır. */
function clamp(value, min, max) {
	return Math.min(max, Math.max(min, value));
}

/**
 * Kaydın zamanlama alanlarını okur; eksikse eski `level` alanından türetir.
 *
 * 1.0/1.2 verisinde `ease` ve `interval` yok, yalnızca 0-6 arası bir
 * `level` var. Geçiş sırasında veri kaybetmemek için o basamak karşılık
 * gelen aralığa çevriliyor.
 *
 * @param {object} word
 * @returns {{ease: number, interval: number, reps: number, lapses: number}}
 */
export function readSchedule(word) {
	const w = word && typeof word === 'object' ? word : {};
	const legacyIntervals = [1, 2, 4, 7, 15, 30, 60];

	let interval = Number(w.interval);
	if (!Number.isFinite(interval) || interval <= 0) {
		const level = Number(w.level);
		interval = Number.isFinite(level) && level > 0
			? legacyIntervals[Math.min(level, legacyIntervals.length - 1)]
			: 0;
	}

	let ease = Number(w.ease);
	if (!Number.isFinite(ease)) ease = EASE_DEFAULT;

	const history = Array.isArray(w.history) ? w.history : [];
	// Dikkat: alan yoksa geçmişten türet. Number(undefined) NaN olduğu
	// için Number.isFinite kontrolü doğru dalı seçiyor.
	const reps = Number.isFinite(Number(w.reps))
		? Number(w.reps)
		: history.filter((h) => h && h.known).length;
	const lapses = Number.isFinite(Number(w.lapses))
		? Number(w.lapses)
		: history.filter((h) => h && !h.known).length;

	return { ease: clamp(ease, EASE_MIN, EASE_MAX), interval, reps, lapses };
}

/**
 * Bir değerlendirmeyi uygular ve yeni zamanlamayı döner.
 * Girdiyi değiştirmez.
 *
 * @param {object} word
 * @param {Rating} rating
 * @param {{now?: string}} [options]
 * @returns {object} Güncellenmiş kayıt
 */
export function applyRating(word, rating, { now = todayISO() } = {}) {
	if (!RATINGS.includes(rating)) rating = 'good';
	const source = word && typeof word === 'object' ? word : {};

	const { ease, interval, reps, lapses } = readSchedule(source);
	const known = rating !== 'again';

	let nextEase = clamp(ease + EASE_DELTA[rating], EASE_MIN, EASE_MAX);
	let nextInterval;
	let nextReps = reps;
	let nextLapses = lapses;

	if (rating === 'again') {
		// Unutuldu: başa dönme ama aralığı belirgin şekilde kıs.
		// Tamamen sıfırlamak, aylarca çalışılmış bir kelimeyi
		// hiç görülmemiş gibi ele almak olurdu.
		nextInterval = FIRST_INTERVAL;
		nextReps = 0;
		nextLapses = lapses + 1;
	} else if (reps === 0) {
		nextInterval = rating === 'easy' ? 4 : FIRST_INTERVAL;
		nextReps = 1;
	} else if (reps === 1) {
		nextInterval = rating === 'easy' ? 6 : SECOND_INTERVAL;
		nextReps = 2;
	} else {
		const factor = rating === 'hard' ? 1.2 : rating === 'easy' ? nextEase * 1.3 : nextEase;
		nextInterval = Math.max(interval + 1, Math.round(interval * factor));
		nextReps = reps + 1;
	}

	// Aşırı uzun aralıkları sınırla: 1 yıldan öteye planlamak,
	// kelimenin gerçekten kalıcı olduğunu varsaymak demek.
	nextInterval = clamp(nextInterval, 1, 365);

	const history = Array.isArray(source.history) ? source.history.slice() : [];
	history.push({ date: now, known, rating });

	return {
		...source,
		ease: nextEase,
		interval: nextInterval,
		reps: nextReps,
		lapses: nextLapses,
		history,
		nextReviewAt: addDays(now, nextInterval),
		level: levelFor(nextInterval)
	};
}

/**
 * Aralığı 0-6 arası bir basamağa çevirir.
 *
 * Yalnızca gösterim ve eski kodla uyumluluk için: "Seviye 4" demek
 * kullanıcıya "60 gün" demekten daha anlaşılır ve mevcut süzgeçler
 * bu alanı kullanıyor.
 */
export function levelFor(interval) {
	const steps = [1, 2, 4, 7, 15, 30, LEARNED_INTERVAL];
	let level = 0;
	for (let i = 0; i < steps.length; i++) {
		if (interval >= steps[i]) level = i;
	}
	return level;
}

/** Kelime öğrenilmiş sayılıyor mu? */
export function isLearned(word) {
	return readSchedule(word).interval >= LEARNED_INTERVAL;
}

/**
 * Her seçeneğin kullanıcıya gösterilecek aralığını hesaplar.
 * "İyi dersem 12 gün sonra" bilgisi kararı somutlaştırıyor.
 *
 * @param {object} word
 * @returns {Record<Rating, number>} Değerlendirme -> gün
 */
export function previewIntervals(word) {
	const out = /** @type {any} */ ({});
	for (const rating of RATINGS) {
		out[rating] = applyRating(word, rating).interval;
	}
	return out;
}

/** Gün sayısını okunur bir etikete çevirir. */
export function formatInterval(days) {
	if (days < 1) return 'bugün';
	if (days === 1) return '1 gün';
	if (days < 30) return `${days} gün`;
	if (days < 365) {
		const months = Math.round(days / 30);
		return months === 1 ? '1 ay' : `${months} ay`;
	}
	const years = (days / 365).toFixed(1).replace('.0', '');
	return `${years} yıl`;
}
