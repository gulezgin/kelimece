/**
 * Okuma parçaları.
 *
 * İki tür var ve ayrımı seviye belirliyor: alt seviyelerde hikâye
 * (somut, olay örgüsü olan), üst seviyelerde makale/deneme (soyut,
 * argüman taşıyan). Bunun sebebi A1 öğrencisinin "dikkat ekonomisi"
 * üzerine bir denemeyi okuyamaması değil yalnızca — okuyabilse bile
 * öğrenmesi gereken şey önce somut anlatı.
 *
 * Metinden sonra anlama soruları var: okuyup geçmek, anladığını
 * göstermek değil.
 *
 * Saf mantık: DOM'a, depoya ve ağa dokunmaz.
 */
import { isLevelUnlocked } from './entitlements.js';

let cache = null;

export async function loadTexts(url) {
	if (cache) return cache;
	try {
		const res = await fetch(url);
		if (!res.ok) throw new Error('HTTP ' + res.status);
		const data = await res.json();
		cache = Array.isArray(data.texts) ? data.texts : [];
	} catch {
		cache = [];
	}
	return cache;
}

export function resetCache() {
	cache = null;
}

/** Parça abonelik olmadan açılabilir mi? */
export function isTextUnlocked(text, premium, now) {
	if (!text) return false;
	return isLevelUnlocked(text.level, premium, now);
}

/** Metnin yaklaşık kelime sayısı ve okuma süresi. */
export function readingStats(text) {
	const words = ((text && text.paragraphs) || []).join(' ').split(/\s+/).filter(Boolean).length;
	// Ikinci dilde okuma hizi ana dilden belirgin yavas; dakikada
	// ~120 kelime gercekci bir tahmin.
	return { words, minutes: Math.max(1, Math.round(words / 120)) };
}

/** Listeleme özeti. */
export function textSummaries(texts, premium, doneIds = [], now) {
	const done = new Set(doneIds);
	return (texts || []).filter(Boolean).map((t) => {
		const s = readingStats(t);
		return {
			id: t.id,
			title: t.title,
			icon: t.icon || '📖',
			level: t.level,
			kind: t.kind === 'story' ? 'Hikâye' : 'Makale',
			summary: t.summary || '',
			words: s.words,
			minutes: s.minutes,
			done: done.has(t.id),
			locked: !isTextUnlocked(t, premium, now)
		};
	});
}

export function findText(texts, id) {
	return (texts || []).find((t) => t && t.id === id) || null;
}

/** Anlama sorularını değerlendirir. */
export function gradeComprehension(text, answers) {
	const sorular = (text && text.questions) || [];
	const detay = sorular.map((q, i) => ({
		question: q.q,
		picked: answers[i],
		correct: q.answer,
		ok: answers[i] === q.answer,
		options: q.options || []
	}));
	const dogru = detay.filter((d) => d.ok).length;
	return {
		details: detay,
		correct: dogru,
		total: sorular.length,
		score: sorular.length ? Math.round((dogru / sorular.length) * 100) : 0
	};
}

export const PASS_SCORE = 70;

export function isTextPassed(result) {
	return !!result && result.score >= PASS_SCORE;
}
