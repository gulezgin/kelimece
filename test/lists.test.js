/**
 * Kişisel kelime listeleri.
 *
 * Vurgu iki noktada: listenin tanım değil KİMLİK tutması (paket
 * güncellenince listenin bayatlamaması) ve saf fonksiyonların girdiyi
 * değiştirmemesi — `store` bu dizileri doğrudan tutuyor, yerinde
 * değişiklik `emit()` olmadan sessiz bir sapma bırakırdı.
 */
import { describe, expect, it } from 'vitest';
import {
	createList,
	deleteList,
	findList,
	isInList,
	listCountFor,
	listSummaries,
	MAX_LISTS,
	normalizeName,
	renameList,
	toggleWord,
	wordsInList
} from '../src/core/lists.js';

const WORDS = [
	{ id: 'core:abandon', en: 'abandon', tr: 'terk etmek', cefr: 'B2' },
	{ id: 'core:big', en: 'big', tr: 'büyük', cefr: 'A1' },
	{ id: 'core:cat', en: 'cat', tr: 'kedi', cefr: 'A1' }
];

function liste(wordIds = []) {
	return [{ id: 'l1', name: 'Sınav', wordIds, createdAt: '2026-01-01T00:00:00Z' }];
}

describe('normalizeName', () => {
	it('baştaki ve sondaki boşluğu atar', () => {
		expect(normalizeName('  Sınav  ')).toBe('Sınav');
	});

	it('içteki fazla boşluğu teke indirir', () => {
		expect(normalizeName('İş   kelimeleri')).toBe('İş kelimeleri');
	});

	it('boş adı reddeder', () => {
		expect(normalizeName('   ')).toBeNull();
		expect(normalizeName('')).toBeNull();
		expect(normalizeName(null)).toBeNull();
	});

	it('çok uzun adı kırpar', () => {
		expect(normalizeName('a'.repeat(100)).length).toBe(40);
	});
});

describe('createList', () => {
	it('liste kurar', () => {
		const r = createList([], 'Sınav');
		expect(r.ok).toBe(true);
		expect(r.lists.length).toBe(1);
		expect(r.lists[0].name).toBe('Sınav');
		expect(r.lists[0].wordIds).toEqual([]);
	});

	it('boş adı reddeder', () => {
		expect(createList([], '  ').ok).toBe(false);
	});

	it('aynı adı iki kez kabul etmez', () => {
		const bir = createList([], 'Sınav');
		expect(createList(bir.lists, 'Sınav').ok).toBe(false);
	});

	it('büyük-küçük harf farkını aynı ad sayar', () => {
		// Turkce'de "İş" ve "iş" ayni sozcuk; iki ayri liste kurmak
		// kullaniciyi yanlis listeye kelime eklerken sasirtir.
		const bir = createList([], 'İş');
		expect(createList(bir.lists, 'iş').ok).toBe(false);
	});

	it('üst sınırı aşmaz', () => {
		let lists = [];
		for (let i = 0; i < MAX_LISTS; i++) lists = createList(lists, 'L' + i).lists;
		const r = createList(lists, 'Bir daha');
		expect(r.ok).toBe(false);
		expect(r.lists.length).toBe(MAX_LISTS);
	});

	it('kimlikler benzersiz', () => {
		let lists = [];
		for (let i = 0; i < 10; i++) lists = createList(lists, 'L' + i).lists;
		expect(new Set(lists.map((l) => l.id)).size).toBe(10);
	});

	it('girdiyi değiştirmez', () => {
		const once = [];
		createList(once, 'Sınav');
		expect(once.length).toBe(0);
	});
});

describe('renameList', () => {
	it('adı değiştirir', () => {
		const r = renameList(liste(), 'l1', 'Yeni ad');
		expect(r.ok).toBe(true);
		expect(r.lists[0].name).toBe('Yeni ad');
	});

	it('kelimeleri korur', () => {
		const r = renameList(liste(['core:big']), 'l1', 'Yeni');
		expect(r.lists[0].wordIds).toEqual(['core:big']);
	});

	it('olmayan listeyi reddeder', () => {
		expect(renameList(liste(), 'yok', 'Ad').ok).toBe(false);
	});

	it('başka listenin adını almaz', () => {
		const iki = [...liste(), { id: 'l2', name: 'İş', wordIds: [] }];
		expect(renameList(iki, 'l2', 'Sınav').ok).toBe(false);
	});

	it('kendi adını yeniden vermek sorun değil', () => {
		expect(renameList(liste(), 'l1', 'Sınav').ok).toBe(true);
	});
});

describe('deleteList', () => {
	it('listeyi siler', () => {
		expect(deleteList(liste(['core:big']), 'l1')).toEqual([]);
	});

	it('olmayan kimlikte hiçbir şey değişmez', () => {
		expect(deleteList(liste(), 'yok').length).toBe(1);
	});

	it('bozuk girdide çökmez', () => {
		expect(deleteList(null, 'l1')).toEqual([]);
	});
});

describe('toggleWord', () => {
	it('ekler', () => {
		const r = toggleWord(liste(), 'l1', 'core:big');
		expect(r[0].wordIds).toEqual(['core:big']);
	});

	it('ikinci çağrıda çıkarır', () => {
		const r = toggleWord(toggleWord(liste(), 'l1', 'core:big'), 'l1', 'core:big');
		expect(r[0].wordIds).toEqual([]);
	});

	it('başka listeye dokunmaz', () => {
		const iki = [...liste(), { id: 'l2', name: 'İş', wordIds: [] }];
		const r = toggleWord(iki, 'l1', 'core:big');
		expect(r[1].wordIds).toEqual([]);
	});

	it('girdiyi değiştirmez', () => {
		const once = liste();
		toggleWord(once, 'l1', 'core:big');
		expect(once[0].wordIds).toEqual([]);
	});
});

describe('sorgular', () => {
	it('isInList', () => {
		const l = toggleWord(liste(), 'l1', 'core:big');
		expect(isInList(l, 'l1', 'core:big')).toBe(true);
		expect(isInList(l, 'l1', 'core:cat')).toBe(false);
		expect(isInList(l, 'yok', 'core:big')).toBe(false);
	});

	it('listCountFor kaç listede olduğunu sayar', () => {
		const iki = [
			{ id: 'l1', name: 'A', wordIds: ['core:big'] },
			{ id: 'l2', name: 'B', wordIds: ['core:big', 'core:cat'] }
		];
		expect(listCountFor(iki, 'core:big')).toBe(2);
		expect(listCountFor(iki, 'core:cat')).toBe(1);
		expect(listCountFor(null, 'core:big')).toBe(0);
	});

	it('findList', () => {
		expect(findList(liste(), 'l1').name).toBe('Sınav');
		expect(findList(liste(), 'yok')).toBeNull();
	});
});

describe('wordsInList', () => {
	it('kimlikleri sözlükten çözer', () => {
		const out = wordsInList(WORDS, { wordIds: ['core:big', 'core:cat'] });
		expect(out.map((w) => w.en)).toEqual(['big', 'cat']);
	});

	/**
	 * Paket güncellemesinde bir kelime kalkarsa listenin tamamen
	 * bozulması yerine o satırın düşmesi doğru davranış.
	 */
	it('sözlükte olmayan kimliği atlar', () => {
		const out = wordsInList(WORDS, { wordIds: ['core:big', 'core:yok'] });
		expect(out.length).toBe(1);
	});

	it('boş girdide boş döner', () => {
		expect(wordsInList(WORDS, null)).toEqual([]);
		expect(wordsInList(null, { wordIds: ['core:big'] })).toEqual([]);
	});
});

describe('listSummaries', () => {
	it('çözülebilen kelimeleri sayar', () => {
		const s = listSummaries([{ id: 'l1', name: 'A', wordIds: ['core:big', 'core:yok'] }], WORDS);
		expect(s[0].count).toBe(1);
		expect(s[0].missing).toBe(1);
	});

	it('seviyeleri sıralı verir', () => {
		const s = listSummaries([{ id: 'l1', name: 'A', wordIds: ['core:abandon', 'core:big'] }], WORDS);
		expect(s[0].levels).toEqual(['A1', 'B2']);
	});

	it('boş listede sıfır', () => {
		const s = listSummaries([{ id: 'l1', name: 'A', wordIds: [] }], WORDS);
		expect(s[0].count).toBe(0);
	});

	it('bozuk girdide çökmez', () => {
		expect(listSummaries(null, WORDS)).toEqual([]);
		expect(listSummaries([{ id: 'l1', name: 'A' }], null)[0].count).toBe(0);
	});
});
