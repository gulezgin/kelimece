/**
 * Sıklık verisiyle karşılaştırma sonucu gözden geçirilmiş seviye düzeltmeleri.
 *
 * YÖNTEM
 * Elle atanan seviyeler, OpenSubtitles sıklık listesinin (MIT) ima ettiği
 * bandla karşılaştırıldı. 1652 kelimenin %83'ünde iki kaynak 1 seviye içinde
 * uyuştu. 2+ seviye ayrışan 255 kayıt tek tek incelendi ve iki gruba ayrıldı:
 *
 * 1. SIKLIK HAKLI — soyut, biçimsel ve teknik kelimeler.
 *    "implementation", "classification", "corresponding" gibi kelimeler
 *    günlük konuşmada gerçekten seyrek; ilk atamaları fazla düşüktü.
 *    Aynı şekilde "certainly", "completely", "trouble" gerçekten çok sık
 *    kullanılıyor; ilk atamaları fazla yüksekti.
 *
 * 2. SIKLIK YANILIYOR — somut günlük/sınıf kelimeleri.
 *    "carrot" (sıra 8557), "giraffe" (13464), "eraser" (24221) film
 *    altyazısında nadir geçiyor ama her A1 ders kitabının ilk ünitesinde
 *    var. Korpus konuşma dili ağırlıklı olduğu için somut isimleri
 *    sistematik olarak hak ettiğinden zor gösteriyor. Bu ~160 kayıtta
 *    elle atanan seviye korundu.
 *
 * Bu dosya yalnızca 1. gruptaki düzeltmeleri uygular. Çalıştırma:
 *   node scripts/reconcile-cefr.mjs          (raporla ve uygula)
 *   node scripts/reconcile-cefr.mjs --dry    (yalnızca raporla)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CEFR_FILE = join(ROOT, 'data/cefr-levels.json');
const DRY = process.argv.includes('--dry');

/**
 * Hedef seviye -> taşınacak kelimeler.
 * Her satır sıklık verisiyle desteklenen ve elle onaylanan bir düzeltme.
 */
const MOVES = {
	// --- Sıklık "bunlar çok daha yaygın" dedi: seviye indirildi ---
	A2: [
		'matter', 'trouble', 'trust', 'rather', 'absolutely', 'court',
		'completely', 'definitely', 'security', 'certainly', 'burn'
	],

	// --- Karışık yön: bir kısmı indirildi, bir kısmı yükseltildi ---
	B1: [
		// indirilenler (sıklık: çok yaygın)
		'evidence', 'otherwise', 'suspect', 'faith', 'commander', 'beyond', 'settle',
		// yükseltilenler (sıklık: konuşma dilinde seyrek, soyut)
		'devices', 'edges', 'contains', 'include', 'compare', 'improve', 'increase',
		'active', 'excuses', 'neighbourhood', 'practise', 'instruction'
	],

	B2: [
		// indirilenler
		'affair', 'debt',
		// yükseltilenler
		'exhibit', 'meaningless', 'rapid', 'artistic', 'survey', 'donate', 'imaginary',
		'gender', 'employ', 'frequently', 'meaningful', 'belonging', 'calculate',
		'achievements', 'advertise', 'afterward', 'accommodation', 'amaze', 'summary',
		'outgoing', 'requirement', 'estimates', 'improvements', 'decrease', 'impolite',
		'objectives', 'usage', 'usable', 'easygoing', 'briefly', 'fashionable',
		'shutdown', 'reboot', 'locking', 'delivering', 'monthly', 'weekly', 'yearly',
		'refers'
	],

	C1: [
		'implement', 'evident', 'adjustments', 'compose', 'acceleration', 'arose',
		'sustainable', 'corresponding', 'uniquely', 'specify', 'phases', 'economical',
		'gradual', 'syllable', 'classification', 'odour', 'recruiter', 'implementation',
		'addictions', 'drawbacks', 'colorless', 'processor', 'eject'
	]
};

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const data = JSON.parse(readFileSync(CEFR_FILE, 'utf8'));

/** Kelimenin şu anki seviyesi. */
function currentLevel(word) {
	const key = word.toLowerCase();
	for (const l of LEVELS) {
		if (data[l].some((w) => w.toLowerCase() === key)) return l;
	}
	return null;
}

const applied = [];
const skipped = [];

for (const [target, words] of Object.entries(MOVES)) {
	for (const word of words) {
		const from = currentLevel(word);
		if (!from) {
			skipped.push(`${word}: listede yok`);
			continue;
		}
		if (from === target) {
			skipped.push(`${word}: zaten ${target}`);
			continue;
		}
		// Eski seviyeden çıkar, yenisine ekle
		data[from] = data[from].filter((w) => w.toLowerCase() !== word.toLowerCase());
		data[target].push(word);
		applied.push({ word, from, to: target });
	}
}

for (const l of LEVELS) data[l] = [...new Set(data[l])].sort((a, b) => a.localeCompare(b, 'en'));

const down = applied.filter((m) => LEVELS.indexOf(m.to) < LEVELS.indexOf(m.from));
const up = applied.filter((m) => LEVELS.indexOf(m.to) > LEVELS.indexOf(m.from));

console.log('=== SEVİYE UZLAŞTIRMA ===');
console.log(`  Uygulanan düzeltme : ${applied.length}`);
console.log(`    seviye indirilen : ${down.length}`);
console.log(`    seviye yükseltilen: ${up.length}`);
if (skipped.length) console.log(`  Atlanan            : ${skipped.length}`, skipped.slice(0, 8));

console.log('');
console.log('  İndirilenler (sıklık: sanılandan çok daha yaygın):');
console.log('   ', down.map((m) => `${m.word} ${m.from}->${m.to}`).join(', '));
console.log('');
console.log('  Yükseltilenler (sıklık: konuşma dilinde seyrek):');
console.log('   ', up.map((m) => `${m.word} ${m.from}->${m.to}`).join(', '));

const total = LEVELS.reduce((s, l) => s + data[l].length, 0);
console.log('');
console.log('  Yeni dağılım:', LEVELS.map((l) => `${l}:${data[l].length}`).join('  '), `= ${total}`);

if (DRY) {
	console.log('');
	console.log('(--dry: dosya yazılmadı)');
} else {
	writeFileSync(CEFR_FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');
	console.log('');
	console.log('  Yazıldı: data/cefr-levels.json');
}
