/**
 * Zıt anlamlılar.
 *
 * En kritik testler çeldiricilerle ilgili: bir şıkkın da doğru cevap
 * sayılabileceği durum soruyu haksız yapar, sözcük türü karışması ise
 * soruyu anlamı bilmeden çözülebilir hâle getirir.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
	buildAntonymQuestion,
	buildRound,
	gradeRound,
	isPairUnlocked,
	pairsByLevel,
	unlockedPairs
} from '../src/core/antonyms.js';
import { grantPremium, NO_PREMIUM, PRODUCTS } from '../src/core/entitlements.js';

const NOW = new Date('2026-09-04T12:00:00Z');
const PACK = JSON.parse(readFileSync('public/content/antonyms.json', 'utf8'));
const PAIRS = PACK.pairs;

/** Deterministik "rastgele": sıralamayı sabitler. */
const sabit = () => 0.5;

describe('içerik dosyası', () => {
	it('çiftler yüklenebiliyor', () => {
		expect(PAIRS.length).toBeGreaterThan(20);
	});

	it('her çiftte gerekli alanlar var', () => {
		for (const p of PAIRS) {
			expect(p.id, JSON.stringify(p)).toBeTruthy();
			expect(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'], p.id).toContain(p.level);
			expect(['adj', 'verb', 'noun', 'adv'], p.id).toContain(p.pos);
			expect(p.a.en, p.id).toBeTruthy();
			expect(p.a.tr, p.id).toBeTruthy();
			expect(p.b.en, p.id).toBeTruthy();
			expect(p.b.tr, p.id).toBeTruthy();
		}
	});

	it('kimlikler benzersiz', () => {
		const ids = PAIRS.map((p) => p.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	/**
	 * Aynı İngilizce kelime iki çiftte geçerse, biri diğerinin sorusunda
	 * çeldirici olarak çıkabilir ve iki cevap da savunulabilir olur.
	 */
	it('aynı kelime iki çiftte geçmiyor', () => {
		const gorulen = new Map();
		for (const p of PAIRS) {
			for (const yan of [p.a, p.b]) {
				const k = yan.en.toLowerCase();
				expect(gorulen.has(k) ? `${k}: ${gorulen.get(k)} ve ${p.id}` : '').toBe('');
				gorulen.set(k, p.id);
			}
		}
	});

	it('her seviyede en az iki çift var', () => {
		const sayim = {};
		for (const p of PAIRS) sayim[p.level] = (sayim[p.level] || 0) + 1;
		for (const [lvl, n] of Object.entries(sayim)) expect(n, lvl).toBeGreaterThan(1);
	});

	it('ücretsiz seviyede yeterli çift var', () => {
		// Bir tur 10 soru; ucretsiz kullanici tur kuramazsa ozellik
		// abonelik duvarinin arkasinda kalir ve hic denenmez.
		expect(unlockedPairs(PAIRS, NO_PREMIUM, NOW).length).toBeGreaterThanOrEqual(10);
	});
});

describe('buildAntonymQuestion', () => {
	it('doğru cevap şıklar arasında', () => {
		for (const p of PAIRS) {
			const q = buildAntonymQuestion(p, PAIRS, { random: sabit });
			expect(q.options[q.answerIndex].en, p.id).toBe(p.b.en);
		}
	});

	it('ters yönde soru sorabilir', () => {
		const p = PAIRS[0];
		const q = buildAntonymQuestion(p, PAIRS, { reverse: true, random: sabit });
		expect(q.prompt.en).toBe(p.b.en);
		expect(q.options[q.answerIndex].en).toBe(p.a.en);
	});

	it('istenen sayıda şık üretir', () => {
		const q = buildAntonymQuestion(PAIRS[0], PAIRS, { count: 4, random: sabit });
		expect(q.options.length).toBe(4);
	});

	it('şıklar birbirini tekrar etmez', () => {
		for (const p of PAIRS) {
			const q = buildAntonymQuestion(p, PAIRS, { random: Math.random });
			const kelimeler = q.options.map((o) => o.en.toLowerCase());
			expect(new Set(kelimeler).size, p.id).toBe(kelimeler.length);
		}
	});

	it('sorulan kelime şıklarda çıkmaz', () => {
		for (const p of PAIRS) {
			for (const reverse of [false, true]) {
				const q = buildAntonymQuestion(p, PAIRS, { reverse, random: Math.random });
				const yanlislar = q.options.filter((o) => !o.dogru).map((o) => o.en.toLowerCase());
				expect(yanlislar, p.id).not.toContain(q.prompt.en.toLowerCase());
			}
		}
	});

	/**
	 * `also` içindeki kelimeler de kabul edilebilir cevaplar; şıkta
	 * görünürlerse öğrenci doğru bildiği hâlde yanlış yapar.
	 */
	it('kabul edilebilir eş anlamlılar çeldirici olamaz', () => {
		const cift = { id: 'x', level: 'A1', pos: 'adj', a: { en: 'easy', tr: 'k' }, b: { en: 'difficult', tr: 'z' }, also: ['hard'] };
		const digerleri = [cift, { id: 'y', level: 'A1', pos: 'adj', a: { en: 'hard', tr: 'z' }, b: { en: 'soft', tr: 'y' } }];
		const q = buildAntonymQuestion(cift, digerleri, { random: Math.random });
		expect(q.options.map((o) => o.en.toLowerCase())).not.toContain('hard');
	});

	it('çeldiriciler aynı sözcük türünden seçilir', () => {
		// Karisik turler soruyu anlam bilmeden cozulebilir yapiyor.
		for (const p of PAIRS) {
			const q = buildAntonymQuestion(p, PAIRS, { random: Math.random });
			for (const o of q.options) {
				if (o.dogru) continue;
				expect(o.pos, `${p.id} -> ${o.en}`).toBe(p.pos);
			}
		}
	});

	/**
	 * Sözcük türü kuralı ÜCRETSİZ havuzda da tutmalı.
	 *
	 * Tarayıcıda çıkan gerçek hata buydu: tur yalnızca kilidi açık
	 * çiftlerden kuruluyor, ücretsiz katmanda iki isim çifti vardı ve
	 * havuz tükenince "day" sorusuna "strong" çeldirici olarak düştü.
	 * Tüm liste üzerinden bakan test bunu göremiyordu.
	 */
	it('ücretsiz havuzda da sözcük türü karışmıyor', () => {
		const acik = unlockedPairs(PAIRS, NO_PREMIUM, NOW);
		for (const p of acik) {
			for (const reverse of [false, true]) {
				const q = buildAntonymQuestion(p, acik, { reverse, random: Math.random });
				for (const o of q.options) {
					if (o.dogru) continue;
					expect(o.pos, `${p.id} -> ${o.en}`).toBe(p.pos);
				}
			}
		}
	});

	it('çok küçük listede de soru üretir', () => {
		const kucuk = [
			{ id: 'a', level: 'A1', pos: 'adj', a: { en: 'big', tr: 'b' }, b: { en: 'small', tr: 'k' } },
			{ id: 'b', level: 'C1', pos: 'verb', a: { en: 'unite', tr: 'b' }, b: { en: 'divide', tr: 'a' } }
		];
		const q = buildAntonymQuestion(kucuk[0], kucuk, { count: 4, random: Math.random });
		expect(q.options.length).toBeGreaterThan(1);
		expect(q.options[q.answerIndex].en).toBe('small');
	});

	it('boş girdide null döner', () => {
		expect(buildAntonymQuestion(null, PAIRS)).toBeNull();
	});
});

describe('buildRound', () => {
	it('istenen uzunlukta tur kurar', () => {
		expect(buildRound(PAIRS, { size: 10, random: Math.random }).length).toBe(10);
	});

	it('aynı çifti iki kez sormaz', () => {
		const tur = buildRound(PAIRS, { size: 12, random: Math.random });
		const ids = tur.map((q) => q.pairId);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('liste turdan kısaysa hepsini kullanır', () => {
		const az = PAIRS.slice(0, 3);
		expect(buildRound(az, { size: 10, random: Math.random }).length).toBe(3);
	});

	it('boş listede boş tur', () => {
		expect(buildRound([], { random: sabit })).toEqual([]);
	});
});

describe('gradeRound', () => {
	const sorular = [
		{ prompt: { en: 'big' }, answer: { en: 'small' }, options: [{ en: 'small' }, { en: 'cold' }], answerIndex: 0 },
		{ prompt: { en: 'hot' }, answer: { en: 'cold' }, options: [{ en: 'big' }, { en: 'cold' }], answerIndex: 1 }
	];

	it('doğru sayar', () => {
		expect(gradeRound(sorular, [0, 1]).score).toBe(100);
		expect(gradeRound(sorular, [0, 0]).correct).toBe(1);
	});

	it('cevapsızı yanlış sayar', () => {
		const r = gradeRound(sorular, []);
		expect(r.correct).toBe(0);
		expect(r.detay[0].chosen).toBeNull();
	});

	it('boş turda çökmez', () => {
		expect(gradeRound([], []).score).toBe(0);
		expect(gradeRound(null, null).total).toBe(0);
	});
});

describe('kilit', () => {
	it('A1 ücretsiz, C1 kilitli', () => {
		expect(isPairUnlocked({ level: 'A1' }, NO_PREMIUM, NOW)).toBe(true);
		expect(isPairUnlocked({ level: 'C1' }, NO_PREMIUM, NOW)).toBe(false);
	});

	it('abonelikle hepsi açık', () => {
		const p = grantPremium(PRODUCTS.LIFETIME, { now: NOW });
		expect(unlockedPairs(PAIRS, p, NOW).length).toBe(PAIRS.length);
	});

	it('seviyeye göre sıralı gruplar', () => {
		const g = pairsByLevel(PAIRS, NO_PREMIUM, NOW);
		expect(g[0].level).toBe('A1');
		expect(g.map((x) => x.level)).toEqual(['A1', 'A2', 'B1', 'B2', 'C1']);
	});

	it('bozuk girdide çökmez', () => {
		expect(pairsByLevel(null, NO_PREMIUM, NOW)).toEqual([]);
		expect(unlockedPairs(null, NO_PREMIUM, NOW)).toEqual([]);
	});
});
