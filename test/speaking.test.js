/**
 * Konuşma karşılaştırma testleri.
 *
 * Ölçülen şey TELAFFUZ PUANI DEĞİL — konuşma tanımanın söylenenle
 * hedefi ne kadar eşleştirebildiği. Testler bu sınırı da koruyor:
 * cömert davranıp her şeyi doğru saymak, kullanıcıya yanlış bir
 * ilerleme hissi verir.
 */
import { describe, expect, it } from 'vitest';
import { compareUtterance, isPass, PASS_SCORE, tokenize } from '../src/core/speaking.js';

describe('tokenize', () => {
	it('noktalama ve büyük harfi temizler', () => {
		expect(tokenize('A large coffee, please!')).toEqual(['a', 'large', 'coffee', 'please']);
	});

	it('kısaltmaları açar', () => {
		// Konusma tanima "I'm" yerine "I am" dondurebiliyor; bu
		// telaffuz hatasi degil, yaziya dokme tercihi.
		expect(tokenize("I'm ready")).toEqual(tokenize('I am ready'));
		expect(tokenize("don't go")).toEqual(['do', 'not', 'go']);
	});

	it('boş girdide boş dizi', () => {
		expect(tokenize('')).toEqual([]);
		expect(tokenize(null)).toEqual([]);
	});
});

describe('compareUtterance', () => {
	const HEDEF = 'A large coffee, please.';

	it('tam eşleşmede 100', () => {
		expect(compareUtterance(HEDEF, 'a large coffee please').score).toBe(100);
	});

	it('eksik kelimeyi işaretler', () => {
		const r = compareUtterance(HEDEF, 'a large coffee');
		expect(r.score).toBe(75);
		expect(r.words.find((w) => /please/.test(w.word)).ok).toBe(false);
	});

	it('hiç konuşulmadıysa sıfır', () => {
		const r = compareUtterance(HEDEF, '');
		expect(r.score).toBe(0);
		expect(r.words.every((w) => !w.ok)).toBe(true);
	});

	it('sıra önemli', () => {
		// "drink the milk" ile "milk the drink" ayni sayilmamali.
		const r = compareUtterance('drink the milk', 'milk the drink');
		expect(r.score).toBeLessThan(100);
	});

	it('uzun kelimede bir harflik yazım farkını bağışlar', () => {
		// Konusma tanima uzun kelimeyi bir harf sasirtabiliyor; bunu
		// hata saymak kullaniciyi yapmadigi bir yanlis icin
		// cezalandirir.
		expect(compareUtterance('A large coffee', 'a large cofee').score).toBe(100);
	});

	it('eksik çekim ekini hata sayar', () => {
		// "worked" yerine "work" iki harflik fark ve golgeleme
		// alistirmasinda GERCEK bir hata: kullanici cumleyi aynen
		// tekrar etmeli. Toleransi buraya kadar genisletmek, gramer
		// hatasini gormezden gelmek olurdu.
		expect(compareUtterance('I worked yesterday', 'i work yesterday').score)
			.toBeLessThan(100);
	});

	it('kısa kelimede farkı bağışlamaz', () => {
		// "the" ile "a" ayni degil; kisa kelimelerde tolerans anlam
		// degistirir.
		const r = compareUtterance('the cat', 'a cat');
		expect(r.score).toBeLessThan(100);
	});

	it('fazladan kelime hedefi bozmaz ama puanı düşürür', () => {
		const r = compareUtterance(HEDEF, 'umm a large coffee please yes');
		expect(r.score).toBe(100);
	});

	it('kelimeleri hedefteki yazımıyla döner', () => {
		// Kullanici kendi cumlesini taniyabilmeli.
		const r = compareUtterance(HEDEF, 'a large coffee please');
		expect(r.words[0].word).toBe('A');
	});

	it('duyulanı geri verir', () => {
		expect(compareUtterance(HEDEF, '  a large coffee  ').heard).toBe('a large coffee');
	});

	it('boş hedefte çökmez', () => {
		const r = compareUtterance('', 'bir sey');
		expect(r.score).toBe(0);
		expect(r.words).toEqual([]);
	});
});

describe('isPass', () => {
	it('eşiğin altını geçirmez', () => {
		expect(isPass({ score: PASS_SCORE })).toBe(true);
		expect(isPass({ score: PASS_SCORE - 1 })).toBe(false);
		expect(isPass(null)).toBe(false);
	});
});
