/**
 * Alıştırma motoru.
 *
 * 1.x'te tek bir alıştırma vardı: kelimeyi gör, anlamı aç, kendini
 * değerlendir. İki sorunu var:
 *   - Cevap hiç KONTROL EDİLMİYOR. İnsan "biliyordum" demeye yatkındır
 *     (hatırlama yanılsaması); öz-değerlendirme öğrenmeyi abartır.
 *   - Yalnızca TANIMA ölçülüyor (EN görüp TR hatırlama). Konuşmak için
 *     gereken ÜRETİM yönü (TR görüp EN yazma) hiç çalışılmıyor.
 *
 * Burada dört alıştırma tipi var ve kelimenin olgunluğuna göre seçiliyor:
 * yeni kelime kolay tanıma sorusuyla tanıştırılır, olgunlaştıkça
 * üretime geçilir.
 *
 * Saf mantık: DOM'a, depolamaya ve global duruma dokunmaz.
 */
import { readSchedule } from './scheduler.js';

/**
 * @typedef {'choice-en-tr'|'choice-tr-en'|'type-en'|'cloze'|'recall'} ExerciseType
 */

export const TYPES = {
	/** İngilizce görülür, doğru Türkçe karşılık seçilir. En kolay: tanıma. */
	CHOICE_EN_TR: 'choice-en-tr',
	/** Türkçe görülür, doğru İngilizce seçilir. Üretim yönü, tanıma seviyesi. */
	CHOICE_TR_EN: 'choice-tr-en',
	/** Türkçe görülür, İngilizce YAZILIR. Gerçek üretim. */
	TYPE_EN: 'type-en',
	/** Örnek cümlede boşluk doldurulur. Bağlamda üretim - en zorlayıcı. */
	CLOZE: 'cloze',
	/** Klasik kart: aç ve kendini değerlendir. Olgun kelimelerin bakımı için. */
	RECALL: 'recall'
};

const DEFAULT_OPTION_COUNT = 4;

/** Olgun kelime: bakım moduna geçmiş sayılır (gün). */
const MATURE_INTERVAL = 21;

function shuffle(arr, random = Math.random) {
	const out = arr.slice();
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}

/**
 * Kelimenin olgunluğuna göre alıştırma tipi seçer.
 *
 * Aşamalar:
 *   ilk görüş     -> çoktan seçmeli EN->TR   (tanıştırma)
 *   1-2 tekrar    -> çoktan seçmeli TR->EN   (üretim yönü, kolay)
 *   3+ tekrar     -> yazarak / boşluk doldurma (gerçek üretim)
 *   olgun (21g+)  -> klasik kart             (bakım, hız önemli)
 *
 * @param {object} word
 * @param {{random?: () => number, allowCloze?: boolean}} [options]
 * @returns {ExerciseType}
 */
export function pickType(word, { random = Math.random, allowCloze = true } = {}) {
	const { reps, interval } = readSchedule(word);

	if (interval >= MATURE_INTERVAL) return TYPES.RECALL;
	if (reps === 0) return TYPES.CHOICE_EN_TR;
	if (reps <= 2) return TYPES.CHOICE_TR_EN;

	// Olgunlaşan kelimede üretim: cümle varsa boşluk doldurma daha
	// öğretici, yoksa düz yazma.
	const canCloze = allowCloze && !!findSurfaceForm(word.en, word.example);
	if (canCloze && random() < 0.6) return TYPES.CLOZE;
	return TYPES.TYPE_EN;
}

/**
 * Kelimenin cümlede hangi biçimde geçtiğini bulur.
 * "bury" -> "Our dog buries bones." içinde "buries".
 *
 * @returns {{form: string, index: number}|null}
 */
export function findSurfaceForm(word, sentence) {
	const w = String(word || '').trim().toLowerCase();
	const text = String(sentence || '');
	if (!w || !text) return null;
	// Çok kelimeli ifadelerde boşluk doldurma karışık oluyor, atla
	if (/[\s-]/.test(w)) return null;

	const forms = [w, w + 's', w + 'es', w + 'ed', w + 'ing', w + 'd'];
	if (w.endsWith('e')) forms.push(w.slice(0, -1) + 'ing', w + 'd');
	if (w.endsWith('y')) forms.push(w.slice(0, -1) + 'ies', w.slice(0, -1) + 'ied');

	// Unsuz ikizlesmesi: "run" -> "running", "stop" -> "stopped".
	// Tek heceli, unsuz-unlu-unsuz ile biten kelimelerde son unsuz ikilenir.
	if (/^[a-z]*[bcdfghjklmnpqrstvwxz][aeiou][bcdfgklmnprstvz]$/.test(w)) {
		const doubled = w + w[w.length - 1];
		forms.push(doubled + 'ing', doubled + 'ed', doubled + 'er');
	}

	// Uzun biçimi önce dene: "buries" aranırken "bury" yanlış eşleşmesin
	forms.sort((a, b) => b.length - a.length);

	for (const form of forms) {
		const re = new RegExp('\\b' + form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
		const match = re.exec(text);
		if (match) return { form: match[0], index: match.index };
	}
	return null;
}

/**
 * Yanıltıcı seçenekler üretir.
 * Aynı seviyeden seçilmeye çalışılır: seçenekler benzer zorlukta olsun.
 */
function pickDistractors(word, pool, count, field, random) {
	const seen = new Set([normalize(word[field])]);
	const sameLevel = pool.filter((w) => w.cefr === word.cefr && w.id !== word.id);
	const source = sameLevel.length >= count * 3 ? sameLevel : pool;

	const out = [];
	for (const candidate of shuffle(source, random)) {
		if (out.length >= count) break;
		if (candidate.id === word.id) continue;
		const key = normalize(candidate[field]);
		if (!key || seen.has(key)) continue;
		seen.add(key);
		out.push(candidate);
	}
	return out;
}

/**
 * Bir alıştırma üretir.
 *
 * @param {object} word
 * @param {object[]} pool Yanıltıcı havuzu
 * @param {{type?: ExerciseType, random?: () => number, optionCount?: number}} [options]
 * @returns {object}
 */
export function buildExercise(word, pool, options = {}) {
	const random = options.random || Math.random;
	const optionCount = options.optionCount || DEFAULT_OPTION_COUNT;
	const type = options.type || pickType(word, { random });

	const base = { wordId: word.id, type, word };

	if (type === TYPES.CHOICE_EN_TR) {
		const distractors = pickDistractors(word, pool, optionCount - 1, 'tr', random);
		const choices = shuffle([word, ...distractors], random);
		return {
			...base,
			prompt: word.en,
			promptLang: 'en',
			instruction: 'Doğru Türkçe karşılığı seç',
			options: choices.map((w) => w.tr),
			correctIndex: choices.findIndex((w) => w.id === word.id),
			answer: word.tr
		};
	}

	if (type === TYPES.CHOICE_TR_EN) {
		const distractors = pickDistractors(word, pool, optionCount - 1, 'en', random);
		const choices = shuffle([word, ...distractors], random);
		return {
			...base,
			prompt: word.tr,
			promptLang: 'tr',
			instruction: 'Doğru İngilizce karşılığı seç',
			options: choices.map((w) => w.en),
			correctIndex: choices.findIndex((w) => w.id === word.id),
			answer: word.en
		};
	}

	if (type === TYPES.CLOZE) {
		const found = findSurfaceForm(word.en, word.example);
		if (!found) {
			// Cümlede bulunamadıysa düz yazmaya düş
			return buildExercise(word, pool, { ...options, type: TYPES.TYPE_EN });
		}
		const before = word.example.slice(0, found.index);
		const after = word.example.slice(found.index + found.form.length);
		return {
			...base,
			prompt: word.tr,
			promptLang: 'tr',
			instruction: 'Cümledeki boşluğu doldur',
			sentence: { before, after, blank: found.form },
			sentenceTr: word.exampleTr || '',
			answer: found.form,
			// Kök hâli de kabul edilir: çekimi bilmemek kelimeyi
			// bilmemek değildir.
			accepted: [found.form, word.en]
		};
	}

	// TYPE_EN
	return {
		...base,
		prompt: word.tr,
		promptLang: 'tr',
		instruction: 'İngilizcesini yaz',
		hint: word.en.length > 3 ? word.en[0] + '·'.repeat(word.en.length - 1) : null,
		answer: word.en,
		accepted: [word.en, ...(word.synonyms || [])]
	};
}

/** Karşılaştırma için metni sadeleştirir. */
function normalize(text) {
	return String(text || '')
		.toLowerCase()
		.trim()
		.replace(/["'’.,!?;:()]/g, '')
		.replace(/\s+/g, ' ');
}

/**
 * Cevabı denetler.
 *
 * Yazılan cevapta noktalama ve büyük/küçük harf yok sayılır; anlamı
 * bilmek yazımı harfi harfine bilmekten önemli. Ama harf hatası kabul
 * edilmez — yazımı da öğrenmek gerekiyor.
 *
 * @param {object} exercise
 * @param {string|number} input Yazılan metin ya da seçilen şık numarası
 * @returns {{correct: boolean, rating: 'again'|'good', expected: string}}
 */
export function checkAnswer(exercise, input) {
	const expected = exercise.answer;

	if (exercise.options) {
		const correct = Number(input) === exercise.correctIndex;
		return { correct, rating: correct ? 'good' : 'again', expected };
	}

	const given = normalize(input);
	const accepted = (exercise.accepted || [expected]).map(normalize).filter(Boolean);
	const correct = accepted.includes(given);
	return { correct, rating: correct ? 'good' : 'again', expected };
}

/**
 * Yazılan cevap doğruya çok mu yakın? (tek harf hatası)
 * Kullanıcıya "az kaldı" geri bildirimi vermek için.
 */
export function isNearMiss(exercise, input) {
	if (exercise.options) return false;
	const given = normalize(input);
	if (!given) return false;
	return (exercise.accepted || [exercise.answer])
		.map(normalize)
		.some((a) => editDistance(given, a) === 1);
}

/** Levenshtein uzaklığı. Kısa kelimeler için yeterince hızlı. */
export function editDistance(a, b) {
	if (a === b) return 0;
	if (!a.length) return b.length;
	if (!b.length) return a.length;

	let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
	for (let i = 1; i <= a.length; i++) {
		const cur = [i];
		for (let j = 1; j <= b.length; j++) {
			cur[j] = Math.min(
				prev[j] + 1,
				cur[j - 1] + 1,
				prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
			);
		}
		prev = cur;
	}
	return prev[b.length];
}
