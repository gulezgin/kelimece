import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Capacitor'ın yerel WebView'ünde servis çalışanı gereksiz (varlıklar
 * zaten cihazda) ve bazı sürümlerde sorun çıkarabiliyor. Android build'i
 * alırken CAP=1 ile kapatılıyor: `CAP=1 npm run build`
 */
const forCapacitor = process.env.CAP === '1';

export default defineConfig({
	// Göreli yollar: hem GitHub Pages alt dizininde hem de Capacitor'ın
	// yerel WebView'ünde aynı build çalışsın diye.
	base: './',

	plugins: forCapacitor
		? []
		: [
				VitePWA({
					registerType: 'autoUpdate',
					includeAssets: ['favicon.png', 'icons/apple-touch-icon.png'],
					manifest: {
						name: 'Kelimece - İngilizce Öğren',
						short_name: 'Kelimece',
						description:
							'Aralıklı tekrar ile A1-C2 arası İngilizce kelime öğrenme. Tüm veriler cihazında kalır.',
						lang: 'tr',
						dir: 'ltr',
						start_url: './',
						scope: './',
						display: 'standalone',
						orientation: 'portrait',
						background_color: '#0f1320',
						theme_color: '#0f1320',
						categories: ['education', 'productivity'],
						icons: [
							{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
							{ src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
							{
								src: 'icons/maskable-512.png',
								sizes: '512x512',
								type: 'image/png',
								purpose: 'maskable'
							}
						]
					},
					workbox: {
						// İçerik paketi 500KB+; varsayılan 2MB sınırı yeterli değil olabilir
						maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
						globPatterns: ['**/*.{js,css,html,png,svg,json}'],
						cleanupOutdatedCaches: true
					},
					devOptions: {
						// Geliştirme sırasında servis çalışanı kapalı: önbellek
						// karışıklığı hata ayıklamayı zorlaştırıyor.
						enabled: false
					}
				})
			],

	server: {
		port: 5173,
		open: false
	},

	build: {
		outDir: 'dist',
		emptyOutDir: true,
		// Kaynak haritaları hata ayıklamayı kolaylaştırır, boyutu çok artırmaz.
		sourcemap: true,
		target: 'es2020'
	},

	test: {
		environment: 'node',
		include: ['test/**/*.test.js']
	}
});
