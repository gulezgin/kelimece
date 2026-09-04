/**
 * Konuşma kaydı.
 *
 * Ne yaptığı: mikrofondan ses kaydeder, kullanıcıya geri dinletir.
 * Ne YAPMADIĞI: telaffuz puanlamaz. Fonem düzeyinde puanlama, hizalı
 * akustik model isteyen ücretli bir hizmet; cihazda çalışan bir
 * kütüphane bunu yapamıyor. Uydurma bir "%82 telaffuz" göstermek
 * kullanıcıyı yanlış yönlendirir.
 *
 * Kendini dinlemek buna rağmen işe yarıyor ve bu modülün varlık
 * sebebi bu: insan kendi kaydında, konuşurken fark etmediği duraksama
 * ve vurgu hatalarını duyuyor.
 *
 * Ses CİHAZDAN ÇIKMIYOR. Kayıt bellekte bir Blob; sunucu yok, yükleme
 * yok. Arayüz bunu açıkça yazıyor — mikrofon isteyen bir uygulamada
 * kullanıcının ilk sorusu bu.
 */

let mediaRecorder = null;
let chunks = [];
let stream = null;
let startedAt = 0;

/** Tarayıcı kaydı destekliyor mu. */
export function isSupported() {
	return typeof window !== 'undefined'
		&& typeof MediaRecorder !== 'undefined'
		&& !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

/** Şu anda kayıt sürüyor mu. */
export function isRecording() {
	return !!mediaRecorder && mediaRecorder.state === 'recording';
}

/**
 * Desteklenen bir kayıt biçimi seçer.
 *
 * Tarayıcılar farklı biçimler destekliyor: Chrome webm/opus, Safari
 * mp4. Sabit bir mimeType vermek Safari'de sessizce boş kayıt
 * üretiyordu; boş bırakmak tarayıcının kendi varsayılanını kullanır.
 */
function pickMime() {
	const adaylar = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
	for (const m of adaylar) {
		if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) return m;
	}
	return '';
}

/**
 * Kaydı başlatır.
 *
 * @returns {Promise<{ok: boolean, reason?: string}>}
 */
export async function start() {
	if (!isSupported()) return { ok: false, reason: 'unsupported' };
	if (isRecording()) return { ok: true };

	try {
		stream = await navigator.mediaDevices.getUserMedia({ audio: true });
	} catch (err) {
		// Kullanicinin reddetmesi ile mikrofonun hic olmamasi ayri
		// seyler; arayuz farkli sey soylemeli.
		const ad = err && err.name;
		if (ad === 'NotAllowedError' || ad === 'SecurityError') return { ok: false, reason: 'denied' };
		if (ad === 'NotFoundError' || ad === 'DevicesNotFoundError') return { ok: false, reason: 'nodevice' };
		return { ok: false, reason: 'error' };
	}

	try {
		const mime = pickMime();
		mediaRecorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
	} catch {
		releaseStream();
		return { ok: false, reason: 'error' };
	}

	chunks = [];
	startedAt = Date.now();
	mediaRecorder.ondataavailable = (e) => {
		if (e.data && e.data.size) chunks.push(e.data);
	};
	mediaRecorder.start();
	return { ok: true };
}

/** Mikrofon akışını serbest bırakır — bırakılmazsa kayıt ışığı yanık kalır. */
function releaseStream() {
	if (stream) {
		for (const track of stream.getTracks()) track.stop();
		stream = null;
	}
}

/**
 * Kaydı durdurur ve sonucu döndürür.
 *
 * @returns {Promise<{ok: boolean, url?: string, blob?: Blob, seconds?: number, reason?: string}>}
 */
export function stop() {
	return new Promise((resolve) => {
		if (!mediaRecorder || mediaRecorder.state === 'inactive') {
			releaseStream();
			resolve({ ok: false, reason: 'notrecording' });
			return;
		}

		const saniye = Math.max(0, Math.round((Date.now() - startedAt) / 1000));
		mediaRecorder.onstop = () => {
			const tur = mediaRecorder && mediaRecorder.mimeType ? mediaRecorder.mimeType : 'audio/webm';
			const blob = new Blob(chunks, { type: tur });
			chunks = [];
			mediaRecorder = null;
			releaseStream();

			if (!blob.size) {
				resolve({ ok: false, reason: 'empty' });
				return;
			}
			resolve({ ok: true, blob, url: URL.createObjectURL(blob), seconds: saniye });
		};
		mediaRecorder.stop();
	});
}

/** Kaydı iptal eder; sonuç üretmez. */
export function cancel() {
	if (mediaRecorder && mediaRecorder.state !== 'inactive') {
		mediaRecorder.onstop = null;
		try { mediaRecorder.stop(); } catch { /* yoksay */ }
	}
	mediaRecorder = null;
	chunks = [];
	releaseStream();
}

/**
 * Kayıt hatalarının Türkçe açıklaması.
 *
 * Genel bir "hata oluştu" mesajı kullanıcıya ne yapacağını
 * söylemiyor; izin reddiyle mikrofon yokluğunun çözümü farklı.
 */
export function errorText(reason) {
	switch (reason) {
		case 'unsupported': return 'Bu cihazda ses kaydı desteklenmiyor.';
		case 'denied': return 'Mikrofon izni verilmedi. Tarayıcı ayarlarından izin verebilirsin.';
		case 'nodevice': return 'Mikrofon bulunamadı.';
		case 'empty': return 'Kayıt boş geldi. Mikrofonun çalıştığından emin ol.';
		case 'notrecording': return 'Kayıt başlamamıştı.';
		default: return 'Kayıt yapılamadı.';
	}
}

/**
 * Kayıt adresini serbest bırakır.
 *
 * `URL.createObjectURL` ile üretilen adres, sayfa kapanana kadar
 * bellekte tutuluyor. Her denemede yeni kayıt üretilen bir ekranda
 * bunu bırakmamak sızıntı demek.
 */
export function release(url) {
	if (url) {
		try { URL.revokeObjectURL(url); } catch { /* yoksay */ }
	}
}
