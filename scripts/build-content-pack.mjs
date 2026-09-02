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
// Ek kelime dosyalari. Sirayla islenir; onceki dosyada olan kelime
// tekrar eklenmez.
const ADDITION_FILES = [
	'data/additions-a1-core.json',
	'data/additions-core-b.json'
];
const FREQ_INPUT = join(ROOT, 'data/sources/en_50k.txt');
const EXAMPLES_INPUT = join(ROOT, 'data/examples.json');
const POS_INPUT = join(ROOT, 'data/pos-map.json');
const OXFORD_INPUT = join(ROOT, 'data/oxford-lists.json');
const OUTPUT = join(ROOT, 'public/content/core-v1.json');

const PACK_ID = 'core';
// Surum yukseltilince mevcut kurulumlar guncellemeyi alir: tanimlar
// tazelenir, ilerleme kararli kimlikler sayesinde yerinde kalir.
//   1 -> 2 : 202 A1 temel kelimesi eklendi, 94 seviye duzeltmesi,
//            siklik siralari (freqRank), konu ve sozcuk turu alanlari.
//   2 -> 3 : 639 orta seviye kelime eklendi (siklik listesinin ilk 4000
//            sirasindan secilen, havuzda olmayan gercek sozcukler).
//   3 -> 4 : 2441 ornek cumle eklendi (Tatoeba, CC BY 2.0 FR) -
//            Turkce cevirileriyle birlikte.
//   4 -> 5 : sozcuk turu 841 -> 1560, konu 841 -> 1247 kayitta dolu.
//   5 -> 6 : Oxford CEFR listeleri islendi - seviyeler dogrulandi,
//            sozcuk turu tamamlandi, 2819 yeni kelime eklendi.
//   6 -> 7 : Turkce satir kirigi parcalari temizlendi (34 kayit) ve
//            konu etiketi 1263 -> 2296 kayitta dolduruldu. Konu ekrani
//            bu alani kullaniyor; eski paketle o ekran yari bos kalir.
//   7 -> 8 : Anlam ve ornek denetimi. 36 kayitta Ingilizce fiil cekimi
//            anlam alanina sizmisti ("sahip olmak, had - had"); temizlendi.
//            Sik kullanilan 400 kelime elle gozden gecirildi, 93 anlam
//            duzeltildi. 44 kelimenin ornek cumlesi kelimeyi yalnizca
//            tireli bir bilesikte iceriyordu ("old" -> "ten-year-old");
//            ornekler yeniden secildi.
const PACK_VERSION = 8;

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
	/**
	 * Kelimeye OZEL Turkce duzeltmeler.
	 * Duz tr esemesi yetmiyor: "be" karsiligi yanlislikla "almak"
	 * yazilmis ama "take" icin "almak" DOGRU. Bu yuzden anahtar
	 * Ingilizce bas sozcuk.
	 */
	trByWord: {
		be: 'olmak',
		// 1.0 verisinde fiil ikiye bolunmus: "paket lemek"
		package: 'paketlemek, paket',
		// Ceviri degil, kullanicinin kendi hatirlatma notu
		'in order to': '-mek için, amacıyla',
		'stay': 'kalmak, konaklamak',

		// --- Sik kullanilan 400 kelimenin elle gozden gecirilmesinden ---
		//
		// Uc hata turu cikti:
		//  1. Yanlis birincil anlam: "will" en sik kullanildigi haliyle
		//     gelecek zaman eki, "vasiyet" degil. Ogrenci karti acinca
		//     kelimenin asil isini goremiyordu.
		//  2. Bicim bozuklugu: "oynamak oyun, oynamak" - virgul eksik ve
		//     ayni anlam iki kez.
		//  3. Yazim hatasi: "kesmet", "donmek", "herzaman", "sagtaraf".
		//
		// Islevsel kelimelerde (edat, zamir, kip) Turkce karsiligi
		// yazmak yerine EKI vermek dogru: "to" bir nesne degil, "-e"dir.
		to: '-e, -a, -mek/-mak (mastar)',
		of: '-in, -ın (aitlik), -den',
		not: 'değil, -me/-ma',
		at: '-de, -da, -e, -a',
		by: 'tarafından, ile, yanında',
		will: '-ecek/-acak (gelecek zaman), irade, vasiyet',
		would: '-erdi, -ardı, isterdi',
		can: 'yapabilmek, -abilmek, konserve kutusu',
		with: 'ile, -li',
		without: 'olmadan, -sız',
		until: '-e kadar, -a kadar',
		there: 'orada, oraya',
		they: 'onlar',
		his: 'onun (erkek)',
		its: 'onun',
		anyone: 'kimse, herhangi biri',
		nobody: 'hiç kimse',
		everybody: 'herkes',
		any: 'herhangi, hiç',
		even: 'bile, hatta, düz',
		very: 'çok',
		yes: 'evet',
		no: 'hayır, yok',
		yeah: 'evet, tamam',
		OK: 'tamam, peki, onaylamak',

		// Yanlis birincil anlam
		well: 'iyi, peki, kuyu',
		right: 'sağ, doğru, haklı, hak',
		about: 'yaklaşık, hakkında',
		lot: 'çok, birçok, pay',
		being: 'varlık, olma',
		left: 'sol, bırakılmış',
		bit: 'parça, az miktar',
		mine: 'benimki, maden, mayın',
		body: 'vücut, beden, gövde',
		high: 'yüksek, yüce',
		hand: 'el, uzatmak',
		part: 'bölüm, parça, ayırmak',
		miss: 'özlemek, kaçırmak, ıskalamak',
		actually: 'aslında, gerçekte',
		ask: 'sormak, istemek',
		far: 'uzak',
		young: 'genç',
		wrong: 'yanlış, hatalı',
		shot: 'atış, vuruş',
		hell: 'cehennem',
		least: 'en az, asgari',
		stuff: 'şey, eşya, tıkmak',

		// Bicim bozuklugu: virgul eksik ya da ayni anlam iki kez
		love: 'sevgi, aşk, sevmek',
		idea: 'fikir, düşünce',
		run: 'koşmak, koşu, çalıştırmak',
		phone: 'telefon, telefon etmek',
		play: 'oynamak, oyun',
		sleep: 'uyumak, uyku',
		husband: 'koca, eş',
		wife: 'eş, karı',
		side: 'yan, taraf, kenar',
		late: 'geç, gecikmiş',
		May: 'mayıs',
		married: 'evli',
		looking: 'bakış, görünüş',
		thinking: 'düşünme, düşünce',
		minute: 'dakika',
		doctor: 'doktor, hekim',
		room: 'oda, yer',
		course: 'kurs, ders, seyir',
		leave: 'ayrılmak, bırakmak, izin',
		place: 'yer, koymak',
		own: 'kendi, sahip olmak',
		long: 'uzun, özlemek',
		eat: 'yemek yemek',
		drink: 'içmek, içecek',
		shut: 'kapamak, kapalı',

		// Yazim hatasi ve bitisik yazim
		always: 'her zaman, hep',
		turn: 'dönmek, dönüş, sıra',
		cut: 'kesmek, kesik',
		sometimes: 'bazen, ara sıra',
		light: 'ışık, hafif, açık renk',
		top: 'üst, tepe, üst kısım',
		pick: 'seçmek, toplamak',
		spend: 'harcamak, geçirmek',
		outdoor: 'açık hava, dış mekan',

		// Turkce karsiligi hic olmayan ya da eksik kalanlar.
		// stripEnglishForms bunlari bosaltacagi icin dokunmuyordu.
		uphold: 'desteklemek, onamak',
		oversee: 'gözetmek, denetlemek',
		bleed: 'kanamak, kan kaybetmek',
		rid: 'kurtulmak, temizlemek',
		freeze: 'donmak, dondurmak',

		// Anlam alanina sizmis birim aciklamalari
		teenage: '13-19 yaş arası',
		ton: 'ton (1000 kg)',
		gallon: 'galon',
		mile: 'mil',
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

/**
 * Kullanicinin kendi ornegi duzgun bir cumle mi?
 *
 * Kullanici ornegi normalde Tatoeba'nin onune gecer - kendi verisi,
 * saygi gosterilir. Ama 1.0 verisindeki 4 ornekten 2'si cumle degildi:
 * biri cok satirli bir kullanim notu ("until 2005 / till yesterday /
 * by tomorrow"), biri dilbilgisi hatali. Bu kapi onlari eleyip
 * Tatoeba'ya dusuyor; kullanicinin metni data/ altindaki orijinal
 * yedekte duruyor, kaybolmuyor.
 */
const KNOWN_BAD_EXAMPLES = new Set([
	// Dilbilgisi hatali: "to don't hit"
	"the cyclist braked hard to don't hit the child."
]);

function isWellFormedSentence(text) {
	const t = String(text || '').trim();
	if (!t) return false;
	// Cok satirli metin bir kullanim notudur, cumle degil.
	if (t.split(String.fromCharCode(10)).length > 1) return false;
	if (KNOWN_BAD_EXAMPLES.has(t.toLowerCase())) return false;
	const words = t.split(/\s+/).length;
	if (words < 3 || words > 16) return false;
	if (!/^[A-Z]/.test(t)) return false;
	if (!/[.!?]$/.test(t)) return false;
	return true;
}

function collapse(text) {
	return String(text || '').replace(/\s+/g, ' ').trim();
}

/**
 * Turkce anlamdan Ingilizce fiil cekimi kalintilarini temizler.
 *
 * 1.0 verisinde duzensiz fiillerin ikinci/ucuncu halleri anlam alanina
 * sizmis: `have` icin anlam "sahip olmak, had - had" goruunuyordu.
 * Kullanici karti acinca Turkce karsiligin yaninda anlamsiz bir
 * Ingilizce parca goruyor. `uphold` gibi bazi kayitlarda Turkce
 * karsilik hic yoktu - anlam yalnizca "upheld - upheld" idi.
 *
 * Yalnizca "kelime - kelime" bicimindeki, tamami ASCII olan parcalar
 * siliniyor. Turkce anlamlardaki tireler ("-mek icin", "-abilir")
 * bastaki tire yuzunden bu kalibi tutturmuyor, dokunulmuyor.
 */
const EN_FORM_SEGMENT = /^[a-z]+(?:\/[a-z]+)* - [a-z]+(?:\/[a-z]+)*$/i;

function stripEnglishForms(tr) {
	const parts = String(tr || '').split(',').map((p) => p.trim());
	const kept = parts.filter((p) => p && !EN_FORM_SEGMENT.test(p));
	// Hepsi silinecekse dokunma: bos anlam, yanlis anlamdan kotudur.
	// Bu durumdaki kayitlar FIXES.trByWord ile elle duzeltiliyor.
	return kept.length ? kept.join(', ') : tr;
}

const report = {
	input: 0,
	output: 0,
	strippedForms: [],
	fixedEn: [],
	fixedTr: [],
	fixedDotlessI: [],
	synonymsExtracted: 0,
	additions: 0,
	additionClashes: 0,
	rejectedExamples: [],
	oxfordEnriched: 0,
	oxfordAdded: 0,
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

/**
 * Ornek cumleler. Kaynak: Tatoeba (CC BY 2.0 FR), scripts/build-examples.py
 * ile secildi. Dosya yoksa paket ornek cumlesiz uretilir.
 */
const examplesByWord = new Map();
try {
	const data = JSON.parse(readFileSync(EXAMPLES_INPUT, 'utf8'));
	for (const [word, ex] of Object.entries(data.examples || {})) {
		examplesByWord.set(word.toLowerCase(), ex);
	}
} catch {
	console.log('  (data/examples.json bulunamadi - ornek cumle eklenmeyecek)');
}

/**
 * Sozcuk turu ve konu esemesi. scripts/infer-pos.mjs uretir.
 * Emin olunamayan kayitlar bos birakilir - yanlis etiket etiketsizden
 * daha zararli.
 */
let posByWord = {};
let topicByWord = {};
try {
	const data = JSON.parse(readFileSync(POS_INPUT, 'utf8'));
	posByWord = data.pos || {};
	topicByWord = data.topic || {};
} catch {
	console.log('  (data/pos-map.json bulunamadi - sozcuk turu/konu eklenmeyecek)');
}

/**
 * Oxford CEFR listeleri: seviye + Turkce anlamlar + sozcuk turu.
 *
 * Bu liste yayimlanmis bir derecelendirme; elle yaptigim seviye
 * atamalarindan daha yetkili. Cakismada Oxford kazanir.
 * Listede olmayan kelimeler (teknik terimler, kullanici eklemeleri)
 * kendi seviyelerini korur.
 */
const oxfordByWord = new Map();
try {
	const data = JSON.parse(readFileSync(OXFORD_INPUT, 'utf8'));
	for (const w of data.words || []) {
		oxfordByWord.set(w.en.toLowerCase(), w);
	}
	console.log(`  Oxford listesi: ${oxfordByWord.size} kelime yuklendi`);
} catch {
	console.log('  (data/oxford-lists.json bulunamadi - Oxford verisi kullanilmayacak)');
}

/** Oxford anlamlarini tek bir Turkce karsilik metnine cevirir. */
function oxfordMeaning(entry, limit = 3) {
	const seen = new Set();
	const out = [];
	for (const sense of entry.senses || []) {
		const tr = collapse(sense.tr);
		const key = tr.toLowerCase();
		if (!tr || seen.has(key)) continue;
		seen.add(key);
		out.push(tr);
		if (out.length >= limit) break;
	}
	return out.join(', ');
}

/**
 * Mevcut karsiliga Oxford anlamlarini ekler.
 *
 * Yalnizca ZAYIF kayitlar zenginlestiriliyor. Zaten iki-uc anlami olan
 * bir kayda Oxford'un nadir anlamlarini eklemek karti gurultulendiriyor:
 * "career" = "kariyer" iken "hiz yapmak, son hizda gitmek" eklenince
 * ogrenci hangisini ezberleyecegini bilemiyor.
 */
/**
 * "-mak/-mek" ile biten ama fiil OLMAYAN Turkce isimler.
 * Bu liste olmadan "bread" (ekmek) fiil isaretleniyor.
 * scripts/infer-pos.mjs icindeki listeyle ayni tutulmali.
 */
const TR_NOUN_EXCEPTIONS = new Set([
	'parmak', 'ekmek', 'yemek', 'kaymak', 'çakmak', 'ilmek', 'tokmak',
	'bıçak', 'kaynak', 'durak', 'yatak', 'kapak', 'sıcak', 'tarak',
	'oyuncak', 'bardak', 'ayak', 'damak', 'yanak', 'dudak', 'çocuk',
	'başak', 'sokak', 'yaprak', 'toprak', 'kucak', 'bacak', 'dirsek',
	'köpek', 'elek', 'çiçek', 'böcek', 'gömlek', 'etek', 'erkek',
	'inek', 'kelebek', 'bebek', 'direk', 'yürek', 'kürek', 'melek',
	'tabak', 'konak', 'ocak', 'yanak', 'kucak', 'sacak', 'balık'
]);

function posAgreeingWithMeaning(tr, pos) {
	const senses = String(tr || '').split(/[,;]/).map((p) => collapse(p)).filter(Boolean);
	if (!senses.length) return pos;
	// Gosterilen TUM anlamlar mastar ise tur fiildir.
	const allInfinitive = senses.every((p) => {
		const lower = p.toLowerCase();
		if (!/\s/.test(lower) && TR_NOUN_EXCEPTIONS.has(lower)) return false;
		return /(mek|mak)$/.test(lower) && lower.length > 4;
	});
	return allInfinitive ? 'verb' : pos;
}

function enrichMeaning(existing, entry) {
	const senses = existing.split(/[,;]/).map((p) => collapse(p)).filter(Boolean);
	if (senses.length >= 2) return existing;

	const seen = new Set(senses.map((p) => p.toLowerCase()));
	for (const sense of entry.senses || []) {
		const tr = collapse(sense.tr);
		const key = tr.toLowerCase();
		if (!tr || seen.has(key)) continue;
		// Cok uzun aciklamalar karti sisiriyor
		if (tr.length > 30) continue;
		return existing + ', ' + tr;
	}
	return existing;
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
	if (FIXES.trByWord[en]) {
		report.fixedTr.push(`${en}: ${tr} -> ${FIXES.trByWord[en]}`);
		tr = FIXES.trByWord[en];
	} else if (FIXES.tr[tr]) {
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

	const oxford = oxfordByWord.get(en.toLowerCase());
	if (oxford) {
		tr = enrichMeaning(tr, oxford);
		report.oxfordEnriched++;
	}
	const picked = examplesByWord.get(en.toLowerCase());
	// Kullanicinin kendi ornegi duzgun bir cumleyse onceliklidir;
	// degilse Tatoeba'dan secilen cumle kullanilir.
	const ownExample = isWellFormedSentence(w.example) ? collapse(w.example) : '';
	if (w.example && !ownExample) report.rejectedExamples.push(en);
	const def = {
		id: `${PACK_ID}:${slugify(en)}`,
		en,
		tr,
		example: ownExample || (picked ? picked.en : ''),
		exampleTr: ownExample ? '' : (picked ? picked.tr : ''),
		synonyms,
		// Kaydın bu paketten önceki hâli. Eski yedekleri ve 1.0 verisini
		// doğru kelimeye bağlamak için gerekli: "prosperity, welfare, wealth"
		// artık "prosperity" ama kullanıcının ilerlemesi eski yazımda duruyor.
		aliases: originalEn.toLowerCase() !== en.toLowerCase() ? [originalEn] : [],
		tags: Array.isArray(w.tags) ? w.tags.map(collapse).filter(Boolean) : [],
		// Oxford seviyesi elle atanandan yetkili
		cefr: (oxford && oxford.cefr) || cefrByWord.get(en.toLowerCase()) || null,
		// Oxford'un cogunluk oyuyla belirlenmis turu; kaynaktaki tekil
		// tur hatalarina karsi ilk anlamin turunden daha guvenilir.
		// Tur, gosterilen Turkce karsilikla tutarli olmali: "stay" hem
		// isim hem fiil ama pakette yalnizca "kalmak" gosteriliyorsa
		// karta "isim" yazmak celiskili olur.
		pos: posAgreeingWithMeaning(tr, (oxford && oxford.pos) || posByWord[en] || null),
		ipa: null,
		topic: topicByWord[en] || null,
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
for (const file of ADDITION_FILES) {
	const additions = JSON.parse(readFileSync(join(ROOT, file), 'utf8'));
	let added = 0;
	let clash = 0;
	for (const a of additions.words || []) {
		const en = collapse(a.en);
		const key = en.toLowerCase();
		if (!en || !a.tr) continue;
		if (seen.has(key)) {
			// Kelime zaten var ama eklemede FARKLI bir anlam olabilir:
			// "report" pakette "bildirmek" (fiil), eklemede "rapor" (isim).
			// Ikisi de dogru; anlamlari birlestir, kaydi cogaltma.
			const existing = seen.get(key);
			const merged = new Set([
				...existing.tr.split(/[,;]/).map(collapse),
				...collapse(a.tr).split(/[,;]/).map(collapse)
			]);
			existing.tr = [...merged].filter(Boolean).join(', ');
			if (!existing.topic && a.topic) existing.topic = a.topic;
			clash++;
			continue;
		}
		const picked = examplesByWord.get(key);
		const def = {
			id: `${PACK_ID}:${slugify(en)}`,
			en,
			tr: collapse(a.tr),
			example: collapse(a.example) || (picked ? picked.en : ''),
			exampleTr: collapse(a.exampleTr) || (picked ? picked.tr : ''),
			synonyms: [],
			aliases: [],
			tags: [],
			cefr: a.cefr || cefrByWord.get(key) || null,
			pos: a.pos || posByWord[en] || null,
			ipa: null,
			topic: a.topic || topicByWord[en] || null,
			freqRank: rankFor(en),
			audio: null,
			source: PACK_ID
		};
		seen.set(key, def);
		definitions.push(def);
		added++;
	}
	report.additions += added;
	report.additionClashes += clash;
}

// ---------- Oxford listesinden eksik kelimeleri ekle ----------
{
	let added = 0;
	for (const entry of oxfordByWord.values()) {
		const key = entry.en.toLowerCase();
		if (seen.has(key)) continue;

		const en = collapse(entry.en);
		const tr = oxfordMeaning(entry);
		if (!en || !tr) continue;

		const picked = examplesByWord.get(key);
		const def = {
			id: `${PACK_ID}:${slugify(en)}`,
			en,
			tr,
			example: picked ? picked.en : '',
			exampleTr: picked ? picked.tr : '',
			synonyms: [],
			aliases: [],
			tags: [],
			cefr: entry.cefr,
			pos: posAgreeingWithMeaning(tr, entry.pos || (entry.senses[0] && entry.senses[0].pos) || null),
			ipa: null,
			topic: topicByWord[en] || null,
			freqRank: rankFor(en),
			audio: null,
			source: PACK_ID
		};
		seen.set(key, def);
		definitions.push(def);
		added++;
	}
	report.oxfordAdded = added;
}

// Anlam duzeltmeleri ve temizlik - tek noktada, en sonda.
//
// Neden burada: anlam alani uc ayri yoldan (1.0 yedegi, ek dosyalari,
// Oxford listeleri) doluyor ve araya birlestirme adimlari giriyor.
// FIXES.trByWord yalnizca 1.0 dongusunde uygulaniyordu, dolayisiyla
// Oxford'dan gelen "will" ya da "at" gibi kelimelere hic degmiyordu.
// Ayni sekilde erken yapilan temizlik sonraki birlestirmede geri
// geliyordu. Son gecis ikisini de kesinlestiriyor.
for (const def of definitions) {
	if (FIXES.trByWord[def.en] && FIXES.trByWord[def.en] !== def.tr) {
		report.fixedTr.push(`${def.en}: ${def.tr} -> ${FIXES.trByWord[def.en]}`);
		def.tr = FIXES.trByWord[def.en];
	}
	const stripped = stripEnglishForms(def.tr);
	if (stripped !== def.tr) {
		report.strippedForms.push(`${def.en}: ${def.tr} -> ${stripped}`);
		def.tr = stripped;
	}
}

definitions.sort((a, b) => a.en.localeCompare(b.en, 'en', { sensitivity: 'base' }));
report.output = definitions.length;

const pack = {
	pack: {
		id: PACK_ID,
		version: PACK_VERSION,
		name: 'Temel Kelime Paketi',
		language: 'en-tr',
		// CC BY 2.0 FR atif zorunlulugu: uygulama icinde de gosteriliyor
		attribution: [
			{ name: 'Tatoeba', url: 'https://tatoeba.org', license: 'CC BY 2.0 FR', use: 'örnek cümleler' }
		],
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
console.log(`  Örnek cümlesi olan : ${definitions.filter((d) => d.example).length}`);
console.log(`  TR çevirisi olan   : ${definitions.filter((d) => d.exampleTr).length}`);
if (report.rejectedExamples.length) {
	console.log(`  Elenen kullanıcı örneği: ${report.rejectedExamples.length}`, report.rejectedExamples);
}
console.log(`  Sözcük türü olan   : ${definitions.filter((d) => d.pos).length}`);
console.log(`  Oxford zenginleştirdi: ${report.oxfordEnriched}`);
console.log(`  Oxford'dan eklenen : ${report.oxfordAdded}`);

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
