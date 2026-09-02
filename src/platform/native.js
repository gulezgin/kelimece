/**
 * Yerel platform (Capacitor) entegrasyonu.
 *
 * Tarayıcıda çalışırken hiçbir şey yapmaz — aynı kod tabanı hem web hem
 * Android'de çalışsın diye her çağrı korumalı. Capacitor eklentileri
 * yalnızca yerel ortamda dinamik olarak yüklenir, böylece web paketine
 * gereksiz kod girmez.
 */

let capacitor = null;

/** Uygulama yerel bir kabuk içinde mi çalışıyor? */
export async function isNative() {
	if (capacitor === null) {
		try {
			const mod = await import('@capacitor/core');
			capacitor = mod.Capacitor;
		} catch {
			capacitor = false;
		}
	}
	return !!(capacitor && capacitor.isNativePlatform && capacitor.isNativePlatform());
}

/**
 * Yerel kabuğu hazırlar: durum çubuğu rengi, açılış ekranının
 * kapatılması ve geri tuşu davranışı.
 *
 * @param {{onBack: () => boolean}} handlers
 *   onBack true dönerse geri tuşu yutulur (bir katman kapatıldı),
 *   false dönerse varsayılan davranış (uygulamadan çık) uygulanır.
 */
export async function setupNative({ onBack }) {
	if (!(await isNative())) return false;

	// Tam ekran: durum çubuğu gizleniyor ve web görünümü tüm ekranı
	// kaplıyor. Saat/pil şeridi çalışma ekranında dikkat dağıtıyordu.
	//
	// Çentikli telefonlarda içeriğin kamera deliğinin altında kalmaması
	// için CSS tarafında env(safe-area-inset-*) dolgusu var; bu yüzden
	// overlaysWebView açık olmasına rağmen başlık kesilmiyor.
	try {
		const { StatusBar, Style } = await import('@capacitor/status-bar');
		await StatusBar.setStyle({ style: Style.Dark });
		await StatusBar.setOverlaysWebView({ overlay: true });
		await StatusBar.hide();
	} catch {
		// Durum çubuğu eklentisi yoksa sessizce geç
	}

	// Açılış ekranı: uygulama gerçekten hazır olduğunda kapansın,
	// sabit bir süre sonra değil.
	try {
		const { SplashScreen } = await import('@capacitor/splash-screen');
		await SplashScreen.hide();
	} catch {
		// yoksay
	}

	// Android geri tuşu: açık bir katman varsa onu kapat, yoksa çık.
	try {
		const { App } = await import('@capacitor/app');
		App.addListener('backButton', ({ canGoBack }) => {
			if (onBack && onBack()) return;
			if (canGoBack) window.history.back();
			else App.exitApp();
		});
	} catch {
		// yoksay
	}

	return true;
}
