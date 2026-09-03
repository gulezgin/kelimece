/**
 * Yerel profil testleri.
 *
 * Bu profil bir hesap DEĞİL — sunucu yok, veri cihazda. Testler bunu
 * değil, girdi temizliğini ve kimlik kararlılığını koruyor.
 */
import { describe, expect, it } from 'vitest';
import {
	hasAccount,
	initials,
	isValidEmail,
	localId,
	normalizeAccount
} from '../src/core/account.js';

describe('isValidEmail', () => {
	it('geçerli adresleri kabul eder', () => {
		expect(isValidEmail('ali@example.com')).toBe(true);
		expect(isValidEmail('a.b+c@alt.example.co.uk')).toBe(true);
	});

	it('yaygın yazım hatalarını yakalar', () => {
		expect(isValidEmail('ali@gmail')).toBe(false);
		expect(isValidEmail('ali.gmail.com')).toBe(false);
		expect(isValidEmail('ali@@x.com')).toBe(false);
		expect(isValidEmail('ali @x.com')).toBe(false);
		expect(isValidEmail('@x.com')).toBe(false);
		expect(isValidEmail('ali@.com')).toBe(false);
	});

	it('boş girdide false', () => {
		expect(isValidEmail('')).toBe(false);
		expect(isValidEmail(null)).toBe(false);
	});
});

describe('normalizeAccount', () => {
	it('boşlukları temizler ve e-postayı küçük harfe indirir', () => {
		const r = normalizeAccount({ name: '  Ali   Demir ', email: '  Ali@Example.COM ' });
		expect(r.ok).toBe(true);
		expect(r.account.name).toBe('Ali Demir');
		expect(r.account.email).toBe('ali@example.com');
	});

	it('ad zorunlu', () => {
		expect(normalizeAccount({ name: '   ', email: 'a@b.com' }))
			.toEqual({ ok: false, reason: 'name' });
	});

	it('çok uzun adı reddeder', () => {
		// Avatar ve kart yerlesimi 40 karakterden sonra bozuluyor.
		const r = normalizeAccount({ name: 'x'.repeat(41), email: 'a@b.com' });
		expect(r).toEqual({ ok: false, reason: 'name-long' });
	});

	it('geçersiz e-postayı reddeder', () => {
		expect(normalizeAccount({ name: 'Ali', email: 'bozuk' }))
			.toEqual({ ok: false, reason: 'email' });
	});
});

describe('hasAccount', () => {
	it('ad varsa kurulmuş sayar', () => {
		expect(hasAccount({ name: 'Ali' })).toBe(true);
		expect(hasAccount({ name: '  ' })).toBe(false);
		expect(hasAccount(null)).toBe(false);
	});
});

describe('initials', () => {
	it('tek kelimede tek harf, iki kelimede ikisi', () => {
		expect(initials({ name: 'ali' })).toBe('A');
		expect(initials({ name: 'Ali Demir' })).toBe('AD');
		expect(initials({ name: 'Ali Can Demir' })).toBe('AD');
	});

	it('Türkçe harflerde doğru büyütür', () => {
		// toUpperCase() 'i' harfini 'I' yapar; Turkce'de 'İ' olmali.
		expect(initials({ name: 'irem' })).toBe('İ');
	});

	it('ad yoksa soru işareti', () => {
		expect(initials({ name: '' })).toBe('?');
		expect(initials(null)).toBe('?');
	});
});

describe('localId', () => {
	it('aynı profil her zaman aynı numarayı verir', () => {
		// Numara destek talebinde kullanilabilmeli; her acilista
		// degisirse ise yaramaz.
		const a = { createdAt: '2026-09-03T10:00:00.000Z' };
		expect(localId(a)).toBe(localId(a));
	});

	it('farklı profiller farklı numara alır', () => {
		expect(localId({ createdAt: '2026-09-03T10:00:00.000Z' }))
			.not.toBe(localId({ createdAt: '2026-09-04T10:00:00.000Z' }));
	});

	it('sekiz haneli', () => {
		expect(localId({ createdAt: '2026-01-01T00:00:00.000Z' })).toHaveLength(8);
	});

	it('tarih yoksa sıfırlarla döner', () => {
		expect(localId(null)).toBe('00000000');
	});
});
