/**
 * Diyalog alıştırması: A konuşur, kullanıcı B'nin repliğini üretir.
 *
 * Okumak konuşmayı öğretmiyor. Burada kullanıcı diyalogun bir tarafını
 * gerçekten üretiyor — üç ayrı zorlukta:
 *
 *   secme  → doğru cevabı şıklardan seç        (tanıma)
 *   dizme  → karışık kelimeleri sıraya diz     (yapı bilgisi)
 *   bosluk → cümledeki eksik kelimeyi yaz      (üretim)
 *
 * Tip DÖNÜŞÜMLÜ atanıyor ve içerikte yazılı DEĞİL. Sebebi: her satır
 * için elle tip belirlemek 60 diyalogda 250 karar demek ve yeni
 * diyalog eklemeyi pahalılaştırırdı. Sıra kullanıcının kaçıncı
 * repliği olduğuna bakıyor, yani aynı diyalog her açılışta aynı
 * alıştırmaları veriyor — rastgelelik burada öğrenmeye bir şey
 * katmaz, yalnızca tutarsızlık yaratır.
 *
 * Saf mantık: DOM'a ve depoya dokunmaz.
 */

export const MODES = {
	CHOICE: 'secme',
	ORDER: 'dizme',
	BLANK: 'bosluk'
};

/** Sıra: seç → diz → yaz. Kolaydan zora, sonra baştan. */
const MODE_CYCLE = [MODES.CHOICE, MODES.ORDER, MODES.BLANK];

/**
 * Boşluk bırakılmayacak sözcükler.
 * İşlevsel kelimeyi sildirmek dil bilgisi sorusu olurdu; amaç
 * kelime üretimi, o yüzden içerik sözcükleri hedefleniyor.
 */
const STOPWORDS = new Set([
	'the', 'a', 'an', 'and', 'or', 'but', 'if', 'of', 'to', 'in', 'on', 'at',
	'for', 'with', 'from', 'by', 'is', 'am', 'are', 'was', 'were', 'be', 'been',
	'do', 'does', 'did', 'have', 'has', 'had', 'will', 'would', 'can', 'could',
	'shall', 'should', 'may', 'might', 'must', 'i', 'you', 'he', 'she', 'it',
	'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'its',
	'our', 'their', 'this', 'that', 'these', 'those', 'not', 'no', 'yes', 'so',
	'as', 'up', 'out', 'all', 'any', 'what', 'when', 'where', 'how', 'why'
]);

function shuffle(arr, random = Math.random) {
	const out = arr.slice();
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}

/** Karşılaştırma için sadeleştirir: noktalama ve fazla boşluk gider. */
export function normalize(text) {
	return String(text || '')
		.toLowerCase()
		.replace(/[.,!?;:"'’]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * Kullanıcının üreteceği satırları sırayla verir.
 * @param {object} dialogue
 * @param {string} [userSpeaker] Kullanıcının oynadığı taraf
 * @returns {{index: number, turn: number, mode: string, line: object}[]}
 */
export function practiceSteps(dialogue, userSpeaker = 'B') {
	const lines = (dialogue && dialogue.lines) || [];
	const steps = [];
	let turn = 0;
	lines.forEach((line, index) => {
		if (!line || line.s !== userSpeaker) return;
		steps.push({ index, turn, mode: MODE_CYCLE[turn % MODE_CYCLE.length], line });
		turn++;
	});
	return steps;
}

/**
 * Boşluk bırakılacak sözcüğü seçer: en uzun içerik sözcüğü.
 *
 * En uzunu seçmek bilerek — kısa sözcükler genelde işlevsel ve
 * tahmin edilebilir; cümlenin anlamını taşıyan sözcük öğretici olan.
 *
 * @returns {{word: string, index: number}|null}
 */
export function pickBlank(sentence) {
	const tokens = String(sentence || '').split(/(\s+)/);
	let best = null;
	tokens.forEach((tok, i) => {
		const clean = normalize(tok);
		if (clean.length < 3 || STOPWORDS.has(clean)) return;
		if (!best || clean.length > best.word.length) best = { word: clean, index: i };
	});
	return best;
}

/** CEFR sirasi: komsu seviye hesabi icin. */
const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

/** Kelime sayisi. Uzunluk bandi bunun uzerinden hesaplaniyor. */
function wordCount(text) {
	return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Başka diyalogların kullanıcı repliklerinden yanıltıcı üretir.
 *
 * Elle yanıltıcı yazmak 60 diyalogda yüzlerce cümle demek olurdu.
 * Başka diyalogdan gelen replik dilbilgisi olarak kusursuz ama
 * bağlama uymuyor — sorulan tam olarak bu.
 *
 * Üç şey çeşitliliği ve soru kalitesini belirliyor:
 *
 *  1. KOMŞU SEVİYELER de havuza giriyor. Tek seviyede yalnızca ~30
 *     replik var ve bir turda ~22 çekim yapılıyor; aynı cümleler
 *     dönüp duruyordu. Komşu seviye havuzu ikiye katlıyor.
 *  2. `exclude` ile oturumda ZATEN KULLANILMIŞ cümleler eleniyor.
 *     İstatistiksel dağılım dengeli olsa bile aynı cümlenin tek
 *     oturumda iki kez çıkması fark ediliyor ve ucuz gösteriyor.
 *  3. UZUNLUK BANDI: cevaptan çok kısa ya da çok uzun şık soruyu
 *     içeriğe bakmadan ele veriyor. Üç kelimelik cevabın yanında
 *     on kelimelik şık, şık değil süs olur.
 */
export function collectDistractors(dialogue, allDialogues, count, random = Math.random, options = {}) {
	const exclude = options.exclude instanceof Set ? options.exclude : new Set();
	const answer = options.answer || '';
	const own = new Set(((dialogue && dialogue.lines) || []).map((l) => normalize(l.en)));
	const level = dialogue && dialogue.cefr;
	const li = CEFR_ORDER.indexOf(level);

	/** Seviye uzakligi: 0 ayni, 1 komsu, 2+ uzak. */
	function distance(other) {
		const oi = CEFR_ORDER.indexOf(other);
		if (li < 0 || oi < 0) return 0;
		return Math.abs(li - oi);
	}

	/**
	 * @param {number} maxUzaklik Kabul edilen en fazla seviye uzakligi
	 */
	function topla(maxUzaklik) {
		const out = [];
		const seen = new Set();
		for (const d of allDialogues || []) {
			if (!d || d.id === (dialogue && dialogue.id)) continue;
			const uzaklik = distance(d.cefr);
			if (uzaklik > maxUzaklik) continue;
			for (const line of d.lines || []) {
				if (line.s !== 'B') continue;
				const key = normalize(line.en);
				if (!key || own.has(key) || seen.has(key) || exclude.has(key)) continue;
				seen.add(key);
				out.push({
					text: line.en,
					uzaklik,
					fark: Math.abs(wordCount(line.en) - wordCount(answer))
				});
			}
		}
		return out;
	}

	// Komsu seviyeler yeterli; degilse tum seviyeler. Sikki eksik bir
	// soru, sorunun kendisini bozar - son care olarak uzaklik onemsiz.
	let candidates = topla(1);
	if (candidates.length < count) candidates = topla(CEFR_ORDER.length);

	if (!candidates.length) return [];

	// Once uzunlugu yakin ve seviyesi ayni olanlar. Yeterli aday
	// kalmazsa bant genisliyor: eksik sikli bir soru, hic soru
	// olmamasindan iyidir.
	const BAND = Math.max(3, Math.ceil(wordCount(answer) * 0.6));
	let havuz = candidates.filter((c) => c.uzaklik === 0 && c.fark <= BAND);
	if (havuz.length < count * 2) havuz = candidates.filter((c) => c.fark <= BAND);
	if (havuz.length < count) havuz = candidates;

	return shuffle(havuz, random).slice(0, count).map((c) => c.text);
}

/**
 * Bir adımı çözülebilir alıştırmaya çevirir.
 *
 * @param {object} dialogue
 * @param {object} step practiceSteps() çıktısından bir eleman
 * @param {{allDialogues?: object[], random?: () => number, optionCount?: number}} [options]
 */
export function buildStep(dialogue, step, options = {}) {
	const random = options.random || Math.random;
	const optionCount = options.optionCount || 3;
	const line = step.line;
	const base = { index: step.index, mode: step.mode, answer: line.en, tr: line.tr };

	if (step.mode === MODES.CHOICE) {
		// exclude ve answer iletiliyor: biri oturumda tekrari onluyor,
		// digeri uzunlugu cevaba yakin siklar seciyor.
		const distractors = collectDistractors(
			dialogue,
			options.allDialogues || [],
			optionCount - 1,
			random,
			{ exclude: options.exclude, answer: line.en }
		);
		const options_ = shuffle([line.en, ...distractors], random);
		return {
			...base,
			instruction: 'Ne dersin?',
			options: options_,
			correctIndex: options_.indexOf(line.en)
		};
	}

	if (step.mode === MODES.ORDER) {
		const words = String(line.en).split(/\s+/).filter(Boolean);
		return {
			...base,
			instruction: 'Kelimeleri sıraya diz',
			words,
			// Tek kelimelik replikte karistirmanin anlami yok
			tokens: words.length > 1 ? shuffle(words, random) : words.slice()
		};
	}

	// BLANK
	const blank = pickBlank(line.en);
	if (!blank) {
		// Bosluk birakilacak icerik sozcugu yoksa secmeye dus.
		return buildStep(dialogue, { ...step, mode: MODES.CHOICE }, options);
	}
	const tokens = String(line.en).split(/(\s+)/);
	// Noktalama cumlede kalmali: yalnizca SOZCUK siliniyor.
	// Butun belirteci silmek "No, thanks. How much is it?" cumlesini
	// "No, ___ How much is it?" yapiyordu - nokta kayboluyordu.
	const parts = String(tokens[blank.index]).match(/^([^A-Za-z']*)([A-Za-z']+)(.*)$/);
	const onEk = parts ? parts[1] : '';
	const sonEk = parts ? parts[3] : '';
	const before = tokens.slice(0, blank.index).join('') + onEk;
	const after = sonEk + tokens.slice(blank.index + 1).join('');
	return {
		...base,
		instruction: 'Eksik kelimeyi yaz',
		sentence: { before, after },
		blank: blank.word
	};
}

/** Şık seçimi doğru mu? */
export function checkChoice(exercise, pickedIndex) {
	return pickedIndex === exercise.correctIndex;
}

/** Dizilen kelimeler doğru sırada mı? */
export function checkOrder(exercise, picked) {
	return normalize((picked || []).join(' ')) === normalize(exercise.answer);
}

/**
 * Boşluğa yazılan kelime doğru mu?
 * Büyük/küçük harf ve noktalama farkı yanlış sayılmaz — ölçülen
 * kelimeyi bilmek, yazım titizliği değil.
 */
export function checkBlank(exercise, input) {
	return normalize(input) === normalize(exercise.blank);
}
