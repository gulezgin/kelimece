/**
 * Kelime modeli testleri: tanım/ilerleme ayrımı, doğrulama, birleştirme.
 *
 * normalizeDefinition/normalizeProgress uygulamanın güven sınırı: bozuk
 * veri buradan geçemezse arayüz çökmez. Buradaki testler o sözleşmeyi
 * kilitler.
 */
import { describe, expect, it } from 'vitest';
import { MAX_LEVEL } from '../src/core/srs.js';
import { isDue } from '../src/core/time.js';
import {
	createDefinition,
	createProgress,
	makeId,
	merge,
	normalizeCefr,
	normalizeDefinition,
	normalizeProgress,
	normalizeWord,
	normalizeWords,
	parseTags,
	slugify,
	split
} from '../src/core/word.js';

describe('slugify / makeId', () => {
	it('kararlı kimlik üretir', () => {
		expect(slugify('look down on')).toBe('look-down-on');
		expect(slugify('  T-shirt  ')).toBe('t-shirt');
		expect(makeId('core', 'look down on')).toBe('core:look-down-on');
	});

	it('aynı kelime için hep aynı kimliği verir', () => {
		// Paket güncellendiğinde ilerlemenin doğru kelimeye bağlı kalması
		// buna dayanıyor.
		expect(makeId('core', 'abandon')).toBe(makeId('core', 'Abandon '));
	});

	it('kullanıcı kelimelerine benzersiz kimlik verir', () => {
		expect(makeId('user', 'abandon')).not.toBe(makeId('user', 'abandon'));
		expect(makeId('user', 'abandon').startsWith('user:')).toBe(true);
	});
});

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

describe('normalizeCefr', () => {
	it('geçerli seviyeleri kabul eder', () => {
		expect(normalizeCefr('a1')).toBe('A1');
		expect(normalizeCefr(' C2 ')).toBe('C2');
	});

	it('geçersiz değerde null döner', () => {
		expect(normalizeCefr('D1')).toBeNull();
		expect(normalizeCefr('')).toBeNull();
		expect(normalizeCefr(null)).toBeNull();
	});
});

describe('createDefinition', () => {
	it('zorunlu alanlar eksikse null döner', () => {
		expect(createDefinition({ en: '', tr: 'anlam' })).toBeNull();
		expect(createDefinition({ en: 'word', tr: '   ' })).toBeNull();
	});

	it('kullanıcı kelimesi olarak oluşturur', () => {
		const d = createDefinition({ en: '  abandon ', tr: ' terk etmek ' });
		expect(d.en).toBe('abandon');
		expect(d.tr).toBe('terk etmek');
		expect(d.source).toBe('user');
		expect(d.id.startsWith('user:')).toBe(true);
	});

	it('Faz 2 alanlarını null olarak hazırlar', () => {
		const d = createDefinition({ en: 'x', tr: 'y' });
		expect(d.cefr).toBeNull();
		expect(d.pos).toBeNull();
		expect(d.ipa).toBeNull();
	});
});

describe('createProgress', () => {
	it('yeni kelime bugün çalışılabilir olur', () => {
		// Regresyon: eskiden yarına planlanıyordu, bugün eklenen kelime
		// "Tekrar Et" kuyruğuna girmiyordu.
		const p = createProgress('user:x');
		expect(isDue(p.nextReviewAt)).toBe(true);
		expect(p.level).toBe(0);
		expect(p.history).toEqual([]);
	});
});

describe('normalizeDefinition', () => {
	it('regresyon: eksik tags alanını tamamlar', () => {
		const d = normalizeDefinition({ en: 'omega', tr: 'omega' });
		expect(Array.isArray(d.tags)).toBe(true);
		expect(Array.isArray(d.synonyms)).toBe(true);
	});

	it('yanlış tipteki alanları düzeltir', () => {
		const d = normalizeDefinition({ en: 'psi', tr: 'psi', cefr: 'Z9', freqRank: 'abc', pos: '  ' });
		expect(d.cefr).toBeNull();
		expect(d.freqRank).toBeNull();
		expect(d.pos).toBeNull();
	});

	it('etiket dizi yerine metin geldiyse ayrıştırır, atmaz', () => {
		// Elle düzenlenmiş yedeklerde sık görülüyor.
		expect(normalizeDefinition({ en: 'a', tr: 'b', tags: 'verb, academic' }).tags)
			.toEqual(['verb', 'academic']);
	});

	it('kurtarılamayan kayıtlar için null döner', () => {
		expect(normalizeDefinition(null)).toBeNull();
		expect(normalizeDefinition('metin')).toBeNull();
		expect(normalizeDefinition({ en: '', tr: 'x' })).toBeNull();
		expect(normalizeDefinition({ en: 'x', tr: '' })).toBeNull();
	});

	it('kaynak (source) verilirse kimliği ona göre üretir', () => {
		expect(normalizeDefinition({ en: 'abandon', tr: 'x' }, { source: 'core' }).id).toBe('core:abandon');
	});
});

describe('normalizeProgress', () => {
	it('regresyon: eksik history alanını tamamlar', () => {
		const p = normalizeProgress({}, 'core:x');
		expect(Array.isArray(p.history)).toBe(true);
		expect(p.nextReviewAt).toBeTruthy();
	});

	it('yanlış tipteki alanları düzeltir', () => {
		const p = normalizeProgress({ level: 'abc', history: 'bozuk', nextReviewAt: 'gecersiz' }, 'core:x');
		expect(p.level).toBe(0);
		expect(p.history).toEqual([]);
		expect(Number.isNaN(new Date(p.nextReviewAt).getTime())).toBe(false);
	});

	it('seviyeyi geçerli aralığa kırpar', () => {
		expect(normalizeProgress({ level: 99 }, 'x').level).toBe(MAX_LEVEL);
		expect(normalizeProgress({ level: -3 }, 'x').level).toBe(0);
	});

	it('eski biçimdeki createdAt alanını addedAt olarak okur', () => {
		const p = normalizeProgress({ createdAt: '2026-01-10T00:00:00.000Z' }, 'x');
		expect(p.addedAt).toBe('2026-01-10T00:00:00.000Z');
	});

	it('geçmişteki bozuk girdileri temizler', () => {
		const p = normalizeProgress(
			{ history: [{ date: '2026-01-01', known: true }, null, 'metin', { known: 'evet' }] },
			'x'
		);
		expect(p.history).toHaveLength(2);
		expect(p.history[0].known).toBe(true);
		expect(p.history[1].known).toBe(true);
	});

	it('kimlik yoksa null döner', () => {
		expect(normalizeProgress({}, '')).toBeNull();
	});
});

describe('merge / split', () => {
	const definition = normalizeDefinition({ en: 'abandon', tr: 'terk etmek' }, { source: 'core' });

	it('tanım ve ilerlemeyi tek düz kayıtta birleştirir', () => {
		const progress = { ...createProgress(definition.id), level: 3 };
		const flat = merge(definition, progress);
		expect(flat.en).toBe('abandon');
		expect(flat.level).toBe(3);
		expect(flat.id).toBe(definition.id);
	});

	it('ilerleme yoksa varsayılan üretir', () => {
		const flat = merge(definition);
		expect(flat.level).toBe(0);
		expect(flat.history).toEqual([]);
	});

	it('split(merge(x)) kaydı bozmaz', () => {
		const progress = { ...createProgress(definition.id), level: 2, learnedManually: true };
		const parts = split(merge(definition, progress));
		expect(parts.definition).toEqual(definition);
		expect(parts.progress.level).toBe(2);
		expect(parts.progress.learnedManually).toBe(true);
		expect(parts.progress.wordId).toBe(definition.id);
	});

	it('split ilerleme alanlarını tanımdan ayıklar', () => {
		const flat = merge(definition, createProgress(definition.id));
		const { definition: def } = split(flat);
		expect(def).not.toHaveProperty('level');
		expect(def).not.toHaveProperty('history');
		expect(def).not.toHaveProperty('nextReviewAt');
	});
});

describe('normalizeWord', () => {
	it('eski biçimdeki tek kaydı düz kayda çevirir', () => {
		const w = normalizeWord({
			en: 'abandon',
			tr: 'terk etmek',
			level: 2,
			createdAt: '2026-01-10T00:00:00.000Z',
			history: [{ date: '2026-01-10T00:00:00.000Z', known: true }]
		});
		expect(w.en).toBe('abandon');
		expect(w.level).toBe(2);
		expect(w.addedAt).toBe('2026-01-10T00:00:00.000Z');
		expect(w.history).toHaveLength(1);
	});

	it('regresyon: eksik alanlı kayıtta çökmez', () => {
		const w = normalizeWord({ en: 'omega', tr: 'omega' });
		expect(Array.isArray(w.tags)).toBe(true);
		expect(Array.isArray(w.history)).toBe(true);
		expect(w.nextReviewAt).toBeTruthy();
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
