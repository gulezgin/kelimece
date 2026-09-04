/**
 * İlerleme istatistikleri.
 *
 * Veri zaten toplanıyordu (her cevap `history`'ye yazılıyor, `ease` ve
 * `lapses` tutuluyor) ama hiçbir yerde gösterilmiyordu. Öğrenen kişinin
 * yol aldığını görmesi, devam etmesinin en güçlü nedenlerinden biri.
 *
 * Saf fonksiyonlar: DOM'a ve depolamaya dokunmaz.
 */
import { LEARNED_INTERVAL, readSchedule } from './scheduler.js';

const DAY = 24 * 60 * 60 * 1000;

/** Tarihi gün başlangıcına yuvarlar (yerel saat). */
function dayKey(value) {
	const d = new Date(value);
	if (Number.isNaN(d.getTime())) return null;
	d.setHours(0, 0, 0, 0);
	return d.getTime();
}

/**
 * Son N günün günlük cevap sayısı ve doğruluk oranı.
 *
 * @param {object[]} words
 * @param {{days?: number, now?: Date}} [options]
 * @returns {Array<{date: Date, total: number, correct: number, accuracy: number}>}
 */
export function dailyActivity(words, { days = 30, now = new Date() } = {}) {
	const today = dayKey(now);
	const buckets = new Map();

	for (let i = 0; i < days; i++) {
		buckets.set(today - i * DAY, { total: 0, correct: 0 });
	}

	for (const w of words) {
		for (const entry of w.history || []) {
			// Bozuk kayit gecmise sizabilir (elle duzenlenmis yedek,
			// eski surum); istatistik ekrani bu yuzden cokmemeli.
			if (!entry || typeof entry !== 'object') continue;
			const key = dayKey(entry.date);
			const bucket = key !== null && buckets.get(key);
			if (!bucket) continue;
			bucket.total++;
			if (entry.known) bucket.correct++;
		}
	}

	return [...buckets.entries()]
		.sort((a, b) => a[0] - b[0])
		.map(([time, b]) => ({
			date: new Date(time),
			total: b.total,
			correct: b.correct,
			accuracy: b.total ? b.correct / b.total : 0
		}));
}

/**
 * Genel hatırlama oranı: verilen tüm cevaplarda doğru yüzdesi.
 *
 * @param {object[]} words
 * @param {{sinceDays?: number, now?: Date}} [options]
 */
export function recallRate(words, { sinceDays = null, now = new Date() } = {}) {
	const cutoff = sinceDays ? now.getTime() - sinceDays * DAY : null;
	let total = 0;
	let correct = 0;

	for (const w of words) {
		for (const entry of w.history || []) {
			if (!entry || typeof entry !== 'object') continue;
			if (cutoff) {
				const t = new Date(entry.date).getTime();
				if (Number.isNaN(t) || t < cutoff) continue;
			}
			total++;
			if (entry.known) correct++;
		}
	}

	return { total, correct, rate: total ? correct / total : 0 };
}

/**
 * Kelimeleri öğrenme aşamalarına ayırır.
 *
 * Aşamalar aralığa göre: hiç çalışılmamış / yeni / öğreniliyor /
 * pekişiyor / öğrenilmiş. Ham "kaç kelime var" sayısından çok daha
 * anlamlı bir ilerleme görüntüsü.
 */
export function maturityBreakdown(words) {
	const out = { untouched: 0, learning: 0, young: 0, maturing: 0, learned: 0 };

	for (const w of words) {
		const { interval } = readSchedule(w);
		const touched = (w.history || []).length > 0;

		if (!touched && interval === 0) out.untouched++;
		else if (interval >= LEARNED_INTERVAL) out.learned++;
		else if (interval >= 21) out.maturing++;
		else if (interval >= 7) out.young++;
		else out.learning++;
	}

	out.total = words.length;
	return out;
}

/**
 * En çok zorlanılan kelimeler: çok unutulmuş ya da kolaylık katsayısı
 * düşmüş olanlar. Kullanıcıya "bunlara ekstra bak" demek için.
 *
 * @param {object[]} words
 * @param {{limit?: number}} [options]
 */
/**
 * Kelime "zorlanılan" sayılır mı?
 *
 * Ölçüt unutma sayısı: bir kez bilinip sonra unutulmuş kelime, hiç
 * çalışılmamış kelimeden farklı bir sorun. Hiç denenmemiş kelime zor
 * sayılmaz — zorluk ancak denedikten sonra ölçülebilir.
 */
export function isStruggling(word) {
	const { lapses } = readSchedule(word);
	return lapses > 0 && (word.history || []).length > 0;
}

export function hardestWords(words, { limit = 10 } = {}) {
	return words
		.map((w) => {
			const { lapses, ease } = readSchedule(w);
			const attempts = (w.history || []).length;
			// Zorluk puanı: unutma sayısı ağır basar, düşük kolaylık
			// katsayısı destekler. Hiç çalışılmamış kelime zor sayılmaz.
			const score = attempts ? lapses * 2 + (2.5 - ease) * 3 : -1;
			return { word: w, lapses, ease, attempts, score };
		})
		.filter((r) => r.score > 0 && r.lapses > 0)
		.sort((a, b) => b.score - a.score)
		.slice(0, limit);
}

/**
 * Önümüzdeki günlerde kaç kelimenin tekrar sırası geleceği.
 * Kullanıcı iş yükünü önceden görebilsin.
 *
 * @param {object[]} words
 * @param {{days?: number, now?: Date}} [options]
 */
export function upcomingLoad(words, { days = 14, now = new Date() } = {}) {
	const today = dayKey(now);
	const buckets = new Map();
	for (let i = 0; i < days; i++) buckets.set(today + i * DAY, 0);

	let overdue = 0;
	for (const w of words) {
		const { interval } = readSchedule(w);
		if (interval >= LEARNED_INTERVAL) continue;

		const key = dayKey(w.nextReviewAt);
		if (key === null) continue;
		if (key < today) {
			overdue++;
			continue;
		}
		if (buckets.has(key)) buckets.set(key, buckets.get(key) + 1);
	}

	return {
		overdue,
		days: [...buckets.entries()]
			.sort((a, b) => a[0] - b[0])
			.map(([time, count]) => ({ date: new Date(time), count }))
	};
}

/**
 * Çalışılan farklı gün sayısı ve en uzun seri.
 * Profildeki seri "şu anki" seriyi tutar; bu, geçmişin tamamına bakar.
 */
export function studyHistory(words) {
	const daysWithActivity = new Set();
	for (const w of words) {
		for (const entry of w.history || []) {
			if (!entry || typeof entry !== 'object') continue;
			const key = dayKey(entry.date);
			if (key !== null) daysWithActivity.add(key);
		}
	}

	const sorted = [...daysWithActivity].sort((a, b) => a - b);
	let longest = 0;
	let current = 0;
	let previous = null;

	for (const day of sorted) {
		current = previous !== null && day - previous === DAY ? current + 1 : 1;
		longest = Math.max(longest, current);
		previous = day;
	}

	return {
		activeDays: sorted.length,
		longestStreak: longest,
		firstDay: sorted.length ? new Date(sorted[0]) : null,
		lastDay: sorted.length ? new Date(sorted[sorted.length - 1]) : null
	};
}

/**
 * Tahmini kelime hazinesi: öğrenilmiş + pekişmekte olanların bir kısmı.
 *
 * Kaba bir tahmin ve öyle sunulmalı. "Tam olarak 1.240 kelime biliyorsun"
 * demek yanıltıcı olur; amaç büyüklük sırasını göstermek.
 */
export function estimatedVocabulary(words) {
	const b = maturityBreakdown(words);
	return Math.round(b.learned + b.maturing * 0.7 + b.young * 0.4);
}
