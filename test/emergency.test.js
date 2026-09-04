/**
 * Acil İngilizce.
 *
 * En önemli test, içeriğin ASLA kilitlenmemesi değil — kilit mantığı
 * bu modülde hiç yok, çağrılmıyor. Onun yerine aramaya odaklanıldı:
 * panik anında çalışmayan bir arama, özelliğin tamamını işe yaramaz
 * kılıyor. Türkçe kullanıcılar telefonda çoğu zaman "calindi" yazıyor.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
	findSituation,
	fold,
	searchPhrases,
	situationSummaries
} from '../src/core/emergency.js';

const PACK = JSON.parse(readFileSync('public/content/emergency.json', 'utf8'));

const TUM_CUMLELER = [
	...PACK.critical,
	...PACK.situations.flatMap((s) => [...(s.say || []), ...(s.hear || [])])
];

describe('içerik dosyası', () => {
	it('acil cümleler var', () => {
		expect(PACK.critical.length).toBeGreaterThan(3);
	});

	it('durumlar tanımlı', () => {
		expect(PACK.situations.length).toBeGreaterThan(3);
		for (const s of PACK.situations) {
			expect(s.id, s.title).toBeTruthy();
			expect(s.icon, s.id).toBeTruthy();
			expect(s.summary, s.id).toBeTruthy();
			expect(s.say.length, s.id).toBeGreaterThan(4);
		}
	});

	/**
	 * "Duyabileceklerin" bu özelliğin ayırt edici parçası: asıl panik
	 * karşıdakinin cevabını anlamamaktan çıkıyor.
	 */
	it('her durumda duyabileceklerin bölümü var', () => {
		for (const s of PACK.situations) {
			expect(s.hear.length, s.id).toBeGreaterThan(3);
		}
	});

	it('her cümlenin çevirisi var', () => {
		for (const p of TUM_CUMLELER) {
			expect(p.en, JSON.stringify(p)).toBeTruthy();
			expect(p.tr, p.en).toBeTruthy();
		}
	});

	it('kimlikler benzersiz', () => {
		const ids = PACK.situations.map((s) => s.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('cümleler kısa tutulmuş', () => {
		// Acil durumda uzun cumle ne soylenebiliyor ne anlasiliyor.
		for (const p of TUM_CUMLELER) {
			expect(p.en.split(/\s+/).length, p.en).toBeLessThanOrEqual(12);
		}
	});
});

describe('fold', () => {
	it('Türkçe harfleri sadeleştirir', () => {
		expect(fold('çalındı')).toBe('calindi');
		expect(fold('ağrı')).toBe('agri');
		expect(fold('İstanbul')).toBe('istanbul');
		expect(fold('ŞÜKRÜ')).toBe('sukru');
	});

	it('boş girdide boş döner', () => {
		expect(fold(null)).toBe('');
		expect(fold('')).toBe('');
	});
});

describe('searchPhrases', () => {
	it('Türkçe metinde bulur', () => {
		const r = searchPhrases(PACK, 'çalındı');
		expect(r.length).toBeGreaterThan(0);
		expect(r.some((p) => p.en.toLowerCase().includes('stolen'))).toBe(true);
	});

	it('Türkçe harf yazmadan da bulur', () => {
		// Telefonda kimse "çalındı" yazmiyor.
		expect(searchPhrases(PACK, 'calindi').length).toBe(searchPhrases(PACK, 'çalındı').length);
		expect(searchPhrases(PACK, 'agri').length).toBeGreaterThan(0);
	});

	it('İngilizce metinde de bulur', () => {
		expect(searchPhrases(PACK, 'doctor').length).toBeGreaterThan(0);
	});

	it('büyük-küçük harf ayırmaz', () => {
		expect(searchPhrases(PACK, 'DOCTOR').length).toBe(searchPhrases(PACK, 'doctor').length);
	});

	it('sonuç bağlamı taşır', () => {
		const r = searchPhrases(PACK, 'ambulans');
		expect(r[0].source).toBeTruthy();
		expect(['say', 'hear']).toContain(r[0].direction);
	});

	it('duyulacak cümleleri işaretler', () => {
		const r = searchPhrases(PACK, 'neresi ağrıyor');
		expect(r.length).toBeGreaterThan(0);
		expect(r[0].direction).toBe('hear');
	});

	it('boş sorguda boş döner', () => {
		expect(searchPhrases(PACK, '')).toEqual([]);
		expect(searchPhrases(PACK, '   ')).toEqual([]);
		expect(searchPhrases(PACK, null)).toEqual([]);
	});

	it('eşleşme yoksa boş döner', () => {
		expect(searchPhrases(PACK, 'zzzqqq')).toEqual([]);
	});

	it('bozuk pakette çökmez', () => {
		expect(searchPhrases(null, 'test')).toEqual([]);
		expect(searchPhrases({}, 'test')).toEqual([]);
	});
});

describe('durum sorguları', () => {
	it('özet sayıları verir', () => {
		const o = situationSummaries(PACK);
		expect(o.length).toBe(PACK.situations.length);
		expect(o[0].count).toBeGreaterThan(5);
	});

	it('kimliğe göre bulur', () => {
		expect(findSituation(PACK, 'e-health').title).toBeTruthy();
		expect(findSituation(PACK, 'yok')).toBeNull();
	});

	it('bozuk girdide çökmez', () => {
		expect(situationSummaries(null)).toEqual([]);
		expect(findSituation(null, 'x')).toBeNull();
	});
});
