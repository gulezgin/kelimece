/**
 * Seviye belirleme testinin mantık testleri.
 *
 * Rastgelelik dışarıdan veriliyor, böylece testler deterministik.
 */
import { describe, expect, it } from 'vitest';
import { buildQuestion, CEFR_ORDER, createSession, groupByLevel, levelsUpTo } from '../src/core/placement.js';

/** Deterministik "rastgele": hep 0 döner, yani sıra korunur. */
const noShuffle = () => 0;

function word(id, cefr, tr = 'anlam-' + id) {
	return { id, en: 'w' + id, tr, cefr };
}

/** Her seviyede n kelime olan havuz. */
function pool(perLevel = 6) {
	const words = [];
	for (const level of CEFR_ORDER) {
		for (let i = 0; i < perLevel; i++) words.push(word(`${level}-${i}`, level, `${level} anlam ${i}`));
	}
	return words;
}

describe('groupByLevel', () => {
	it('kelimeleri seviyeye göre ayırır', () => {
		const g = groupByLevel([word(1, 'A1'), word(2, 'A1'), word(3, 'C2')]);
		expect(g.A1).toHaveLength(2);
		expect(g.C2).toHaveLength(1);
		expect(g.B1).toHaveLength(0);
	});

	it('seviyesi olmayanları yok sayar', () => {
		const g = groupByLevel([word(1, null), word(2, 'A1')]);
		expect(Object.values(g).flat()).toHaveLength(1);
	});
});

describe('buildQuestion', () => {
	const target = word('t', 'A1', 'kedi');
	const distractors = [word('d1', 'A1', 'köpek'), word('d2', 'A1', 'kuş'), word('d3', 'A1', 'balık')];

	it('doğru cevabı seçenekler arasına koyar', () => {
		const q = buildQuestion(target, distractors, { random: noShuffle });
		expect(q.options).toContain('kedi');
		expect(q.options[q.correctIndex]).toBe('kedi');
	});

	it('istenen sayıda seçenek üretir', () => {
		const q = buildQuestion(target, distractors, { optionCount: 4, random: noShuffle });
		expect(q.options).toHaveLength(4);
	});

	it('hedef kelimeyi yanıltıcı olarak kullanmaz', () => {
		const q = buildQuestion(target, [target, ...distractors], { random: noShuffle });
		expect(q.options.filter((o) => o === 'kedi')).toHaveLength(1);
	});

	it('aynı anlamlı seçenek üretmez', () => {
		// Aksi hâlde sorunun iki doğru cevabı olurdu.
		const dupes = [word('d1', 'A1', 'kedi'), word('d2', 'A1', 'köpek'), word('d3', 'A1', 'kuş')];
		const q = buildQuestion(target, dupes, { random: noShuffle });
		expect(new Set(q.options).size).toBe(q.options.length);
	});

	it('havuz küçükse daha az seçenekle döner, çökmez', () => {
		const q = buildQuestion(target, [word('d1', 'A1', 'köpek')], { random: noShuffle });
		expect(q.options.length).toBeGreaterThanOrEqual(2);
		expect(q.options[q.correctIndex]).toBe('kedi');
	});
});

describe('createSession', () => {
	it('yeterli kelime yoksa null döner', () => {
		expect(createSession([word(1, 'A1')])).toBeNull();
		expect(createSession([])).toBeNull();
	});

	it('A2 seviyesinden başlar', () => {
		const s = createSession(pool(), { random: noShuffle });
		expect(s.progress.level).toBe('A2');
	});

	it('soru üretir', () => {
		const s = createSession(pool(), { random: noShuffle });
		const q = s.nextQuestion();
		expect(q.en).toBeTruthy();
		expect(q.options.length).toBeGreaterThan(1);
	});

	it('aynı kelimeyi iki kez sormaz', () => {
		const s = createSession(pool(20), { random: Math.random });
		const seen = new Set();
		for (let i = 0; i < 10 && !s.done; i++) {
			const q = s.nextQuestion();
			if (!q) break;
			expect(seen.has(q.wordId)).toBe(false);
			seen.add(q.wordId);
			s.answer(true);
		}
	});

	it('hep doğru cevaplayınca seviye yükselir', () => {
		const s = createSession(pool(20), { random: noShuffle, questionsPerLevel: 4 });
		const levels = [];
		while (!s.done) {
			levels.push(s.progress.level);
			if (!s.nextQuestion()) break;
			s.answer(true);
		}
		expect(s.result.level).toBe('C2');
		// A2'den başlayıp yukarı çıkmalı
		expect(levels[0]).toBe('A2');
		expect(CEFR_ORDER.indexOf(levels[levels.length - 1])).toBeGreaterThan(1);
	});

	it('hep yanlış cevaplayınca en alt seviyeye iner', () => {
		const s = createSession(pool(20), { random: noShuffle, questionsPerLevel: 4 });
		while (!s.done) {
			if (!s.nextQuestion()) break;
			s.answer(false);
		}
		expect(s.result.level).toBe('A1');
	});

	it('orta performansta bulunduğu seviyede durur', () => {
		const s = createSession(pool(20), { random: noShuffle, questionsPerLevel: 4 });
		// 4 soruda 2 doğru = %50 -> ne yükselt ne indir
		const pattern = [true, false, true, false];
		let i = 0;
		while (!s.done && i < 4) {
			if (!s.nextQuestion()) break;
			s.answer(pattern[i++]);
		}
		expect(s.done).toBe(true);
		expect(s.result.level).toBe('A2');
	});

	it('soru üst sınırını aşmaz', () => {
		const s = createSession(pool(30), { random: Math.random, maxQuestions: 8, questionsPerLevel: 2 });
		let asked = 0;
		while (!s.done && asked < 50) {
			if (!s.nextQuestion()) break;
			s.answer(Math.random() > 0.5);
			asked++;
		}
		expect(asked).toBeLessThanOrEqual(8);
		expect(s.done).toBe(true);
	});

	it('sonuç özeti tutarlı', () => {
		const s = createSession(pool(20), { random: noShuffle, questionsPerLevel: 4 });
		while (!s.done) {
			if (!s.nextQuestion()) break;
			s.answer(true);
		}
		const r = s.result;
		expect(r.correct).toBe(r.asked);
		expect(r.ratio).toBe(1);
		expect(CEFR_ORDER).toContain(r.level);
	});

	it('bitmiş oturumda cevap kabul etmez', () => {
		const s = createSession(pool(20), { random: noShuffle, questionsPerLevel: 2, maxQuestions: 2 });
		s.nextQuestion();
		s.answer(true);
		s.nextQuestion();
		s.answer(true);
		const before = JSON.stringify(s.result);
		s.answer(false);
		expect(JSON.stringify(s.result)).toBe(before);
	});

	it('bazı seviyelerde kelime yoksa çalışmaya devam eder', () => {
		const words = [
			...Array.from({ length: 8 }, (_, i) => word('a' + i, 'A1')),
			...Array.from({ length: 8 }, (_, i) => word('b' + i, 'B1'))
		];
		const s = createSession(words, { random: noShuffle, questionsPerLevel: 4 });
		expect(s).not.toBeNull();
		while (!s.done) {
			if (!s.nextQuestion()) break;
			s.answer(true);
		}
		expect(['A1', 'B1']).toContain(s.result.level);
	});
});

describe('levelsUpTo', () => {
	it('seviye ve altındakileri döner', () => {
		expect(levelsUpTo('B1')).toEqual(['A1', 'A2', 'B1']);
		expect(levelsUpTo('A1')).toEqual(['A1']);
		expect(levelsUpTo('C2')).toEqual(CEFR_ORDER);
	});

	it('geçersiz seviyede boş dizi döner', () => {
		expect(levelsUpTo('Z9')).toEqual([]);
		expect(levelsUpTo(null)).toEqual([]);
	});
});
