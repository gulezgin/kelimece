/**
 * CEFR atamalarını kullanım sıklığıyla karşılaştırır.
 *
 * Neden sıklık: gerçek seviyelendirilmiş kelime listeleri (Oxford 3000,
 * CEFR-J vb.) temelde sıklık verisine dayanır. Sık kullanılan kelime erken
 * öğrenilir. Bu yüzden sıklık, seviye ataması için elimizdeki en nesnel
 * ölçüt.
 *
 * ÖNEMLİ SINIRLAMA: kullanılan liste OpenSubtitles (film/dizi altyazısı)
 * korpusundan geliyor. Konuşma dili ağırlıklı, bu yüzden:
 *   - Günlük/argo kelimeler olduğundan sık görünür.
 *   - Akademik kelimeler ("furthermore", "hypothesis") olduğundan seyrek
 *     görünür ve hak ettiğinden yüksek seviyeye atanır.
 * Bu yüzden sıklık TEK karar verici değil, ikinci bir görüş olarak
 * kullanılıyor: iki kaynak 2+ seviye ayrışıyorsa kayıt incelenir.
 *
 * Kaynak: hermitdave/FrequencyWords (MIT), OpenSubtitles 2018.
 *
 * Çalıştırma: node scripts/analyze-cefr.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

/** Sıklık sırası -> CEFR bandı. Sınırlar yaygın seviyelendirme pratiğine yakın. */
const BANDS = [
	{ max: 800, level: 'A1' },
	{ max: 1800, level: 'A2' },
	{ max: 3500, level: 'B1' },
	{ max: 7000, level: 'B2' },
	{ max: 15000, level: 'C1' },
	{ max: Infinity, level: 'C2' }
];

export function bandFor(rank) {
	if (!rank) return null;
	return BANDS.find((b) => rank <= b.max).level;
}

/** en_50k.txt -> Map(kelime -> sıra) */
export function loadFrequency() {
	const text = readFileSync(join(ROOT, 'data/sources/en_50k.txt'), 'utf8');
	const rank = new Map();
	let i = 0;
	for (const line of text.split('\n')) {
		const word = line.split(' ')[0];
		if (!word) continue;
		i++;
		if (!rank.has(word)) rank.set(word, i);
	}
	return rank;
}

/**
 * Bir girdinin sıklık sırası. Yalnızca TEK kelimeler için.
 *
 * Çok kelimeli girdiler (öbek fiiller, kalıplar) kasıtlı olarak dışarıda:
 * bir öbeğin zorluğu bileşenlerinin sıklığından okunamaz. "look up"
 * bileşenlerine bakılırsa A1 çıkar (ikisi de çok sık), oysa "arayıp bulmak"
 * anlamındaki öbek fiil B1 seviyesidir. Bu tür girdilerde elle atanan
 * seviye tek kaynağımız.
 */
export function rankOf(en, freq) {
	const key = en.toLowerCase().trim();
	if (/[\s-]/.test(key)) return null;
	return freq.get(key) || null;
}

// ===================== Rapor =====================

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const freq = loadFrequency();
	const pack = JSON.parse(readFileSync(join(ROOT, 'public/content/core-v1.json'), 'utf8'));

	const rows = pack.words.map((w) => {
		const rank = rankOf(w.en, freq);
		return { en: w.en, tr: w.tr, mine: w.cefr, rank, band: bandFor(rank) };
	});

	const matched = rows.filter((r) => r.band);
	const gap = (r) => LEVELS.indexOf(r.band) - LEVELS.indexOf(r.mine);

	console.log('=== SIKLIK KARŞILAŞTIRMASI ===');
	console.log(`  Paket kelimesi          : ${rows.length}`);
	console.log(`  Sıklık listesinde bulunan: ${matched.length}`);
	console.log(`  Bulunamayan             : ${rows.length - matched.length}`);

	const dist = {};
	for (const r of matched) {
		const g = gap(r);
		dist[g] = (dist[g] || 0) + 1;
	}
	console.log('');
	console.log('  Fark dağılımı (sıklık bandı - benim atamam):');
	for (const k of Object.keys(dist).map(Number).sort((a, b) => a - b)) {
		const pct = ((dist[k] / matched.length) * 100).toFixed(1);
		const label = k === 0 ? 'aynı' : (k > 0 ? `+${k} (sıklık daha ileri der)` : `${k} (sıklık daha kolay der)`);
		console.log(`    ${String(label).padEnd(30)} ${String(dist[k]).padStart(5)}  %${pct}`);
	}

	const agree = (dist[0] || 0) + (dist[1] || 0) + (dist[-1] || 0);
	console.log('');
	console.log(`  1 seviye içinde uyum    : %${((agree / matched.length) * 100).toFixed(1)}`);

	const outliers = matched.filter((r) => Math.abs(gap(r)) >= 2).sort((a, b) => gap(b) - gap(a));
	console.log(`  2+ seviye ayrışan       : ${outliers.length}`);
	console.log('');
	console.log('  --- Sıklık "çok daha ileri" diyor (benim atamam düşük olabilir) ---');
	for (const r of outliers.filter((x) => gap(x) >= 2).slice(0, 30)) {
		console.log(`    ${r.en.padEnd(22)} ${r.mine} -> ${r.band}  (sıra ${r.rank})  ${r.tr.slice(0, 28)}`);
	}
	console.log('');
	console.log('  --- Sıklık "çok daha kolay" diyor (benim atamam yüksek olabilir) ---');
	for (const r of outliers.filter((x) => gap(x) <= -2).slice(0, 30)) {
		console.log(`    ${r.en.padEnd(22)} ${r.mine} -> ${r.band}  (sıra ${r.rank})  ${r.tr.slice(0, 28)}`);
	}
}
