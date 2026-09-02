/**
 * Aralıklı tekrar (SRS) çekirdeği.
 *
 * Saf fonksiyonlar: DOM'a, localStorage'a veya global duruma dokunmaz.
 * Bu sayede birim testleriyle doğrulanabilir (test/srs.test.js).
 *
 * Not: Bu, SM-2'nin basitleştirilmiş bir hâli. Faz 3'te ease factor'lü
 * gerçek bir algoritmaya (FSRS) geçilecek; arayüz aynı kalacak şekilde
 * tasarlandı.
 */
import { addDays, todayISO } from './time.js';

/** Seviye başına tekrar aralığı (gün). */
export const INTERVALS = [1, 2, 4, 7, 15, 30, 60];

/** En üst seviye = "öğrenilmiş" sayılan seviye. */
export const MAX_LEVEL = INTERVALS.length - 1;

/** Otomatik "öğrenilmiş" için gereken üst üste doğru sayısı. */
export const LEARNED_STREAK = 5;

/**
 * Verilen seviye için bir sonraki tekrar tarihi.
 * @param {number} level
 * @param {string} [from] Referans tarih (test edilebilirlik için)
 * @returns {string}
 */
export function scheduleNext(level, from = todayISO()) {
	const safeLevel = Math.max(0, Math.min(level, MAX_LEVEL));
	return addDays(from, INTERVALS[safeLevel]);
}

/**
 * Geçmişin sonundan geriye doğru kesintisiz doğru cevap sayısı.
 *
 * Önemli: toplam doğru sayısı DEĞİL. Aradaki bir yanlış seriyi sıfırlar.
 * (Eski sürüm toplamı sayıyordu; bu yüzden çok yanlış yapılan kelimeler
 *  de "öğrenilmiş" sayılıyordu.)
 *
 * @param {{history?: Array<{known?: boolean}>}} word
 * @returns {number}
 */
export function correctStreak(word) {
	const h = Array.isArray(word && word.history) ? word.history : [];
	let streak = 0;
	for (let i = h.length - 1; i >= 0; i--) {
		if (h[i] && h[i].known) streak++;
		else break;
	}
	return streak;
}

/** Kelime öğrenilmiş sayılıyor mu? */
export function isLearned(word) {
	return (word && word.level) >= MAX_LEVEL;
}

/**
 * Bir cevabın sonucunu kelimeye uygular ve YENİ bir kelime nesnesi döner.
 * Girdiyi değiştirmez.
 *
 * @param {object} word
 * @param {boolean} known Doğru bilindi mi?
 * @param {string} [now] Referans tarih (test edilebilirlik için)
 * @returns {object} Güncellenmiş kelime
 */
export function applyResult(word, known, now = todayISO()) {
	const history = Array.isArray(word.history) ? word.history.slice() : [];
	history.push({ date: now, known: !!known });

	const next = {
		...word,
		history,
		level: known ? Math.min((word.level || 0) + 1, MAX_LEVEL) : 0
	};

	// Üst üste yeterince doğru bilindiyse öğrenilmiş say.
	if (correctStreak(next) >= LEARNED_STREAK) {
		next.level = MAX_LEVEL;
	}

	next.nextReviewAt = scheduleNext(next.level, now);
	return next;
}

/** Günlük oturumda tanıştırılacak varsayılan yeni kelime sayısı. */
export const DEFAULT_NEW_LIMIT = 10;

/** Kelime daha önce hiç çalışıldı mı? */
function isFresh(word) {
	return !(word.history && word.history.length);
}

/**
 * Tekrar kuyruğunu oluşturur.
 *
 * İKİ AYRI AKIŞ birleştiriliyor:
 *
 *  1. TEKRARLAR — daha önce çalışılmış ve zamanı gelmiş kelimeler,
 *     en çok gecikmiş olan başta. Bunlar sınırsız: biriken tekrarı
 *     temizlemek yeni kelime öğrenmekten önceliklidir, yoksa unutma
 *     hızı öğrenme hızını geçer.
 *
 *  2. YENİ KELİMELER — hiç çalışılmamışlar, KULLANIM SIKLIĞINA göre.
 *     Bu, müfredat sırasının kendisi: "you", "and", "time" gibi çok
 *     geçen kelimeler "actor", "abandon"dan önce gelir. Sıklık verisi
 *     olmayanlar sona alınır.
 *     Sayıları sınırlı: 5000 kelimelik havuzda sınırsız yeni kelime
 *     vermek, ertesi gün kaldırılamayacak bir tekrar yükü yaratır.
 *
 * free=true (serbest tekrar) bu düzeni atlar: öğrenilmemiş her şeyi
 * rastgele sırayla verir.
 *
 * @param {Array<object>} words
 * @param {{
 *   free?: boolean,
 *   isDue: (iso: string) => boolean,
 *   shuffle?: (a: Array) => Array,
 *   newLimit?: number
 * }} options
 * @returns {Array<object>}
 */
export function buildReviewQueue(words, {
	free = false,
	isDue,
	shuffle = defaultShuffle,
	newLimit = DEFAULT_NEW_LIMIT
}) {
	const unlearned = words.filter((w) => (w.level || 0) < MAX_LEVEL);
	if (free) return shuffle(unlearned.slice());

	const due = unlearned.filter((w) => isDue(w.nextReviewAt));

	const reviews = due
		.filter((w) => !isFresh(w))
		.sort((a, b) => new Date(a.nextReviewAt) - new Date(b.nextReviewAt));

	const fresh = due
		.filter(isFresh)
		.sort((a, b) => {
			// Sıklık sırası düşük olan (daha yaygın kelime) önce gelir.
			// Verisi olmayan sona.
			const ra = a.freqRank || Number.MAX_SAFE_INTEGER;
			const rb = b.freqRank || Number.MAX_SAFE_INTEGER;
			if (ra !== rb) return ra - rb;
			return a.en.localeCompare(b.en, 'en');
		})
		.slice(0, Math.max(0, newLimit));

	return [...reviews, ...fresh];
}

/**
 * Kuyruğa girmeye aday sayıları — arayüzde "kaç kelime var" demek için.
 * buildReviewQueue ile aynı kuralları kullanır.
 */
export function countQueue(words, { isDue, newLimit = DEFAULT_NEW_LIMIT }) {
	const unlearned = words.filter((w) => (w.level || 0) < MAX_LEVEL);
	const due = unlearned.filter((w) => isDue(w.nextReviewAt));
	const reviews = due.filter((w) => !isFresh(w)).length;
	const freshAvailable = due.filter(isFresh).length;
	const fresh = Math.min(freshAvailable, Math.max(0, newLimit));
	return { reviews, fresh, freshAvailable, total: reviews + fresh };
}

/** Fisher-Yates karıştırma. Diziyi yerinde değiştirir ve döner. */
export function defaultShuffle(arr) {
	for (let i = arr.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[arr[i], arr[j]] = [arr[j], arr[i]];
	}
	return arr;
}
