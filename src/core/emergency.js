/**
 * Acil İngilizce.
 *
 * Üç karar bu modülü diğerlerinden ayırıyor:
 *
 * 1. **Hiçbir zaman kilitli değil.** Abonelik duvarının arkasına
 *    konmuş bir acil durum özelliği, gerektiği anda işe yaramaz.
 *    Bu yüzden `entitlements.js` burada hiç çağrılmıyor.
 * 2. **"Duyabileceklerin" bölümü var.** Sıradan konuşma kılavuzları
 *    yalnızca ne söyleyeceğini yazıyor; asıl panik, karşıdakinin
 *    cevabını anlamamaktan çıkıyor.
 * 3. **Aranabilir.** Panik anında altı başlığın arasında gezinmek
 *    yerine "çalındı" yazıp bulmak gerekiyor.
 *
 * Saf mantık: depoya ve DOM'a dokunmaz.
 */

/**
 * Türkçe arama için sadeleştirir.
 *
 * Türkçe küçük harfe çevirme İngilizce kuralıyla yapılırsa "İ" → "i̇"
 * (birleşik nokta) çıkıyor ve arama eşleşmiyor. Ayrıca kullanıcı
 * telefonda çoğu zaman "calindi" yazıyor, "çalındı" değil.
 */
export function fold(text) {
	return String(text || '')
		.toLocaleLowerCase('tr')
		.replace(/ı/g, 'i')
		.replace(/İ/g, 'i')
		.replace(/ş/g, 's')
		.replace(/ğ/g, 'g')
		.replace(/ü/g, 'u')
		.replace(/ö/g, 'o')
		.replace(/ç/g, 'c')
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '');
}

/** Durum listesi özeti. */
export function situationSummaries(pack) {
	return ((pack && pack.situations) || []).map((s) => ({
		id: s.id,
		icon: s.icon,
		title: s.title,
		summary: s.summary,
		count: (s.say || []).length + (s.hear || []).length
	}));
}

/** Kimliğe göre durum. */
export function findSituation(pack, id) {
	return ((pack && pack.situations) || []).find((s) => s.id === id) || null;
}

/**
 * Tüm cümlelerde arama.
 *
 * Sonuç, cümlenin hangi durumdan ve hangi yönden ("söyle" / "duy")
 * geldiğini taşıyor: bağlamsız bir cümle listesi, kullanıcının
 * doğru olanı seçmesini zorlaştırıyor.
 */
export function searchPhrases(pack, query) {
	const q = fold(query).trim();
	if (!q) return [];

	const out = [];
	const ekle = (p, kaynak, yon) => {
		if (fold(p.en).includes(q) || fold(p.tr).includes(q)) {
			out.push({ ...p, source: kaynak, direction: yon });
		}
	};

	for (const p of (pack && pack.critical) || []) ekle(p, 'Acil', 'say');
	for (const s of (pack && pack.situations) || []) {
		for (const p of s.say || []) ekle(p, s.title, 'say');
		for (const p of s.hear || []) ekle(p, s.title, 'hear');
	}
	return out;
}

/** İçerik dosyasını indirir. */
export async function loadEmergency(url) {
	const res = await fetch(url);
	if (!res.ok) throw new Error('Acil İngilizce içeriği yüklenemedi');
	return res.json();
}
