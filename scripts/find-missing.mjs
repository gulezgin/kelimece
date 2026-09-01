/**
 * Sıklık listesinde olup havuzda olmayan kelimeleri bulur.
 *
 * Ham fark listesi işe yaramaz: ilk 3000 sıranın 2000'i kısaltma
 * ("don", "isn"), ünlem ("uh", "yeah") ya da havuzdaki bir kelimenin
 * çekimli hâli ("going", "told", "years"). Bu betik onları eleyip
 * gerçekten yeni sözcük olan adayları bırakır.
 *
 * Çalıştırma: node scripts/find-missing.mjs [başlangıç] [bitiş]
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const from = Number(process.argv[2]) || 1;
const to = Number(process.argv[3]) || 8000;

const pack = JSON.parse(readFileSync(join(ROOT, 'public/content/core-v1.json'), 'utf8'));

/** Havuzdaki her yazım biçimi: baş sözcük, eş anlamlı, takma ad. */
const have = new Set();
for (const w of pack.words) {
	have.add(w.en.toLowerCase());
	for (const s of w.synonyms) have.add(s.toLowerCase());
	for (const a of w.aliases) have.add(a.toLowerCase());
	// Çok kelimeli girdilerin parçalarını da bilinen say
	for (const part of w.en.toLowerCase().split(/[\s-]+/)) have.add(part);
}

/** Kısaltma kalıntıları ve ünlemler - öğrenilecek sözcük değiller. */
const NOISE = new Set([
	'don', 'isn', 'didn', 'doesn', 'wasn', 'couldn', 'wouldn', 'ain', 'hasn',
	'aren', 'haven', 'weren', 'shouldn', 'won', 'll', 've', 're', 'em', 'im',
	'uh', 'um', 'oh', 'hmm', 'yeah', 'huh', 'ah', 'eh', 'ha', 'hey', 'wow',
	'ooh', 'ow', 'hm', 'mm', 'ya', 'yep', 'nope', 'gonna', 'wanna', 'gotta',
	'okay', 'ok', 'yes', 'hello', 'hi', 'bye', 'sir', 'ma', 'mr', 'mrs', 'ms',
	'la', 'da', 'de', 'le', 'el', 'al', 'di', 'na', 'oui'
]);

/**
 * Havuzdaki bir kelimenin çekimli hâli mi?
 * Basit son ek soyma; kesin değil ama toplu elemede yeterli.
 */
function isInflection(word) {
	const stems = [];
	const w = word;
	if (w.endsWith('s')) stems.push(w.slice(0, -1));
	if (w.endsWith('es')) stems.push(w.slice(0, -2));
	if (w.endsWith('ies')) stems.push(w.slice(0, -3) + 'y');
	if (w.endsWith('ed')) stems.push(w.slice(0, -2), w.slice(0, -1));
	if (w.endsWith('ied')) stems.push(w.slice(0, -3) + 'y');
	if (w.endsWith('ing')) stems.push(w.slice(0, -3), w.slice(0, -3) + 'e');
	if (w.endsWith('er')) stems.push(w.slice(0, -2), w.slice(0, -1));
	if (w.endsWith('est')) stems.push(w.slice(0, -3), w.slice(0, -2));
	if (w.endsWith('ly')) stems.push(w.slice(0, -2));
	// Çift ünsüz: "running" -> "run", "bigger" -> "big"
	const m = w.match(/^(.*?)([bcdfghjklmnpqrstvwxz])\2(ing|ed|er|est)$/);
	if (m) stems.push(m[1] + m[2]);
	return stems.some((s) => s.length > 2 && have.has(s));
}

const candidates = [];
let rank = 0;
for (const line of readFileSync(join(ROOT, 'data/sources/en_50k.txt'), 'utf8').split('\n')) {
	const word = line.split(' ')[0];
	if (!word) continue;
	rank++;
	if (rank < from) continue;
	if (rank > to) break;
	if (word.length < 3) continue;
	if (/[^a-z]/.test(word)) continue;
	if (NOISE.has(word)) continue;
	if (have.has(word)) continue;
	if (isInflection(word)) continue;
	candidates.push({ rank, word });
}

console.log(`# ${from}-${to} arası, havuzda olmayan gerçek aday: ${candidates.length}`);
console.log(candidates.map((c) => `${c.rank}:${c.word}`).join(' '));
