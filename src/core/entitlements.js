/**
 * Erişim hakları: neyin ücretsiz, neyin abonelikle açıldığı.
 *
 * SEÇİLEN MODEL — A1 ve A2 tamamen ücretsiz, B1 ve üstü abonelikle.
 *
 * Neden bu sınır:
 *   - Ücretsiz katman 1705 kelimeyle kendi başına işe yarar bir ürün.
 *     Yarım bırakılmış bir deneme değil; başlangıç seviyesini gerçekten
 *     bitirebilirsin. Bu hem dürüst hem de mağaza puanları için iyi.
 *   - Ödeme isteyen nokta, kullanıcının uygulamadan fayda gördüğünü
 *     zaten kanıtladığı yer: A2'yi bitirip B1'e geçmek isteyen kişi
 *     ciddi öğrenendir.
 *   - Duolingo'nun zayıf olduğu yer de tam olarak burası (B1 sonrası),
 *     yani rekabetin en az olduğu yerde ücret isteniyor.
 *
 * Kullanıcının KENDİ eklediği kelimeler her zaman erişilebilir —
 * kendi verisine erişimi kısıtlamak kabul edilemez.
 *
 * Saf mantık: DOM'a, depolamaya ve ödeme altyapısına dokunmaz.
 */

export const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

/** Abonelik olmadan açık seviyeler. */
export const FREE_LEVELS = ['A1', 'A2'];

/** Abonelik ürünleri. Kimlikler Play Console'daki ile birebir aynı olmalı. */
export const PRODUCTS = {
	MONTHLY: 'premium_monthly',
	YEARLY: 'premium_yearly',
	LIFETIME: 'premium_lifetime'
};

/**
 * @typedef {object} Premium
 * @property {boolean} active
 * @property {string|null} since      ISO tarih
 * @property {string|null} product    Satın alınan ürün kimliği
 * @property {string|null} expiresAt  Abonelik bitişi (ömür boyu için null)
 */

/** Varsayılan: abonelik yok. */
export const NO_PREMIUM = { active: false, since: null, product: null, expiresAt: null };

/**
 * Abonelik şu an geçerli mi?
 * Süresi geçmiş abonelik pasif sayılır.
 */
export function isPremiumActive(premium, now = new Date()) {
	if (!premium || !premium.active) return false;
	if (!premium.expiresAt) return true; // ömür boyu
	const end = new Date(premium.expiresAt);
	return !Number.isNaN(end.getTime()) && end > now;
}

/**
 * Bu seviye açık mı?
 * @param {string|null} cefr
 * @param {object} premium
 */
export function isLevelUnlocked(cefr, premium, now = new Date()) {
	if (isPremiumActive(premium, now)) return true;
	// Seviyesi olmayan kelimeler (kullanıcının kendi eklemeleri) açık
	if (!cefr) return true;
	return FREE_LEVELS.includes(cefr);
}

/**
 * Bu kelimeye erişilebilir mi?
 * Kullanıcının kendi eklediği kelime her zaman erişilebilir.
 */
export function isWordUnlocked(word, premium, now = new Date()) {
	if (!word) return false;
	if (word.source === 'user') return true;
	return isLevelUnlocked(word.cefr, premium, now);
}

/**
 * Erişilebilir kelimeleri süzer.
 * @returns {object[]}
 */
export function accessibleWords(words, premium, now = new Date()) {
	if (isPremiumActive(premium, now)) return words;
	return words.filter((w) => isWordUnlocked(w, premium, now));
}

/**
 * Kilitli içeriğin özeti — paywall'da "ne kazanacaksın" demek için.
 */
export function lockedSummary(words, premium, now = new Date()) {
	if (isPremiumActive(premium, now)) {
		return { locked: 0, byLevel: {}, total: words.length };
	}

	const byLevel = {};
	let locked = 0;
	for (const w of words) {
		if (isWordUnlocked(w, premium, now)) continue;
		locked++;
		const key = w.cefr || '—';
		byLevel[key] = (byLevel[key] || 0) + 1;
	}
	return { locked, byLevel, total: words.length };
}

/** Kilitli seviyeler, öğrenme sırasıyla. */
export function lockedLevels(premium, now = new Date()) {
	if (isPremiumActive(premium, now)) return [];
	return CEFR_ORDER.filter((l) => !FREE_LEVELS.includes(l));
}

/**
 * Satın alma sonucundan abonelik durumu üretir.
 *
 * @param {string} product PRODUCTS içinden
 * @param {{now?: Date}} [options]
 */
export function grantPremium(product, { now = new Date() } = {}) {
	const since = now.toISOString();
	let expiresAt = null;

	if (product === PRODUCTS.MONTHLY) {
		const d = new Date(now);
		d.setMonth(d.getMonth() + 1);
		expiresAt = d.toISOString();
	} else if (product === PRODUCTS.YEARLY) {
		const d = new Date(now);
		d.setFullYear(d.getFullYear() + 1);
		expiresAt = d.toISOString();
	}
	// LIFETIME -> expiresAt null

	return { active: true, since, product, expiresAt };
}
