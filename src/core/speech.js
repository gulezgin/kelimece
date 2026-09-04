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
function pickVoice() {
	if (!isSupported()) return null;
	if (cachedVoice) return cachedVoice;

	const voices = window.speechSynthesis.getVoices();
	if (!voices.length) return null;
	voicesReady = true;

	const english = voices.filter((v) => /^en(-|_|$)/i.test(v.lang));
	if (!english.length) return null;

	// Tercih sırası: yerel (çevrimdışı) sesler, sonra en-US, sonra ilki
	cachedVoice =
		english.find((v) => v.localService && /en-US/i.test(v.lang)) ||
		english.find((v) => v.localService) ||
		english.find((v) => /en-US/i.test(v.lang)) ||
		english[0];

	return cachedVoice;
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
 * @param {{rate?: number}} [options] rate: 0.5 (yavaş) - 1 (normal)
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

export function speak(text, { rate = null } = {}) {
	if (!isSupported()) return false;
	const value = String(text || '').trim();
	if (!value) return false;

	try {
		// Önceki konuşmayı kes: hızlı tıklamalarda kuyruk birikmesin.
		window.speechSynthesis.cancel();

		const utterance = new SpeechSynthesisUtterance(value);
		const voice = pickVoice();
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
