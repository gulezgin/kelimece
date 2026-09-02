/**
 * Satın alma katmanı.
 *
 * DURUM: Bu dosya arayüz sözleşmesini ve akışı tanımlar; Google Play
 * Billing eklentisi HENÜZ BAĞLI DEĞİL. Sebep: gerçek satın alma
 * akışı yalnızca imzalı bir AAB ve Play Console'da tanımlı ürünlerle
 * test edilebiliyor. Bağlama adımları ANDROID.md bölüm 12'de.
 *
 * Şu an:
 *   - Tarayıcıda ve Play kurulumu yapılmamış Android'de `available:false`
 *     döner; arayüz "yakında" der ve satın alma denemez.
 *   - `restore()` her ortamda çağrılabilir (Play politikası satın
 *     almaları geri yükleme yolunu zorunlu tutuyor).
 *
 * Fiyatlar Play Console'dan gelir; buradaki değerler yalnızca eklenti
 * yokken gösterilecek yer tutuculardır.
 */
import { PRODUCTS } from '../core/entitlements.js';

/**
 * Türkiye pazarı için önerilen fiyatlandırma.
 *
 * Gerekçe: TR'de dil öğrenme uygulamalarının ARPU'su düşük ve rakip
 * (Duolingo) ücretsiz katmanı cömert. Yıllık planı öne çıkarmak,
 * aylık ödemeye göre hem elde tutmayı hem de toplam geliri artırıyor.
 * Ömür boyu seçeneği, aboneliğe mesafeli kullanıcıyı yakalıyor.
 */
export const PRICING = [
	{
		id: PRODUCTS.MONTHLY,
		title: 'Aylık',
		price: '₺59',
		period: '/ay',
		note: null,
		badge: null
	},
	{
		id: PRODUCTS.YEARLY,
		title: 'Yıllık',
		price: '₺399',
		period: '/yıl',
		note: 'Ayda ₺33 — %44 tasarruf',
		badge: 'En avantajlı'
	},
	{
		id: PRODUCTS.LIFETIME,
		title: 'Ömür boyu',
		price: '₺899',
		period: 'tek seferlik',
		note: 'Abonelik yok, bir kez öde',
		badge: null
	}
];

let plugin = null;
let checked = false;

/**
 * Play Billing eklentisi yüklü mü?
 *
 * Eklentiye Capacitor'ın çalışma zamanı kaydından erişiliyor
 * (`Capacitor.Plugins`), doğrudan `import` ile değil. Sebep: eklenti
 * henüz bir bağımlılık değil ve statik import derlemeyi kırıyor.
 * Bu yolla, eklenti ANDROID.md'deki adımlarla kurulduğunda kod
 * değişikliği gerekmeden devreye giriyor.
 */
async function getPlugin() {
	if (checked) return plugin;
	checked = true;
	try {
		const core = await import('@capacitor/core');
		const Capacitor = core.Capacitor;
		if (!Capacitor?.isNativePlatform?.()) return null;
		plugin = Capacitor.Plugins?.InAppPurchases || null;
	} catch {
		plugin = null;
	}
	return plugin;
}

/**
 * Satın alma bu cihazda yapılabilir mi?
 * @returns {Promise<{available: boolean, reason?: string}>}
 */
export async function getStatus() {
	const p = await getPlugin();
	if (p) return { available: true };
	return {
		available: false,
		reason: 'Satın alma yalnızca Google Play üzerinden kurulmuş uygulamada yapılabilir.'
	};
}

/**
 * Ürün listesini döner. Eklenti varsa gerçek fiyatlar Play'den gelir,
 * yoksa yer tutucu fiyatlar.
 */
export async function getProducts() {
	const p = await getPlugin();
	if (!p) return PRICING;

	try {
		const result = await p.getProducts({ productIds: PRICING.map((x) => x.id) });
		// Play'den gelen yerel para birimli fiyatı kullan
		return PRICING.map((item) => {
			const live = (result.products || []).find((x) => x.productId === item.id);
			return live ? { ...item, price: live.price, period: item.period } : item;
		});
	} catch {
		return PRICING;
	}
}

/**
 * Satın alma akışını başlatır.
 *
 * @param {string} productId
 * @returns {Promise<{ok: boolean, product?: string, reason?: string}>}
 */
export async function purchase(productId) {
	const p = await getPlugin();
	if (!p) {
		return { ok: false, reason: 'unavailable' };
	}
	try {
		const result = await p.purchase({ productId });
		// Dogrulama sunucusuz yapiliyor; kullanici sayisi artinca
		// Play Developer API ile sunucu tarafi dogrulama eklenmeli.
		if (result && result.responseCode === 0) {
			return { ok: true, product: productId };
		}
		return { ok: false, reason: 'cancelled' };
	} catch (e) {
		return { ok: false, reason: (e && e.message) || 'error' };
	}
}

/**
 * Önceki satın almaları geri yükler.
 * Play politikası bu yolu zorunlu tutuyor: cihaz değiştiren ya da
 * uygulamayı yeniden kuran kullanıcı ödediğini geri alabilmeli.
 *
 * @returns {Promise<{ok: boolean, product?: string, reason?: string}>}
 */
export async function restore() {
	const p = await getPlugin();
	if (!p) return { ok: false, reason: 'unavailable' };

	try {
		const result = await p.restorePurchases();
		const owned = (result.purchases || []).find((x) =>
			PRICING.some((item) => item.id === x.productId)
		);
		return owned ? { ok: true, product: owned.productId } : { ok: false, reason: 'none' };
	} catch (e) {
		return { ok: false, reason: (e && e.message) || 'error' };
	}
}
