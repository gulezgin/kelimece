import { defineConfig } from 'vite';

export default defineConfig({
	// Göreli yollar: hem GitHub Pages alt dizininde hem de Capacitor'ın
	// yerel WebView'ünde aynı build çalışsın diye.
	base: './',

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
