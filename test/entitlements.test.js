/**
 * Erişim hakları testleri.
 *
 * Bu katman parayla ilgili: bir hata ya ödeyen kullanıcıyı içerikten
 * mahrum bırakır ya da ücretli içeriği bedava dağıtır. İkisi de kötü.
 */
import { describe, expect, it } from 'vitest';
import {
	accessibleWords,
	FREE_LEVELS,
	grantPremium,
	isLevelUnlocked,
	isPremiumActive,
	isWordUnlocked,
	lockedLevels,
	lockedSummary,
	NO_PREMIUM,
	PRODUCTS
} from '../src/core/entitlements.js';

const NOW = new Date('2026-09-01T12:00:00Z');

function word(cefr, source = 'core') {
	return { id: cefr + '-' + source, en: 'w', tr: 'k', cefr, source };
}

describe('isPremiumActive', () => {
	it('abonelik yoksa pasif', () => {
		expect(isPremiumActive(NO_PREMIUM, NOW)).toBe(false);
		expect(isPremiumActive(null, NOW)).toBe(false);
		expect(isPremiumActive(undefined, NOW)).toBe(false);
	});

	it('ömür boyu abonelik hep geçerli', () => {
		const p = grantPremium(PRODUCTS.LIFETIME, { now: NOW });
		expect(p.expiresAt).toBeNull();
		expect(isPremiumActive(p, new Date('2099-01-01'))).toBe(true);
	});

	it('süresi dolmamış abonelik geçerli', () => {
		const p = grantPremium(PRODUCTS.MONTHLY, { now: NOW });
		expect(isPremiumActive(p, new Date('2026-09-15'))).toBe(true);
	});

	it('süresi dolmuş abonelik pasif', () => {
		const p = grantPremium(PRODUCTS.MONTHLY, { now: NOW });
		expect(isPremiumActive(p, new Date('2026-11-01'))).toBe(false);
	});

	it('bozuk bitiş tarihinde pasif sayar', () => {
		expect(isPremiumActive({ active: true, expiresAt: 'gecersiz' }, NOW)).toBe(false);
	});
});

describe('grantPremium', () => {
	it('aylık abonelik bir ay sürer', () => {
		const p = grantPremium(PRODUCTS.MONTHLY, { now: NOW });
		expect(new Date(p.expiresAt).getMonth()).toBe(9); // Ekim
		expect(p.active).toBe(true);
		expect(p.product).toBe(PRODUCTS.MONTHLY);
	});

	it('yıllık abonelik bir yıl sürer', () => {
		const p = grantPremium(PRODUCTS.YEARLY, { now: NOW });
		expect(new Date(p.expiresAt).getFullYear()).toBe(2027);
	});
});

describe('isLevelUnlocked', () => {
	it('ücretsiz seviyeler abonelik olmadan açık', () => {
		for (const level of FREE_LEVELS) {
			expect(isLevelUnlocked(level, NO_PREMIUM, NOW)).toBe(true);
		}
	});

	it('ileri seviyeler abonelik olmadan kilitli', () => {
		for (const level of ['B1', 'B2', 'C1', 'C2']) {
			expect(isLevelUnlocked(level, NO_PREMIUM, NOW)).toBe(false);
		}
	});

	it('abonelikle her seviye açık', () => {
		const p = grantPremium(PRODUCTS.YEARLY, { now: NOW });
		for (const level of ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']) {
			expect(isLevelUnlocked(level, p, NOW)).toBe(true);
		}
	});

	it('seviyesi olmayan kelime açık', () => {
		expect(isLevelUnlocked(null, NO_PREMIUM, NOW)).toBe(true);
	});
});

describe('isWordUnlocked', () => {
	it('kullanıcının kendi kelimesi her zaman açık', () => {
		// Kendi verisine erişimi kısıtlamak kabul edilemez.
		expect(isWordUnlocked(word('C2', 'user'), NO_PREMIUM, NOW)).toBe(true);
		expect(isWordUnlocked(word('C1', 'user'), NO_PREMIUM, NOW)).toBe(true);
	});

	it('paket kelimesi seviyesine göre kilitlenir', () => {
		expect(isWordUnlocked(word('A1'), NO_PREMIUM, NOW)).toBe(true);
		expect(isWordUnlocked(word('B1'), NO_PREMIUM, NOW)).toBe(false);
	});

	it('geçersiz girdide false döner', () => {
		expect(isWordUnlocked(null, NO_PREMIUM, NOW)).toBe(false);
	});
});

describe('accessibleWords', () => {
	const pool = [
		word('A1'), word('A2'), word('B1'), word('B2'),
		word('C1'), word('C2'), word('C2', 'user')
	];

	it('abonelik yokken yalnızca ücretsiz seviyeler ve kullanıcı kelimeleri', () => {
		const out = accessibleWords(pool, NO_PREMIUM, NOW);
		expect(out).toHaveLength(3); // A1, A2, kullanıcı C2
		expect(out.some((w) => w.cefr === 'B1')).toBe(false);
		expect(out.some((w) => w.source === 'user')).toBe(true);
	});

	it('abonelikle hepsi erişilebilir', () => {
		const p = grantPremium(PRODUCTS.LIFETIME, { now: NOW });
		expect(accessibleWords(pool, p, NOW)).toHaveLength(pool.length);
	});

	it('süresi dolmuş abonelikte kilit geri gelir', () => {
		const p = grantPremium(PRODUCTS.MONTHLY, { now: NOW });
		expect(accessibleWords(pool, p, new Date('2026-12-01'))).toHaveLength(3);
	});

	it('kaynak diziyi değiştirmez', () => {
		const snapshot = pool.map((w) => w.id);
		accessibleWords(pool, NO_PREMIUM, NOW);
		expect(pool.map((w) => w.id)).toEqual(snapshot);
	});
});

describe('lockedSummary', () => {
	const pool = [word('A1'), word('B1'), word('B2'), word('B2'), word('C1')];

	it('kilitli sayıyı seviyeye göre verir', () => {
		const s = lockedSummary(pool, NO_PREMIUM, NOW);
		expect(s.locked).toBe(4);
		expect(s.byLevel.B2).toBe(2);
		expect(s.byLevel.A1).toBeUndefined();
	});

	it('abonelikle kilitli içerik kalmaz', () => {
		const p = grantPremium(PRODUCTS.LIFETIME, { now: NOW });
		expect(lockedSummary(pool, p, NOW).locked).toBe(0);
	});
});

describe('lockedLevels', () => {
	it('abonelik yokken B1 ve üstü kilitli', () => {
		expect(lockedLevels(NO_PREMIUM, NOW)).toEqual(['B1', 'B2', 'C1', 'C2']);
	});

	it('abonelikle hiçbiri kilitli değil', () => {
		expect(lockedLevels(grantPremium(PRODUCTS.YEARLY, { now: NOW }), NOW)).toEqual([]);
	});
});
