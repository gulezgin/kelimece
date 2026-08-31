/**
 * Liste süzgeci testleri: seviye seçimi, arama ve seviye dağılımı.
 *
 * DOM'a dokunan çizim fonksiyonları burada test edilmiyor; sadece saf
 * mantık (filterWords, levelBreakdown, foldTr).
 */
import { describe, expect, it } from 'vitest';
import { MAX_LEVEL } from '../src/core/srs.js';
import { addDays, todayISO } from '../src/core/time.js';
import { filterWords, foldTr, levelBreakdown } from '../src/ui/wordList.js';

const day = (n) => addDays(todayISO(), n);

function word(overrides = {}) {
	return {
		id: 'w',
		en: 'word',
		tr: 'kelime',
		synonyms: [],
		tags: [],
		cefr: 'A1',
		source: 'core',
		level: 0,
		nextReviewAt: day(0),
		addedAt: day(-10),
		history: [],
		...overrides
	};
}

describe('foldTr', () => {
	it('Türkçe aksanları düz karşılıklarına indirger', () => {
		expect(foldTr('yağı')).toBe('yagi');
		expect(foldTr('öğrenmek')).toBe('ogrenmek');
		expect(foldTr('ÇALIŞMAK')).toBe('calismak');
	});

	it('noktalı/noktasız I ayrımını yok eder', () => {
		// 'I'.toLowerCase() Türkçe yerelde beklendiği gibi davranmaz;
		// tablo bu yüzden büyük harfleri de kapsıyor.
		expect(foldTr('İstanbul')).toBe('istanbul');
		expect(foldTr('ISI')).toBe('isi');
		expect(foldTr('ısı')).toBe('isi');
	});

	it('boş ve geçersiz girdide çökmez', () => {
		expect(foldTr(null)).toBe('');
		expect(foldTr(undefined)).toBe('');
		expect(foldTr('')).toBe('');
	});
});

describe('filterWords - arama', () => {
	const words = [
		word({ id: 'a', en: 'tallow', tr: 'don yağı' }),
		word({ id: 'b', en: 'learn', tr: 'öğrenmek' }),
		word({ id: 'c', en: 'accuse', tr: 'suçlamak', synonyms: ['blame', 'charge'] }),
		word({ id: 'd', en: 'verb word', tr: 'fiil', tags: ['grammar'] })
	];

	it('Türkçe klavye kullanmadan da bulur', () => {
		expect(filterWords(words, { query: 'yag' }).map((w) => w.id)).toEqual(['a']);
		expect(filterWords(words, { query: 'ogrenmek' }).map((w) => w.id)).toEqual(['b']);
		expect(filterWords(words, { query: 'suclamak' }).map((w) => w.id)).toEqual(['c']);
	});

	it('aksanlı yazımla da bulur', () => {
		expect(filterWords(words, { query: 'yağı' }).map((w) => w.id)).toEqual(['a']);
	});

	it('eş anlamlılarda da arar', () => {
		expect(filterWords(words, { query: 'blame' }).map((w) => w.id)).toEqual(['c']);
	});

	it('etiketlerde de arar', () => {
		expect(filterWords(words, { query: 'grammar' }).map((w) => w.id)).toEqual(['d']);
	});

	it('boş sorguda hepsini döner', () => {
		expect(filterWords(words, { query: '   ' })).toHaveLength(4);
	});
});

describe('filterWords - seviye', () => {
	const words = [
		word({ id: 'a1', cefr: 'A1' }),
		word({ id: 'b2', cefr: 'B2' }),
		word({ id: 'c1', cefr: 'C1' }),
		word({ id: 'yok', cefr: null, source: 'user' })
	];

	it('seçilen CEFR seviyesini süzer', () => {
		expect(filterWords(words, { cefr: 'B2' }).map((w) => w.id)).toEqual(['b2']);
	});

	it("'all' hepsini döner", () => {
		expect(filterWords(words, { cefr: 'all' })).toHaveLength(4);
		expect(filterWords(words, {})).toHaveLength(4);
	});

	it("'none' seviyesi olmayanları döner", () => {
		expect(filterWords(words, { cefr: 'none' }).map((w) => w.id)).toEqual(['yok']);
	});

	it('seviye ve arama birlikte çalışır', () => {
		const list = [word({ id: 'x', en: 'apple', cefr: 'A1' }), word({ id: 'y', en: 'apple', cefr: 'C1' })];
		expect(filterWords(list, { cefr: 'A1', query: 'apple' }).map((w) => w.id)).toEqual(['x']);
	});

	it('seviye ve havuz filtresi birlikte çalışır', () => {
		const list = [
			word({ id: 'due', cefr: 'A1', level: 1, nextReviewAt: day(-1) }),
			word({ id: 'notdue', cefr: 'A1', level: 1, nextReviewAt: day(5) }),
			word({ id: 'other', cefr: 'B1', level: 1, nextReviewAt: day(-1) })
		];
		expect(filterWords(list, { cefr: 'A1', mode: 'due' }).map((w) => w.id)).toEqual(['due']);
	});
});

describe('levelBreakdown', () => {
	const words = [
		word({ cefr: 'A1', level: MAX_LEVEL }),
		word({ cefr: 'A1', level: 0 }),
		word({ cefr: 'A1', level: 2 }),
		word({ cefr: 'C2', level: MAX_LEVEL }),
		word({ cefr: null })
	];

	it('seviye başına toplam ve öğrenilmiş sayar', () => {
		const b = levelBreakdown(words, MAX_LEVEL);
		expect(b.A1).toEqual({ total: 3, learned: 1, due: 0 });
		expect(b.C2).toEqual({ total: 1, learned: 1, due: 0 });
	});

	it('seviyesi olmayanları ayrı sayar', () => {
		expect(levelBreakdown(words, MAX_LEVEL).none.total).toBe(1);
	});

	it('tüm seviyeler için anahtar üretir - boş olsalar bile', () => {
		const b = levelBreakdown([], MAX_LEVEL);
		for (const l of ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'none']) {
			expect(b[l]).toEqual({ total: 0, learned: 0, due: 0 });
		}
	});
});
