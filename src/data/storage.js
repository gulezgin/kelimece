/**
 * Kalıcı depolama katmanı.
 *
 * Uygulamanın geri kalanı localStorage'ı doğrudan bilmez; sadece bu
 * modülü çağırır. Faz 1'de IndexedDB'ye geçerken değişecek tek yer burası.
 */

const WORDS_KEY = 'word_pool_v1';
const SETTINGS_KEY = 'word_pool_settings_v1';

export const DEFAULT_SETTINGS = {
	dailyGoal: 10,
	todayAdded: 0,
	today: null
};

/** @returns {unknown[]} Ham kelime dizisi (normalize EDİLMEMİŞ). */
export function loadWords() {
	try {
		const raw = localStorage.getItem(WORDS_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

/** @returns {object} */
export function loadSettings() {
	try {
		const raw = localStorage.getItem(SETTINGS_KEY);
		if (!raw) return { ...DEFAULT_SETTINGS };
		return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
	} catch {
		return { ...DEFAULT_SETTINGS };
	}
}

/**
 * @param {object[]} words
 * @param {object} settings
 * @returns {{ok: true} | {ok: false, error: string}}
 */
export function persist(words, settings) {
	try {
		localStorage.setItem(WORDS_KEY, JSON.stringify(words));
		localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
		return { ok: true };
	} catch (e) {
		// En olası sebep localStorage kotasının dolması (~5MB).
		// Sessizce yutulursa kullanıcı verisini kaybettiğini fark etmez.
		return {
			ok: false,
			error: e && e.name === 'QuotaExceededError'
				? 'Tarayıcı depolama alanı doldu. Lütfen JSON yedeği alın.'
				: 'Kayıt başarısız: ' + (e && e.message ? e.message : 'bilinmeyen hata')
		};
	}
}

export function wipe() {
	localStorage.removeItem(WORDS_KEY);
	localStorage.removeItem(SETTINGS_KEY);
}

/** Depoda kayıtlı verinin yaklaşık boyutu (byte). */
export function approximateSize() {
	try {
		return (localStorage.getItem(WORDS_KEY) || '').length;
	} catch {
		return 0;
	}
}
