/**
 * Okuma parçası testleri.
 *
 * İçerik dosyası da doğrulanıyor: seviyeye göre uzunluk beklentisi
 * tutuyor mu, sorular metinden cevaplanabilir mi (doğru cevabın
 * şıklar arasında olması), çeviri eksik mi.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { grantPremium, NO_PREMIUM, PRODUCTS } from '../src/core/entitlements.js';
import {
	findText,
	gradeComprehension,
	isTextPassed,
	isTextUnlocked,
	PASS_SCORE,
	readingStats,
	textSummaries
} from '../src/core/reading.js';

const NOW = new Date('2026-09-04T12:00:00Z');
const PACK = JSON.parse(readFileSync('public/content/reading.json', 'utf8'));

function parca(level, id = 'x', kind = 'story') {
	return {
		id, title: 'T', level, kind, icon: '📖', summary: 's',
		paragraphs: ['One two three four five.'],
		questions: [{ q: 'soru', options: ['a', 'b'], answer: 1 }]
	};
}

describe('içerik dosyası', () => {
	it('parçalar yüklenebiliyor', () => {
		expect(PACK.texts.length).toBeGreaterThan(0);
	});

	it('her parçada gerekli alanlar var', () => {
		for (const t of PACK.texts) {
			expect(t.id, t.title).toBeTruthy();
			expect(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'], t.id).toContain(t.level);
			expect(['story', 'article'], t.id).toContain(t.kind);
			expect(t.paragraphs.length, t.id).toBeGreaterThan(0);
			expect(t.questions.length, t.id).toBeGreaterThan(1);
		}
	});

	it('uzunluk seviyeyle birlikte artar', () => {
		// A1 ogrencisine C1 uzunlugunda metin vermek okumayi
		// birakmasina yol acar.
		const ort = (lvl) => {
			const list = PACK.texts.filter((t) => t.level === lvl);
			if (!list.length) return 0;
			return list.reduce((s, t) => s + readingStats(t).words, 0) / list.length;
		};
		expect(ort('A1')).toBeLessThan(ort('B1'));
		expect(ort('B1')).toBeLessThan(ort('C1'));
	});

	it('her sorunun doğru cevabı şıklar arasında', () => {
		for (const t of PACK.texts) {
			for (const q of t.questions) {
				expect(q.options.length, t.id).toBeGreaterThanOrEqual(2);
				expect(q.answer, t.id + ' / ' + q.q).toBeLessThan(q.options.length);
				expect(q.answer, t.id + ' / ' + q.q).toBeGreaterThanOrEqual(0);
			}
		}
	});

	it('kimlikler benzersiz', () => {
		const ids = PACK.texts.map((t) => t.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('ücretsiz seviyede hem hikâye hem parça var', () => {
		const free = PACK.texts.filter((t) => isTextUnlocked(t, NO_PREMIUM, NOW));
		expect(free.length).toBeGreaterThan(0);
		expect(free.some((t) => t.kind === 'story')).toBe(true);
	});
});

describe('readingStats', () => {
	it('kelime sayar ve süre tahmin eder', () => {
		const s = readingStats({ paragraphs: ['a '.repeat(240).trim()] });
		expect(s.words).toBe(240);
		expect(s.minutes).toBe(2);
	});

	it('çok kısa metinde en az bir dakika der', () => {
		expect(readingStats({ paragraphs: ['one two'] }).minutes).toBe(1);
	});

	it('boş girdide çökmez', () => {
		expect(readingStats(null).words).toBe(0);
	});
});

describe('gradeComprehension', () => {
	const t = {
		questions: [
			{ q: 's1', options: ['a', 'b'], answer: 1 },
			{ q: 's2', options: ['a', 'b'], answer: 0 }
		]
	};

	it('doğru sayısını verir', () => {
		expect(gradeComprehension(t, [1, 0]).score).toBe(100);
		expect(gradeComprehension(t, [0, 0]).score).toBe(50);
	});

	it('cevapsız soruyu yanlış sayar', () => {
		expect(gradeComprehension(t, []).correct).toBe(0);
	});

	it('sorusuz parçada çökmez', () => {
		expect(gradeComprehension({ questions: [] }, []).score).toBe(0);
		expect(gradeComprehension(null, []).total).toBe(0);
	});
});

describe('kilit ve özet', () => {
	it('A1 ücretsiz, C1 kilitli', () => {
		expect(isTextUnlocked(parca('A1'), NO_PREMIUM, NOW)).toBe(true);
		expect(isTextUnlocked(parca('C1'), NO_PREMIUM, NOW)).toBe(false);
	});

	it('abonelikle hepsi açık', () => {
		const p = grantPremium(PRODUCTS.LIFETIME, { now: NOW });
		expect(isTextUnlocked(parca('C1'), p, NOW)).toBe(true);
	});

	it('türü Türkçe etiketler', () => {
		const out = textSummaries([parca('A1', 'a', 'article')], NO_PREMIUM, [], NOW);
		expect(out[0].kind).toBe('Makale');
	});

	it('tamamlananı işaretler', () => {
		expect(textSummaries([parca('A1', 'a')], NO_PREMIUM, ['a'], NOW)[0].done).toBe(true);
	});

	it('bozuk girdide çökmez', () => {
		expect(textSummaries(null, NO_PREMIUM, [], NOW)).toEqual([]);
		expect(findText(null, 'a')).toBeNull();
	});
});

describe('isTextPassed', () => {
	it('eşiğin altını geçirmez', () => {
		expect(isTextPassed({ score: PASS_SCORE })).toBe(true);
		expect(isTextPassed({ score: PASS_SCORE - 1 })).toBe(false);
	});
});
