/**
 * Seviye belirleme testi.
 *
 * Basamaklı (staircase) uyarlanabilir test: A2'den başlar, her seviyede
 * birkaç soru sorar ve sonuca göre yukarı/aşağı gider. Sabit 50 soruluk
 * bir testten hem daha kısa hem de daha bilgilendirici — kullanıcı kendi
 * seviyesinin etrafındaki sorulara cevap verir.
 *
 * Saf mantık: DOM'a ve store'a dokunmaz, test edilebilir.
 */

export const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

/** Testin başladığı seviye. A2, çoğu öğrenen için makul bir orta nokta. */
const START_INDEX = 1;

export const DEFAULTS = {
	questionsPerLevel: 4,
	/** Bu oranın üstü: bir üst seviyeye geç. */
	promoteRatio: 0.75,
	/** Bu oranın altı: bir alt seviyeye in. */
	demoteRatio: 0.5,
	maxQuestions: 24,
	optionCount: 4
};

/**
 * Basit deterministik karıştırıcı — test edilebilirlik için dışarıdan
 * rastgelelik alır.
 */
function shuffle(arr, random = Math.random) {
	const out = arr.slice();
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}

/**
 * Seviyeye göre gruplanmış kelime havuzu hazırlar.
 * @param {object[]} words
 * @returns {Record<string, object[]>}
 */
export function groupByLevel(words) {
	const groups = {};
	for (const level of CEFR_ORDER) groups[level] = [];
	for (const w of words) {
		if (w.cefr && groups[w.cefr]) groups[w.cefr].push(w);
	}
	return groups;
}

/**
 * Bir soru üretir: hedef kelime + yanıltıcı seçenekler.
 *
 * Yanıltıcılar öncelikle aynı seviyeden seçilir; aynı seviyede yeterli
 * kelime yoksa diğer seviyelerden tamamlanır. Aynı Türkçe karşılığa sahip
 * seçenek olmaz — aksi hâlde soru cevapsız kalır.
 *
 * @param {object} word Doğru cevabın kelimesi
 * @param {object[]} pool Yanıltıcı havuzu
 * @param {{optionCount?: number, random?: () => number}} [options]
 */
export function buildQuestion(word, pool, { optionCount = DEFAULTS.optionCount, random = Math.random } = {}) {
	const seen = new Set([normalizeMeaning(word.tr)]);
	const distractors = [];

	for (const candidate of shuffle(pool, random)) {
		if (distractors.length >= optionCount - 1) break;
		if (candidate.id === word.id) continue;
		const key = normalizeMeaning(candidate.tr);
		if (seen.has(key)) continue;
		seen.add(key);
		distractors.push(candidate);
	}

	const options = shuffle([word, ...distractors], random).map((w) => w.tr);
	return {
		wordId: word.id,
		en: word.en,
		cefr: word.cefr,
		options,
		correctIndex: options.indexOf(word.tr)
	};
}

function normalizeMeaning(tr) {
	return String(tr || '').trim().toLowerCase();
}

/**
 * Test oturumu oluşturur.
 *
 * @param {object[]} words CEFR seviyesi olan kelimeler
 * @param {object} [config]
 * @returns {object|null} Yeterli kelime yoksa null
 */
export function createSession(words, config = {}) {
	const opts = { ...DEFAULTS, ...config };
	const random = config.random || Math.random;
	const groups = groupByLevel(words);

	// Test için her seviyede en az soru sayısı kadar kelime gerekli.
	const usable = CEFR_ORDER.filter((l) => groups[l].length >= opts.questionsPerLevel);
	if (usable.length < 2) return null;

	const allWords = words.filter((w) => w.cefr);

	const state = {
		levelIndex: clampToUsable(START_INDEX, usable),
		asked: 0,
		visited: new Set(),
		perLevel: {},
		history: [],
		done: false,
		result: null,
		usedIds: new Set()
	};

	function clampToUsable(index, list) {
		const level = CEFR_ORDER[index];
		if (list.includes(level)) return index;
		// En yakın kullanılabilir seviyeye kay
		let best = CEFR_ORDER.indexOf(list[0]);
		let bestDist = Math.abs(best - index);
		for (const l of list) {
			const i = CEFR_ORDER.indexOf(l);
			const d = Math.abs(i - index);
			if (d < bestDist) {
				best = i;
				bestDist = d;
			}
		}
		return best;
	}

	function currentLevel() {
		return CEFR_ORDER[state.levelIndex];
	}

	function nextQuestion() {
		if (state.done) return null;

		const level = currentLevel();
		const available = groups[level].filter((w) => !state.usedIds.has(w.id));
		if (!available.length) {
			finish(level);
			return null;
		}

		const word = shuffle(available, random)[0];
		state.usedIds.add(word.id);

		const sameLevel = groups[level].filter((w) => w.id !== word.id);
		const pool = sameLevel.length >= opts.optionCount * 2 ? sameLevel : allWords;
		return buildQuestion(word, pool, { optionCount: opts.optionCount, random });
	}

	/**
	 * Cevabı kaydeder ve gerekirse seviye değiştirir.
	 * @param {boolean} correct
	 */
	function answer(correct) {
		if (state.done) return;

		const level = currentLevel();
		const bucket = (state.perLevel[level] = state.perLevel[level] || { asked: 0, correct: 0 });
		bucket.asked++;
		if (correct) bucket.correct++;
		state.asked++;
		state.history.push({ level, correct });

		if (state.asked >= opts.maxQuestions) {
			finish(bestLevel());
			return;
		}
		if (bucket.asked < opts.questionsPerLevel) return;

		// Seviye tamamlandı: yukarı mı, aşağı mı, dur mu?
		state.visited.add(level);
		const ratio = bucket.correct / bucket.asked;

		if (ratio >= opts.promoteRatio) {
			const next = nextUsableIndex(state.levelIndex, 1);
			if (next === null) return finish(level);
			// Aynı seviyeye geri dönüp döngüye girmeyi engelle
			if (state.visited.has(CEFR_ORDER[next])) return finish(bestLevel());
			state.levelIndex = next;
		} else if (ratio < opts.demoteRatio) {
			const prev = nextUsableIndex(state.levelIndex, -1);
			if (prev === null) return finish(level);
			if (state.visited.has(CEFR_ORDER[prev])) return finish(bestLevel());
			state.levelIndex = prev;
		} else {
			finish(level);
		}
	}

	function nextUsableIndex(from, step) {
		for (let i = from + step; i >= 0 && i < CEFR_ORDER.length; i += step) {
			if (usable.includes(CEFR_ORDER[i])) return i;
		}
		return null;
	}

	/**
	 * Geçilen en yüksek seviye: promoteRatio'yu tutturduğu en üst basamak.
	 * Hiçbirini tutturamadıysa en alttaki denenen seviye.
	 */
	function bestLevel() {
		let best = null;
		for (const level of CEFR_ORDER) {
			const b = state.perLevel[level];
			if (!b || !b.asked) continue;
			if (b.correct / b.asked >= opts.promoteRatio) best = level;
		}
		if (best) {
			// Geçtiği en üst seviyenin bir üstünü öner: orada zorlanacak.
			const i = CEFR_ORDER.indexOf(best);
			const next = usable.find((l) => CEFR_ORDER.indexOf(l) > i);
			return next || best;
		}
		const attempted = CEFR_ORDER.filter((l) => state.perLevel[l]);
		return attempted[0] || CEFR_ORDER[0];
	}

	function finish(level) {
		state.done = true;
		const totalAsked = state.asked;
		const totalCorrect = state.history.filter((h) => h.correct).length;
		state.result = {
			level,
			asked: totalAsked,
			correct: totalCorrect,
			ratio: totalAsked ? totalCorrect / totalAsked : 0,
			perLevel: { ...state.perLevel }
		};
	}

	return {
		nextQuestion,
		answer,
		get done() {
			return state.done;
		},
		get result() {
			return state.result;
		},
		get progress() {
			return { asked: state.asked, max: opts.maxQuestions, level: currentLevel() };
		}
	};
}

/**
 * Seviye ve altındaki tüm seviyeler — "B1 seçtim" dediğinde A1/A2 de
 * çalışma kapsamına girmeli.
 */
export function levelsUpTo(level) {
	const i = CEFR_ORDER.indexOf(level);
	return i === -1 ? [] : CEFR_ORDER.slice(0, i + 1);
}
