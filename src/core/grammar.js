/**
 * Dilbilgisi dersleri.
 *
 * Ders kitabı gibi değil: her ders kısa bir açıklama, kural listesi,
 * örnek cümleler ve hemen ardından bir quiz. Açıklamayı okuyup
 * uygulamadan geçmek öğretmiyor.
 *
 * Quiz sorularının her birinde `why` alanı var — yanlış cevaptan
 * sonra NEDEN yanlış olduğu gösteriliyor. Bu, ürün belgesindeki
 * "Bu cümle neden yanlış?" özelliğinin AI gerektirmeyen karşılığı:
 * açıklama yazarken elle yazılıyor, üretilmiyor.
 *
 * Saf mantık: DOM'a, depoya ve ağa dokunmaz.
 */
import { isLevelUnlocked } from './entitlements.js';

let cache = null;

/** Dersleri yükler; ikinci çağrıda ağa çıkmaz. */
export async function loadLessons(url) {
	if (cache) return cache;
	try {
		const res = await fetch(url);
		if (!res.ok) throw new Error('HTTP ' + res.status);
		const data = await res.json();
		cache = Array.isArray(data.lessons) ? data.lessons : [];
	} catch {
		cache = [];
	}
	return cache;
}

/** Test ve yeniden yükleme için. */
export function resetCache() {
	cache = null;
}

/** Ders abonelik olmadan açılabilir mi? Kelimelerdeki kuralın aynısı. */
export function isLessonUnlocked(lesson, premium, now) {
	if (!lesson) return false;
	return isLevelUnlocked(lesson.level, premium, now);
}

/**
 * Listeleme özeti: kilit durumu ve tamamlanma bilgisiyle.
 * @param {object[]} lessons
 * @param {object} premium
 * @param {string[]} [doneIds] Tamamlanan ders kimlikleri
 */
export function lessonSummaries(lessons, premium, doneIds = [], now) {
	const done = new Set(doneIds);
	return (lessons || []).filter(Boolean).map((l) => ({
		id: l.id,
		title: l.title,
		icon: l.icon || '📐',
		level: l.level,
		topic: l.topic || '',
		summary: l.summary || '',
		quizCount: (l.quiz || []).length,
		done: done.has(l.id),
		locked: !isLessonUnlocked(l, premium, now)
	}));
}

/** Kimliğe göre ders. */
export function findLesson(lessons, id) {
	return (lessons || []).find((l) => l && l.id === id) || null;
}

/**
 * Quiz sonucunu değerlendirir.
 * @param {object} lesson
 * @param {number[]} answers Soru sırasına göre seçilen indeksler
 */
export function gradeQuiz(lesson, answers) {
	const sorular = (lesson && lesson.quiz) || [];
	const detay = sorular.map((q, i) => {
		const secilen = answers[i];
		const dogru = secilen === q.answer;
		return {
			question: q.q,
			picked: secilen,
			correct: q.answer,
			ok: dogru,
			why: q.why || '',
			options: q.options || []
		};
	});
	const dogruSayisi = detay.filter((d) => d.ok).length;
	return {
		details: detay,
		correct: dogruSayisi,
		total: sorular.length,
		score: sorular.length ? Math.round((dogruSayisi / sorular.length) * 100) : 0
	};
}

/** Ders tamamlanmış sayılır mı? */
export const PASS_SCORE = 70;

export function isLessonPassed(result) {
	return !!result && result.score >= PASS_SCORE;
}
