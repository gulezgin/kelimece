/**
 * Dilbilgisi dersi testleri.
 *
 * İçerik dosyası da doğrulanıyor: bozuk bir soru (doğru cevabı
 * olmayan, şıkkı eksik) ekranda sessizce yanlış öğretir.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { grantPremium, NO_PREMIUM, PRODUCTS } from '../src/core/entitlements.js';
import {
	findLesson,
	gradeQuiz,
	isLessonPassed,
	isLessonUnlocked,
	lessonSummaries,
	PASS_SCORE
} from '../src/core/grammar.js';

const NOW = new Date('2026-09-04T12:00:00Z');
const PACK = JSON.parse(readFileSync('public/content/grammar.json', 'utf8'));

function ders(level, id = 'x') {
	return {
		id, title: 'T', level, icon: '📐', summary: 's', explain: 'a',
		rules: ['r'], examples: [{ en: 'e', tr: 'ç' }],
		quiz: [{ q: 'soru', options: ['a', 'b'], answer: 1, why: 'çünkü' }]
	};
}

describe('içerik dosyası', () => {
	it('dersler yüklenebiliyor', () => {
		expect(PACK.lessons.length).toBeGreaterThan(0);
	});

	it('her derste gerekli alanlar var', () => {
		for (const l of PACK.lessons) {
			expect(l.id, l.title).toBeTruthy();
			expect(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'], l.id).toContain(l.level);
			expect(l.explain.length, l.id).toBeGreaterThan(20);
			expect(l.rules.length, l.id).toBeGreaterThan(0);
			expect(l.examples.length, l.id).toBeGreaterThan(0);
		}
	});

	it('her örnekte İngilizce ve Türkçe var', () => {
		for (const l of PACK.lessons) {
			for (const e of l.examples) {
				expect(e.en.trim(), l.id).not.toBe('');
				expect(e.tr.trim(), l.id + ' / ' + e.en).not.toBe('');
			}
		}
	});

	it('her sorunun doğru cevabı şıklar arasında', () => {
		// Bozuk bir soru ekranda sessizce yanlis ogretir.
		for (const l of PACK.lessons) {
			for (const q of l.quiz) {
				expect(q.options.length, l.id).toBeGreaterThanOrEqual(2);
				expect(q.answer, l.id + ' / ' + q.q).toBeGreaterThanOrEqual(0);
				expect(q.answer, l.id + ' / ' + q.q).toBeLessThan(q.options.length);
			}
		}
	});

	it('her soruda açıklama var', () => {
		// "Bu cumle neden yanlis?" ozelliginin AI'siz karsiligi bu alan.
		for (const l of PACK.lessons) {
			for (const q of l.quiz) {
				expect(q.why.trim().length, l.id + ' / ' + q.q).toBeGreaterThan(10);
			}
		}
	});

	it('kimlikler benzersiz', () => {
		const ids = PACK.lessons.map((l) => l.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('ücretsiz seviyede ders var', () => {
		const free = PACK.lessons.filter((l) => isLessonUnlocked(l, NO_PREMIUM, NOW));
		expect(free.length).toBeGreaterThan(0);
	});
});

describe('gradeQuiz', () => {
	const l = {
		quiz: [
			{ q: 's1', options: ['a', 'b'], answer: 1, why: 'ç1' },
			{ q: 's2', options: ['a', 'b'], answer: 0, why: 'ç2' }
		]
	};

	it('doğru sayısını ve yüzdeyi verir', () => {
		expect(gradeQuiz(l, [1, 0]).score).toBe(100);
		expect(gradeQuiz(l, [1, 1]).score).toBe(50);
		expect(gradeQuiz(l, [0, 1]).score).toBe(0);
	});

	it('yanlışta açıklamayı taşır', () => {
		const r = gradeQuiz(l, [0, 0]);
		expect(r.details[0].ok).toBe(false);
		expect(r.details[0].why).toBe('ç1');
		expect(r.details[0].correct).toBe(1);
	});

	it('cevapsız soruyu yanlış sayar', () => {
		expect(gradeQuiz(l, []).correct).toBe(0);
	});

	it('sorusuz derste çökmez', () => {
		expect(gradeQuiz({ quiz: [] }, []).score).toBe(0);
		expect(gradeQuiz(null, []).total).toBe(0);
	});
});

describe('kilit ve özet', () => {
	it('A1 ücretsiz, B1 kilitli', () => {
		expect(isLessonUnlocked(ders('A1'), NO_PREMIUM, NOW)).toBe(true);
		expect(isLessonUnlocked(ders('B1'), NO_PREMIUM, NOW)).toBe(false);
	});

	it('abonelikle hepsi açık', () => {
		const p = grantPremium(PRODUCTS.LIFETIME, { now: NOW });
		expect(isLessonUnlocked(ders('C1'), p, NOW)).toBe(true);
	});

	it('kilitliyi listeden çıkarmaz, işaretler', () => {
		const out = lessonSummaries([ders('A1', 'a'), ders('B1', 'b')], NO_PREMIUM, [], NOW);
		expect(out).toHaveLength(2);
		expect(out.find((x) => x.id === 'b').locked).toBe(true);
	});

	it('tamamlananı işaretler', () => {
		const out = lessonSummaries([ders('A1', 'a')], NO_PREMIUM, ['a'], NOW);
		expect(out[0].done).toBe(true);
	});

	it('bozuk girdide çökmez', () => {
		expect(lessonSummaries(null, NO_PREMIUM, [], NOW)).toEqual([]);
		expect(findLesson(null, 'a')).toBeNull();
	});
});

describe('isLessonPassed', () => {
	it('eşiğin altını geçirmez', () => {
		expect(isLessonPassed({ score: PASS_SCORE })).toBe(true);
		expect(isLessonPassed({ score: PASS_SCORE - 1 })).toBe(false);
	});
});
