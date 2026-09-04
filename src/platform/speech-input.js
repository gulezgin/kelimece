/**
 * Konuşma tanıma (mikrofon → metin).
 *
 * İki yol var ve ikisi de ÜCRETSİZ:
 *   Android → @capacitor-community/speech-recognition (cihazın kendi
 *             tanıyıcısı; Capacitor'ın çalışma zamanı kaydından
 *             okunuyor, statik import derlemeyi kırar)
 *   Tarayıcı → Web Speech API
 *
 * Eklenti kurulu değilse Android'de tanıma çalışmaz ve `isSupported()`
 * false döner; arayüz konuşma alıştırmasını göstermez. Bunu sessizce
 * geçmek, kullanıcıya çalışmayan bir mikrofon düğmesi göstermek olurdu.
 * Kurulum: ANDROID.md bölüm 13.
 */

let plugin = null;
let checked = false;

async function nativePlugin() {
	if (checked) return plugin;
	checked = true;
	try {
		const core = await import('@capacitor/core');
		const Capacitor = core.Capacitor;
		if (!Capacitor?.isNativePlatform?.()) return null;
		plugin = Capacitor.Plugins?.SpeechRecognition || null;
	} catch {
		plugin = null;
	}
	return plugin;
}

function webApi() {
	return typeof window !== 'undefined'
		? (window.SpeechRecognition || window.webkitSpeechRecognition)
		: null;
}

/** Bu cihazda konuşma tanıma var mı? */
export async function isSupported() {
	if (await nativePlugin()) return true;
	return !!webApi();
}

/** Mikrofon izni ister. */
export async function requestPermission() {
	const p = await nativePlugin();
	if (p) {
		try {
			const r = await p.requestPermissions();
			return { ok: r?.speechRecognition === 'granted' };
		} catch {
			return { ok: false, reason: 'denied' };
		}
	}
	// Web Speech API iznini kendi istiyor; ayrica sormaya gerek yok.
	return { ok: !!webApi() };
}

/**
 * Bir kez dinler ve duyduğu metni döner.
 *
 * @param {{lang?: string, timeoutMs?: number}} [options]
 * @returns {Promise<{ok: boolean, text?: string, reason?: string}>}
 */
export async function listenOnce({ lang = 'en-US', timeoutMs = 10000 } = {}) {
	const p = await nativePlugin();
	if (p) return listenNative(p, lang);
	const Web = webApi();
	if (!Web) return { ok: false, reason: 'unsupported' };
	return listenWeb(Web, lang, timeoutMs);
}

async function listenNative(p, lang) {
	try {
		const r = await p.start({
			language: lang,
			maxResults: 1,
			partialResults: false,
			popup: false
		});
		const text = (r?.matches && r.matches[0]) || '';
		return text ? { ok: true, text } : { ok: false, reason: 'no-speech' };
	} catch (e) {
		return { ok: false, reason: (e && e.message) || 'error' };
	}
}

function listenWeb(Web, lang, timeoutMs) {
	return new Promise((resolve) => {
		let bitti = false;
		const rec = new Web();
		rec.lang = lang;
		rec.interimResults = false;
		rec.maxAlternatives = 1;

		const bitir = (sonuc) => {
			if (bitti) return;
			bitti = true;
			clearTimeout(zamanlayici);
			try { rec.stop(); } catch { /* zaten durmus */ }
			resolve(sonuc);
		};

		// Kullanici hic konusmazsa Web Speech API bazen hic olay
		// uretmiyor; ekranin donmamasi icin ust sinir gerekiyor.
		const zamanlayici = setTimeout(() => bitir({ ok: false, reason: 'timeout' }), timeoutMs);

		rec.onresult = (e) => {
			const text = e?.results?.[0]?.[0]?.transcript || '';
			bitir(text ? { ok: true, text } : { ok: false, reason: 'no-speech' });
		};
		rec.onerror = (e) => {
			const kod = e?.error || 'error';
			bitir({ ok: false, reason: kod === 'not-allowed' ? 'denied' : kod });
		};
		rec.onend = () => bitir({ ok: false, reason: 'no-speech' });

		try {
			rec.start();
		} catch {
			bitir({ ok: false, reason: 'error' });
		}
	});
}

/** Hata kodunu kullanıcıya gösterilecek metne çevirir. */
export function errorText(reason) {
	if (reason === 'denied') return 'Mikrofon izni verilmedi.';
	if (reason === 'no-speech') return 'Ses duyulmadı. Biraz daha yüksek sesle dene.';
	if (reason === 'timeout') return 'Süre doldu. Tekrar dene.';
	if (reason === 'unsupported') return 'Bu cihazda konuşma tanıma yok.';
	if (reason === 'network') return 'Konuşma tanıma için internet gerekiyor.';
	return 'Kayıt alınamadı.';
}
