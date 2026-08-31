/**
 * Kullanıcı yedeğinden (kelime + ilerleme karışık) temiz bir İÇERİK PAKETİ üretir.
 *
 * Paket yalnızca TANIM taşır: seviye, tekrar tarihi ve geçmiş kullanıcıya
 * aittir, pakette yeri yoktur.
 *
 * Çalıştırma:  node scripts/build-content-pack.mjs
 *              node scripts/build-content-pack.mjs --dry   (yazmadan rapor)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// Girdi: kullanicinin 1.0 yedegi. public/ disinda tutuluyor - uygulamayla
// gonderilmesine gerek yok, sadece paket uretiminin kaynagi.
const INPUT = join(ROOT, 'data/kelime-havuzu-orijinal-2026-01-12.json');
const CEFR_INPUT = join(ROOT, 'data/cefr-levels.json');
const ADDITIONS_INPUT = join(ROOT, 'data/additions-a1-core.json');
const FREQ_INPUT = join(ROOT, 'data/sources/en_50k.txt');
const OUTPUT = join(ROOT, 'public/content/core-v1.json');

const PACK_ID = 'core';
// Surum yukseltilince mevcut kurulumlar guncellemeyi alir: tanimlar
// tazelenir, ilerleme kararli kimlikler sayesinde yerinde kalir.
//   1 -> 2 : 202 A1 temel kelimesi eklendi, 94 seviye duzeltmesi,
//            siklik siralari (freqRank), konu ve sozcuk turu alanlari.
const PACK_VERSION = 2;

const DRY = process.argv.includes('--dry');

/**
 * Elle doğrulanmış düzeltmeler.
 * Buraya yalnızca kesin olan yazım hataları girer; anlam değişikliği
 * gerektiren düzeltmeler insan onayı ister.
 */
/**
 * Elle doğrulanmış yazım düzeltmeleri.
 *
 * Her biri Türkçe karşılığına bakılarak doğrulandı; belirsiz olanlar
 * dokunulmadan bırakıldı. Dikkat: bazıları basit harf hatası değil,
 * bambaşka kelime — 'breake' ("fren") aslında 'brake', 'break' değil.
 */
const FIXES = {
	en: {
		// Basit yazım hataları
		'T-shitt': 'T-shirt',
		'Intelligent': 'intelligent',
		'icrease, escalate': 'increase, escalate',
		'hurry hurries': 'hurry',
		'aconomical': 'economical',
		'altough': 'although',
		'ambarreassed': 'embarrassed',
		'coffe': 'coffee',
		'conteptual': 'conceptual',
		'correspanding': 'corresponding',
		'evelutionary': 'evolutionary',
		'headeache': 'headache',
		'howewer': 'however',
		'malnutrion': 'malnutrition',
		'necessitare': 'necessitate',
		'periipherals': 'peripherals',
		'philosphy': 'philosophy',
		'remmant': 'remnant',
		'sitaction': 'situation',
		'smal': 'small',
		'succes': 'success',
		'trustworty': 'trustworthy',
		'intensive care rom': 'intensive care room',
		'now a days': 'nowadays',
		// Türkçe klavyeden gelen 'ı' harfinin 'o' olması gereken kayıtlar
		'enfırcement': 'enforcement',
		'anınymous': 'anonymous',
		// Yanlış kelime yazılmış - Türkçe karşılığından tespit edildi
		'breake': 'brake',            // "fren" -> break değil brake
		'stich': 'stick',             // "çubuk"
		'dept': 'debt',               // "borç"
		'hed': 'head',                // "baş, kafa"
		'metter': 'matter',           // "konu, mesele"
		'mensure': 'measure',         // "ölçme"
		'reasend': 'resend',          // "yeniden göndermek"
		'rebout': 'reboot',           // "yeniden başlatma"
		'plub': 'plug',               // "priz"
		'bidata': 'big data',         // "büyük veri"
		'iterna': 'interior',         // "iç"
		'resistons': 'resistor',      // "dirençler"
		'cryption': 'encryption',     // "şifreleme"
		'menace threat': 'menace',
		'pro-defined': 'pre-defined',
		'pro-installed': 'pre-installed',
		'releated to': 'related to',
		// Sondaki yer tutucu 'x'
		'around x': 'around',
		'towards x': 'towards',
		'vulnerable to': 'vulnerable to',
		// Yazımı düzeltilince mevcut kayıtla birleşecekler
		'accupy': 'occupy',
		'appropricte': 'appropriate',
		'excahnge': 'exchange',
		'midigate': 'mitigate',
		'angles': 'angle',
		'labor': 'labour'
	},
	tr: {
		'teleaş': 'telaş',
		'terketmek, vazgeçmek': 'terk etmek, vazgeçmek',
		'yenidan başlatma': 'yeniden başlatma',
		'yoğum bakım odası': 'yoğun bakım odası',
		'çevre bilimi': 'çevre birimleri',
		'x etrafında': 'etrafında',
		'x e doğru': 'e doğru',
		'erişm': 'erişim'
	}
};

/**
 * İngilizce alanda Türkçe noktasız 'ı' (U+0131) kullanılmış kayıtları düzeltir.
 * Girdide 18 tane var ('ımprove', 'ımportant', 'ıllness'...). Bu harf
 * sözlük eşleşmesini, aramayı ve sesli okumayı bozar; İngilizcede hiç
 * geçmediği için dönüşüm güvenli.
 */
function fixDotlessI(text) {
	return text.replace(/ı/g, 'i');
}

/** "look down on" -> "look-down-on" */
function slugify(text) {
	return String(text || '')
		.trim()
		.toLowerCase()
		.replace(/['']/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

function collapse(text) {
	return String(text || '').replace(/\s+/g, ' ').trim();
}

const report = {
	input: 0,
	output: 0,
	fixedEn: [],
	fixedTr: [],
	fixedDotlessI: [],
	synonymsExtracted: 0,
	additions: 0,
	additionClashes: 0,
	duplicates: [],
	dropped: []
};

/**
 * Kelime -> CEFR seviyesi tablosu.
 * Ayri bir dosyada tutuluyor cunku elle duzenlenecek: seviye atamalari
 * zamanla iyilesecek ve kod degisikligi gerektirmemeli.
 */
const cefrByWord = new Map();
{
	const cefrData = JSON.parse(readFileSync(CEFR_INPUT, 'utf8'));
	for (const [level, words] of Object.entries(cefrData)) {
		if (level.startsWith('_') || !Array.isArray(words)) continue;
		for (const w of words) cefrByWord.set(String(w).toLowerCase(), level);
	}
}

/**
 * Kullanim sikligi siralari.
 * Kaynak: hermitdave/FrequencyWords (MIT), OpenSubtitles 2018 korpusu.
 * Sadece tek kelimeler icin anlamli; obek fiillerde bilesenlerin sikligi
 * obegin zorlugunu yansitmaz, bu yuzden onlarda bos birakiliyor.
 */
const freqRank = new Map();
{
	let i = 0;
	for (const line of readFileSync(FREQ_INPUT, 'utf8').split('\n')) {
		const w = line.split(' ')[0];
		if (!w) continue;
		i++;
		if (!freqRank.has(w)) freqRank.set(w, i);
	}
}

function rankFor(en) {
	const key = en.toLowerCase().trim();
	if (/[\s-]/.test(key)) return null;
	return freqRank.get(key) || null;
}

const raw = JSON.parse(readFileSync(INPUT, 'utf8'));
const words = Array.isArray(raw.words) ? raw.words : [];
report.input = words.length;

const seen = new Map();
const definitions = [];

for (const w of words) {
	const originalEn = collapse(w.en);
	let en = originalEn;
	let tr = collapse(w.tr);

	if (FIXES.en[en]) {
		report.fixedEn.push(`${en} -> ${FIXES.en[en]}`);
		en = FIXES.en[en];
	}
	const deDotted = fixDotlessI(en);
	if (deDotted !== en) {
		report.fixedDotlessI.push(`${en} -> ${deDotted}`);
		en = deDotted;
	}
	if (FIXES.tr[tr]) {
		report.fixedTr.push(`${tr} -> ${FIXES.tr[tr]}`);
		tr = FIXES.tr[tr];
	}

	if (!en || !tr) {
		report.dropped.push(w.en || '(boş)');
		continue;
	}

	// "prosperity, welfare, wealth" -> baş sözcük + eş anlamlılar.
	// Kart ön yüzünde üç kelime birden göstermek ezberi bozuyor; eş
	// anlamlılar ayrı alanda dursun.
	let synonyms = [];
	if (en.includes(',')) {
		const parts = en.split(',').map(collapse).filter(Boolean);
		en = parts[0];
		synonyms = parts.slice(1);
		report.synonymsExtracted++;
	}

	// Düzeltmeleri baş sözcüğe de uygula: yazım hatası olan kayıtların bir
	// kısmı virgüllü listeydi ("iterna, inner, interior"), bütün metin
	// üzerinden eşleşmiyorlardı.
	if (FIXES.en[en]) {
		report.fixedEn.push(`${en} -> ${FIXES.en[en]} (baş sözcük)`);
		en = FIXES.en[en];
	}
	const deDottedHead = fixDotlessI(en);
	if (deDottedHead !== en) {
		report.fixedDotlessI.push(`${en} -> ${deDottedHead} (baş sözcük)`);
		en = deDottedHead;
	}

	// Eş anlamlı listesi baş sözcüğü tekrar etmesin
	synonyms = synonyms.filter((x) => x.toLowerCase() !== en.toLowerCase());

	const key = en.toLowerCase();
	if (seen.has(key)) {
		// Aynı kelime iki kez: anlamları birleştir, kaydı çoğaltma.
		const existing = seen.get(key);
		const merged = new Set([...existing.tr.split(',').map(collapse), ...tr.split(',').map(collapse)]);
		existing.tr = [...merged].filter(Boolean).join(', ');
		if (originalEn.toLowerCase() !== key && !existing.aliases.includes(originalEn)) {
			existing.aliases.push(originalEn);
		}
		report.duplicates.push(en);
		continue;
	}

	const def = {
		id: `${PACK_ID}:${slugify(en)}`,
		en,
		tr,
		example: collapse(w.example),
		exampleTr: '',
		synonyms,
		// Kaydın bu paketten önceki hâli. Eski yedekleri ve 1.0 verisini
		// doğru kelimeye bağlamak için gerekli: "prosperity, welfare, wealth"
		// artık "prosperity" ama kullanıcının ilerlemesi eski yazımda duruyor.
		aliases: originalEn.toLowerCase() !== en.toLowerCase() ? [originalEn] : [],
		tags: Array.isArray(w.tags) ? w.tags.map(collapse).filter(Boolean) : [],
		cefr: cefrByWord.get(en.toLowerCase()) || null,
		pos: null,
		ipa: null,
		topic: null,
		freqRank: rankFor(en),
		audio: null,
		source: PACK_ID
	};

	seen.set(key, def);
	definitions.push(def);
}

// ---------- A1 temel kelime eklemesi ----------
// Mevcut havuz temali isimlerde iyi ama dilbilgisi omurgasi (sayilar,
// gunler, aylar, soru kelimeleri, zamirler, baglaclar) eksikti.
{
	const additions = JSON.parse(readFileSync(ADDITIONS_INPUT, 'utf8'));
	let added = 0;
	let clash = 0;
	for (const a of additions.words || []) {
		const en = collapse(a.en);
		const key = en.toLowerCase();
		if (!en || !a.tr) continue;
		if (seen.has(key)) {
			clash++;
			continue;
		}
		const def = {
			id: `${PACK_ID}:${slugify(en)}`,
			en,
			tr: collapse(a.tr),
			example: collapse(a.example),
			exampleTr: collapse(a.exampleTr),
			synonyms: [],
			aliases: [],
			tags: [],
			cefr: a.cefr || cefrByWord.get(key) || null,
			pos: a.pos || null,
			ipa: null,
			topic: a.topic || null,
			freqRank: rankFor(en),
			audio: null,
			source: PACK_ID
		};
		seen.set(key, def);
		definitions.push(def);
		added++;
	}
	report.additions = added;
	report.additionClashes = clash;
}

definitions.sort((a, b) => a.en.localeCompare(b.en, 'en', { sensitivity: 'base' }));
report.output = definitions.length;

const pack = {
	pack: {
		id: PACK_ID,
		version: PACK_VERSION,
		name: 'Temel Kelime Paketi',
		language: 'en-tr',
		wordCount: definitions.length,
		builtAt: new Date().toISOString()
	},
	words: definitions
};

console.log('=== İÇERİK PAKETİ RAPORU ===');
console.log(`  Girdi kaydı        : ${report.input}`);
console.log(`  Paket kelimesi     : ${report.output}`);
console.log(`  Eş anlamlı ayrılan : ${report.synonymsExtracted}`);
console.log(`  Birleştirilen tekrar: ${report.duplicates.length}`, report.duplicates.slice(0, 5));
console.log(`  Düzeltilen EN      : ${report.fixedEn.length}`, report.fixedEn);
console.log(`  Düzeltilen TR      : ${report.fixedTr.length}`, report.fixedTr);
console.log(`  Düzeltilen 'ı'->'i': ${report.fixedDotlessI.length}`, report.fixedDotlessI);
console.log(`  Atılan             : ${report.dropped.length}`, report.dropped.slice(0, 5));
console.log(`  Takma adlı kayıt   : ${definitions.filter((d) => d.aliases.length).length}`);
console.log(`  A1 temel eklemesi  : ${report.additions}` +
	(report.additionClashes ? `  (${report.additionClashes} zaten vardı)` : ''));
console.log(`  Sıklık sırası olan : ${definitions.filter((d) => d.freqRank).length}`);
console.log(`  Konu etiketi olan  : ${definitions.filter((d) => d.topic).length}`);
console.log(`  Sözcük türü olan   : ${definitions.filter((d) => d.pos).length}`);

const byLevel = {};
let untagged = 0;
for (const d of definitions) {
	if (d.cefr) byLevel[d.cefr] = (byLevel[d.cefr] || 0) + 1;
	else untagged++;
}
console.log('');
console.log('  CEFR dağılımı      :', ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
	.map((l) => `${l}:${byLevel[l] || 0}`).join('  '));
if (untagged) {
	const list = definitions.filter((d) => !d.cefr).map((d) => d.en);
	console.log(`  ⚠ Seviyesiz kelime : ${untagged}`, list.slice(0, 15));
}

if (DRY) {
	console.log('\n(--dry: dosya yazılmadı)');
} else {
	writeFileSync(OUTPUT, JSON.stringify(pack), 'utf8');
	const kb = (readFileSync(OUTPUT).length / 1024).toFixed(0);
	console.log(`\n  Yazıldı: public/content/core-v1.json (${kb} KB)`);
}
