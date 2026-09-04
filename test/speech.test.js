/**
 * Aksan gruplama.
 *
 * `speech.js` tarayıcıya bağlı ama gruplama saf tutuldu: hangi
 * aksanların gösterileceği kararı test edilebilir olmalı, çünkü
 * yanlış gruplama kullanıcıya cihazında olmayan bir aksanı seçtirir.
 */
import { describe, expect, it } from 'vitest';
import { ACCENT_LABELS, groupAccents } from '../src/core/speech.js';

describe('groupAccents', () => {
	it('İngilizce olmayan sesleri eler', () => {
		const out = groupAccents([{ lang: 'tr-TR' }, { lang: 'de-DE' }, { lang: 'en-US' }]);
		expect(out.map((a) => a.lang)).toEqual(['en-US']);
	});

	it('yazım farkını tek aksan sayar', () => {
		// 'en_GB', 'en-gb' ve 'en-GB' ayni aksan; normalize edilmezse
		// secicide uc kez gorunuyor.
		const out = groupAccents([{ lang: 'en_GB' }, { lang: 'en-gb' }, { lang: 'en-GB' }]);
		expect(out.length).toBe(1);
		expect(out[0].lang).toBe('en-GB');
		expect(out[0].count).toBe(3);
	});

	it('Türkçe ad verir', () => {
		expect(groupAccents([{ lang: 'en-GB' }])[0].label).toBe('İngiliz');
	});

	it('bilinmeyen aksanı kod ile gösterir', () => {
		expect(groupAccents([{ lang: 'en-XX' }])[0].label).toBe('en-XX');
	});

	it('bilinen aksanları öne alır', () => {
		const out = groupAccents([{ lang: 'en-XX' }, { lang: 'en-GB' }, { lang: 'en-US' }]);
		expect(out.map((a) => a.lang)).toEqual(['en-US', 'en-GB', 'en-XX']);
	});

	it('yerel ses varlığını işaretler', () => {
		const out = groupAccents([{ lang: 'en-US', localService: false }, { lang: 'en-US', localService: true }]);
		expect(out[0].local).toBe(true);
	});

	it('yerel ses yoksa işaretlemez', () => {
		expect(groupAccents([{ lang: 'en-US', localService: false }])[0].local).toBe(false);
	});

	it('boş girdide boş döner', () => {
		expect(groupAccents([])).toEqual([]);
		expect(groupAccents(null)).toEqual([]);
	});

	it('dili olmayan sesi atlar', () => {
		expect(groupAccents([{ localService: true }, { lang: 'en-US' }]).length).toBe(1);
	});

	it('etiket tablosu bilinen aksanları kapsıyor', () => {
		expect(ACCENT_LABELS['en-US']).toBeTruthy();
		expect(ACCENT_LABELS['en-GB']).toBeTruthy();
		expect(Object.keys(ACCENT_LABELS).every((k) => /^en-[A-Z]{2}$/.test(k))).toBe(true);
	});
});
