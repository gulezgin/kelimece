/**
 * Telaffuz — tarayıcının konuşma sentezi (Web Speech API).
 *
 * Neden bu: ses dosyası üretip paketlemek 2500 kelime için yüzlerce MB
 * demek. Web Speech API hem ücretsiz hem çevrimdışı (sesler cihazda) ve
 * Android WebView'de (Chrome tabanlı) çalışıyor.
 *
 * Sınırlama: ses kalitesi cihaza göre değişir ve bazı masaüstü
 * tarayıcılarda İngilizce ses hiç kurulu olmayabilir. Bu yüzden her çağrı
 * korumalı ve arayüz, destek yoksa düğmeyi hiç göstermiyor.
 */

let cachedVoice = null;
let voicesReady = false;

/**
 * Kullanıcının seçtiği aksan (ör. 'en-GB'). Boş = otomatik.
 *
 * Hangi aksanların bulunduğu TAMAMEN cihaza bağlı. Arayüz bu yüzden
 * sabit bir liste göstermiyor, `availableAccents()` ile cihazda gerçekten
 * kurulu olanları soruyor — olmayan bir aksanı seçtirip sessizce
 * Amerikan sesi çalmak kullanıcıyı yanıltır.
 */
let userAccent = '';

/** Bilinen İngilizce aksanların Türkçe adları. */
export const ACCENT_LABELS = {
	'en-US': 'Amerikan',
	'en-GB': 'İngiliz',
	'en-AU': 'Avustralya',
	'en-CA': 'Kanada',
	'en-IE': 'İrlanda',
	'en-IN': 'Hindistan',
	'en-NZ': 'Yeni Zelanda',
	'en-ZA': 'Güney Afrika'
};

/**
 * Ses listesini aksanlara göre gruplar.
 *
 * Saf fonksiyon: `SpeechSynthesisVoice` dizisi yerine sade nesne dizisi
 * alıyor, böylece tarayıcısız test edilebiliyor.
 */
export function groupAccents(voices) {
	const gruplar = new Map();
	for (const v of voices || []) {
		const lang = String(v.lang || '').replace('_', '-');
		if (!/^en-/i.test(lang)) continue;
		// 'en-us' ve 'en-US' ayni aksan; normalize edilmezse listede
		// iki kez gorunuyor.
		const key = lang.slice(0, 2).toLowerCase() + '-' + lang.slice(3).toUpperCase();
		if (!gruplar.has(key)) gruplar.set(key, { lang: key, label: ACCENT_LABELS[key] || key, count: 0, local: false });
		const g = gruplar.get(key);
		g.count++;
		if (v.localService) g.local = true;
	}
	// Bilinen aksanlar once, sonra alfabetik: kullanicinin arayacagi
	// Amerikan ve Ingiliz listenin dibinde kalmasin.
	const bilinen = Object.keys(ACCENT_LABELS);
	return [...gruplar.values()].sort((a, b) => {
		const ia = bilinen.indexOf(a.lang);
		const ib = bilinen.indexOf(b.lang);
		if (ia !== ib) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
		return a.lang.localeCompare(b.lang);
	});
}

/** Cihazda gerçekten kurulu olan İngilizce aksanlar. */
export function availableAccents() {
	if (!isSupported()) return [];
	return groupAccents(window.speechSynthesis.getVoices());
}

/** Seçili aksan. */
export function getAccent() {
	return userAccent;
}

/** Aksanı ayarlar; önbelleği düşürür ki sonraki konuşma yeni sesi alsın. */
export function setAccent(lang) {
	userAccent = String(lang || '');
	cachedVoice = null;
}

/** Tarayıcı konuşma sentezini destekliyor mu? */
export function isSupported() {
	return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

/**
 * En uygun İngilizce sesi seçer.
 *
 * Sesler tarayıcıda eşzamansız yükleniyor; ilk çağrıda boş dönebilir,
 * bu yüzden 'voiceschanged' olayı da dinleniyor.
 */
function pickVoice(accent = null) {
	if (!isSupported()) return null;
	const istenen = accent === null ? userAccent : accent;
	if (!istenen && cachedVoice) return cachedVoice;

	const voices = window.speechSynthesis.getVoices();
	if (!voices.length) return null;
	voicesReady = true;

	const english = voices.filter((v) => /^en(-|_|$)/i.test(v.lang));
	if (!english.length) return null;

	// Istenen aksan varsa once onun icinde ara. Yoksa SESSIZCE genel
	// secime dusuyor; alternatif, hic konusmamak olurdu ve o daha kotu.
	const aday = istenen
		? english.filter((v) => String(v.lang).replace('_', '-').toLowerCase() === istenen.toLowerCase())
		: [];
	const havuz = aday.length ? aday : english;

	// Tercih sırası: yerel (çevrimdışı) sesler, sonra en-US, sonra ilki
	const secim =
		havuz.find((v) => v.localService && /en-US/i.test(v.lang)) ||
		havuz.find((v) => v.localService) ||
		havuz.find((v) => /en-US/i.test(v.lang)) ||
		havuz[0];

	// Gecici aksan istegi onbellegi kirletmemeli.
	if (accent === null) cachedVoice = secim;
	return secim;
}

/** Sesler hazır olduğunda önbelleği doldur. */
if (isSupported()) {
	window.speechSynthesis.addEventListener?.('voiceschanged', () => {
		cachedVoice = null;
		pickVoice();
	});
	pickVoice();
}

/**
 * İngilizce sesin kullanılabilir olup olmadığı.
 * Arayüz telaffuz düğmesini buna göre gösterir.
 */
export function hasEnglishVoice() {
	if (!isSupported()) return false;
	// Sesler henüz yüklenmediyse iyimser davran: düğme görünsün,
	// ilk tıklamada sesler çoğunlukla hazır oluyor.
	return !voicesReady || !!pickVoice();
}

/**
 * Metni seslendirir.
 *
 * @param {string} text
 * @param {{rate?: number, accent?: string|null}} [options]
 *   rate: 0.5 (yavaş) - 1 (normal); accent: tek seferlik aksan (ör. 'en-GB')
 * @returns {boolean} Konuşma başlatılabildi mi
 */
/**
 * Kullanıcının seçtiği okuma hızı.
 *
 * Modül düzeyinde tutuluyor çünkü `speak()` uygulamanın onlarca
 * yerinden çağrılıyor; hızı her çağrıya parametre olarak taşımak
 * her çağrı noktasını ayara bağımlı hale getirirdi.
 */
let userRate = 0.9;

/** Okuma hızını ayarlar (0.5–1.5 arası kırpılır). */
export function setRate(rate) {
	const r = Number(rate);
	if (!Number.isFinite(r)) return;
	userRate = Math.min(1.5, Math.max(0.5, r));
}

/** Geçerli okuma hızı. */
export function getRate() {
	return userRate;
}

export function speak(text, { rate = null, accent = null } = {}) {
	if (!isSupported()) return false;
	const value = String(text || '').trim();
	if (!value) return false;

	try {
		// Önceki konuşmayı kes: hızlı tıklamalarda kuyruk birikmesin.
		window.speechSynthesis.cancel();

		const utterance = new SpeechSynthesisUtterance(value);
		const voice = pickVoice(accent);
		if (voice) utterance.voice = voice;
		utterance.lang = voice ? voice.lang : 'en-US';
		utterance.rate = rate === null ? userRate : rate;
		utterance.pitch = 1;

		window.speechSynthesis.speak(utterance);
		return true;
	} catch {
		return false;
	}
}

/** Devam eden konuşmayı durdurur. */
export function stop() {
	if (!isSupported()) return;
	try {
		window.speechSynthesis.cancel();
	} catch {
		// yoksay
	}
}
