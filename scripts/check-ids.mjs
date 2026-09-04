/**
 * `$('id')` ile aranan her kimlik `index.html`'de var mı?
 *
 * Bu denetim var çünkü aynı hata iki kez oldu ve ikisinde de build VE
 * testler geçti: `index.html`'den bir eleman kaldırılınca ona bakan
 * `$('...')` çağrısı `null` dönüyor, `null.addEventListener` açılışın
 * TAMAMINI kırıyor ve uygulama boş ekranda kalıyor.
 *
 * Testler yakalamıyor çünkü test ortamında DOM yok; build yakalamıyor
 * çünkü sözdizimi geçerli. Tek yakalayan şey bu karşılaştırma.
 *
 * Çalışma zamanında üretilen elemanlar `RUNTIME_IDS` içinde muaf
 * tutuluyor — onları `index.html`'e koymak, var olmayan bir sözleşme
 * uydurmak olurdu.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Çizim sırasında üretilen, `index.html`'de bulunmayan kimlikler. */
const RUNTIME_IDS = new Set([
	// ui/exam.js konusma sayaci; updateClock() null kontrolu yapiyor.
	'examClock',
	// ui/dialog.js toast kabini; ilk toast'ta olusturuluyor.
	'toastHost',
	// ui/emergency.js gosterim katmani; body'ye ekleniyor ve
	// kapatilinca kaldiriliyor.
	'emShowOverlay'
]);

/*
 * `import.meta.url` yerine `fileURLToPath` sart: ASCII disi kullanici
 * adinda `URL.pathname` yuzde-kodlu geliyor ("ms%C4%B1") ve klasor
 * bulunamiyor. Bu projede ayni Windows tuzaginin ucuncu goruldugu yer.
 */
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

function sourceFiles() {
	const out = [join(ROOT, 'src/main.js')];
	for (const klasor of ['src/ui', 'src/platform', 'src/core', 'src/data']) {
		const dizin = join(ROOT, klasor);
		for (const ad of readdirSync(dizin)) {
			if (ad.endsWith('.js')) out.push(join(dizin, ad));
		}
	}
	return out;
}

function usedIds() {
	const bulunan = new Map();
	// $('foo') ve getElementById('foo') iki yazim da taraniyor.
	const desen = /(?:\$|getElementById)\(\s*['"]([A-Za-z0-9_-]+)['"]\s*\)/g;
	for (const dosya of sourceFiles()) {
		const metin = readFileSync(dosya, 'utf8');
		for (const eslesme of metin.matchAll(desen)) {
			const id = eslesme[1];
			if (!bulunan.has(id)) bulunan.set(id, []);
			bulunan.get(id).push(dosya.slice(ROOT.length));
		}
	}
	return bulunan;
}

function htmlIds() {
	const metin = readFileSync(join(ROOT, 'index.html'), 'utf8');
	const out = new Set();
	for (const eslesme of metin.matchAll(/id="([A-Za-z0-9_-]+)"/g)) out.add(eslesme[1]);
	return out;
}

const kullanilan = usedIds();
const mevcut = htmlIds();
const eksik = [...kullanilan.keys()].filter((id) => !mevcut.has(id) && !RUNTIME_IDS.has(id));

// Tekrar eden kimlik de sorun: getElementById ilkini donduruyor ve
// ikincisine yazan kod sessizce yanlis elemana bakiyor.
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
const sayim = new Map();
for (const eslesme of html.matchAll(/id="([A-Za-z0-9_-]+)"/g)) {
	sayim.set(eslesme[1], (sayim.get(eslesme[1]) || 0) + 1);
}
const tekrar = [...sayim.entries()].filter(([, n]) => n > 1);

if (!eksik.length && !tekrar.length) {
	console.log(`✓ ${kullanilan.size} kimlik denetlendi, hepsi index.html'de.`);
	process.exit(0);
}

for (const id of eksik) {
	console.error(`✗ "${id}" index.html'de yok — kullanan: ${kullanilan.get(id).join(', ')}`);
}
for (const [id, n] of tekrar) {
	console.error(`✗ "${id}" index.html'de ${n} kez geçiyor.`);
}
console.error('\nAçılış bu yüzden kırılır: $() null döner, null.addEventListener atar.');
process.exit(1);
