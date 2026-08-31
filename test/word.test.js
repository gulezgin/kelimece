/**
 * Kelime şeması ve doğrulama testleri.
 *
 * normalizeWord() uygulamanın güven sınırı: bozuk veri buradan geçemezse
 * arayüz çökmez. Buradaki testler o sözleşmeyi kilitler.
 */
import { describe, expect, it } from 'vitest';
import { MAX_LEVEL } from '../src/core/srs.js';
import { isDue } from '../src/core/time.js';
import { createWord, normalizeWord, normalizeWords, parseTags } from '../src/core/word.js';

describe('parseTags', () => {
	it('virgülle ayrılmış metni diziye çevirir', () => {
		expect(parseTags('verb, academic')).toEqual(['verb', 'academic']);
	});

	it('boşlukları kırpar ve boşları atar', () => {
		expect(parseTags('  a ,, b  ,   ')).toEqual(['a', 'b']);
	});

	it('yinelenen etiketleri (büyük/küçük harf duyarsız) teke indirir', () => {
		expect(parseTags('Verb, verb, VERB')).toEqual(['Verb']);
	});

	it('dizi girdiyi de kabul eder', () => {
		expect(parseTags(['x', ' y '])).toEqual(['x', 'y']);
	});

	it('geçersiz girdide boş dizi döner', () => {
		expect(parseTags(null)).toEqual([]);
		expect(parseTags(undefined)).toEqual([]);
	});
});

describe('createWord', () => {
	it('zorunlu alanlar eksikse null döner', () => {
		expect(createWord({ en: '', tr: 'anlam' })).toBeNull();
		expect(createWord({ en: 'word', tr: '   ' })).toBeNull();
	});

	it('yeni kelime bugün çalışılabilir olur', () => {
		// Regresyon: eskiden yarına planlanıyordu, bugün eklenen kelime
		// "Tekrar Et" kuyruğuna girmiyordu.
		const w = createWord({ en: 'x', tr: 'y' });
		expect(isDue(w.nextReviewAt)).toBe(true);
	});

	it('yeni kelimeyi 0. seviyede oluşturur', () => {
		const w = createWord({ en: '  abandon ', tr: ' terk etmek ' });
		expect(w.en).toBe('abandon');
		expect(w.tr).toBe('terk etmek');
		expect(w.level).toBe(0);
		expect(w.history).toEqual([]);
		expect(w.id).toBeTruthy();
	});
});

describe('normalizeWord', () => {
	it('regresyon: eksik tags/history alanlarını tamamlar', () => {
		// Bu şekildeki bir kayıt eski sürümde render() ve markResult()
		// içinde TypeError ile çöküyordu.
		const w = normalizeWord({ en: 'omega', tr: 'omega' });
		expect(Array.isArray(w.tags)).toBe(true);
		expect(Array.isArray(w.history)).toBe(true);
		expect(w.nextReviewAt).toBeTruthy();
		expect(w.createdAt).toBeTruthy();
	});

	it('yanlış tipteki alanları düzeltir', () => {
		const w = normalizeWord({
			en: 'psi',
			tr: 'psi',
			history: 'bozuk',
			level: 'abc',
			nextReviewAt: 'gecersiz-tarih'
		});
		expect(w.history).toEqual([]);
		expect(w.level).toBe(0);
		expect(Number.isNaN(new Date(w.nextReviewAt).getTime())).toBe(false);
	});

	it('etiket dizi yerine metin geldiyse ayrıştırır, atmaz', () => {
		// Elle düzenlenmiş yedeklerde sık görülüyor; veriyi çöpe atmak yerine
		// kurtarmak daha doğru.
		expect(normalizeWord({ en: 'a', tr: 'b', tags: 'verb, academic' }).tags)
			.toEqual(['verb', 'academic']);
		expect(normalizeWord({ en: 'a', tr: 'b', tags: 42 }).tags).toEqual(['42']);
	});

	it('seviyeyi geçerli aralığa kırpar', () => {
		expect(normalizeWord({ en: 'a', tr: 'b', level: 99 }).level).toBe(MAX_LEVEL);
		expect(normalizeWord({ en: 'a', tr: 'b', level: -3 }).level).toBe(0);
	});

	it('kurtarılamayan kayıtlar için null döner', () => {
		expect(normalizeWord(null)).toBeNull();
		expect(normalizeWord('metin')).toBeNull();
		expect(normalizeWord({ en: '', tr: 'x' })).toBeNull();
		expect(normalizeWord({ en: 'x', tr: '' })).toBeNull();
	});

	it('geçmişteki bozuk girdileri temizler', () => {
		const w = normalizeWord({
			en: 'a',
			tr: 'b',
			history: [{ date: '2026-01-01', known: true }, null, 'metin', { known: 'evet' }]
		});
		expect(w.history).toHaveLength(2);
		expect(w.history[0].known).toBe(true);
		expect(w.history[1].known).toBe(true); // 'evet' -> truthy
	});

	it('geçerli kaydı bozmaz', () => {
		const input = {
			id: 'x1',
			en: 'abandon',
			tr: 'terk etmek',
			example: 'They abandoned it.',
			tags: ['verb'],
			level: 2,
			nextReviewAt: '2026-01-15T00:00:00.000Z',
			createdAt: '2026-01-10T00:00:00.000Z',
			history: [{ date: '2026-01-10T00:00:00.000Z', known: true }]
		};
		expect(normalizeWord(input)).toEqual(input);
	});
});

describe('normalizeWords', () => {
	it('geçersiz kayıtları atar', () => {
		const out = normalizeWords([{ en: 'a', tr: 'b' }, null, { en: '', tr: 'x' }, { en: 'c', tr: 'd' }]);
		expect(out).toHaveLength(2);
	});

	it('dizi olmayan girdide boş dizi döner', () => {
		expect(normalizeWords(null)).toEqual([]);
		expect(normalizeWords({})).toEqual([]);
	});
});
