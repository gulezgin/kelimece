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
const OUTPUT = join(ROOT, 'public/content/core-v1.json');

const PACK_ID = 'core';
const PACK_VERSION = 1;

const DRY = process.argv.includes('--dry');

/**
 * Elle doğrulanmış düzeltmeler.
 * Buraya yalnızca kesin olan yazım hataları girer; anlam değişikliği
 * gerektiren düzeltmeler insan onayı ister.
 */
const FIXES = {
	en: {
		'T-shitt': 'T-shirt',
		'Intelligent': 'intelligent',
		'icrease, escalate': 'increase, escalate',
		'hurry hurries': 'hurry',
		// Türkçe klavyeden gelen 'ı' harfinin 'o' olması gereken iki kayıt
		'enfırcement': 'enforcement',
		'anınymous': 'anonymous'
	},
	tr: {
		'teleaş': 'telaş'
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
	duplicates: [],
	dropped: []
};

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
		// Faz 2'de doldurulacak alanlar - şema şimdiden hazır
		cefr: null,
		pos: null,
		ipa: null,
		topic: null,
		freqRank: null,
		audio: null,
		source: PACK_ID
	};

	seen.set(key, def);
	definitions.push(def);
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

if (DRY) {
	console.log('\n(--dry: dosya yazılmadı)');
} else {
	writeFileSync(OUTPUT, JSON.stringify(pack), 'utf8');
	const kb = (readFileSync(OUTPUT).length / 1024).toFixed(0);
	console.log(`\n  Yazıldı: public/content/core-v1.json (${kb} KB)`);
}
