/**
 * SRS çekirdeğinin birim testleri.
 *
 * Buradaki testlerin çoğu, 1.1.0 öncesinde gerçekten var olan hataları
 * bir daha geri gelmesin diye kilitler. Test adlarında "regresyon" geçen
 * maddeler bu türden.
 */
import { describe, expect, it } from 'vitest';
import {
	applyResult,
	buildReviewQueue,
	correctStreak,
	INTERVALS,
	isLearned,
	LEARNED_STREAK,
	MAX_LEVEL,
	scheduleNext
} from '../src/core/srs.js';
import { addDays, isDue, todayISO } from '../src/core/time.js';

const T0 = '2026-06-15T00:00:00.000Z';

/** Test kelimesi üretir. */
function word(overrides = {}) {
	return {
		id: 'w1',
		en: 'test',
		tr: 'deneme',
		example: '',
		tags: [],
		level: 0,
		nextReviewAt: T0,
		createdAt: T0,
		history: [],
		...overrides
	};
}

/** n gün sonrası/öncesi. */
const day = (n) => addDays(todayISO(), n);

describe('scheduleNext', () => {
	it('her seviye için tanımlı aralığı kullanır', () => {
		INTERVALS.forEach((days, level) => {
			expect(scheduleNext(level, T0)).toBe(addDays(T0, days));
		});
	});

	it('sınır dışı seviyeleri kırpar', () => {
		expect(scheduleNext(99, T0)).toBe(addDays(T0, INTERVALS[MAX_LEVEL]));
		expect(scheduleNext(-5, T0)).toBe(addDays(T0, INTERVALS[0]));
	});
});

describe('correctStreak', () => {
	it('boş geçmişte 0 döner', () => {
		expect(correctStreak(word())).toBe(0);
	});

	it('sondan geriye kesintisiz doğruları sayar', () => {
		const w = word({ history: [{ known: true }, { known: true }, { known: true }] });
		expect(correctStreak(w)).toBe(3);
	});

	it('regresyon: aradaki yanlış seriyi sıfırlar (toplam doğru sayılmaz)', () => {
		// 5 doğru var ama sonuncudan hemen önce yanlış: eski sürüm bunu
		// "öğrenilmiş" sayıyordu.
		const w = word({
			history: [
				{ known: true }, { known: true }, { known: true },
				{ known: true }, { known: false }, { known: true }
			]
		});
		expect(correctStreak(w)).toBe(1);
	});

	it('history alanı yoksa çökmez', () => {
		expect(correctStreak({})).toBe(0);
		expect(correctStreak({ history: null })).toBe(0);
	});
});

describe('applyResult', () => {
	it('doğru cevap seviyeyi bir artırır', () => {
		const next = applyResult(word({ level: 2 }), true, T0);
		expect(next.level).toBe(3);
		expect(next.nextReviewAt).toBe(addDays(T0, INTERVALS[3]));
	});

	it('yanlış cevap seviyeyi sıfırlar', () => {
		const next = applyResult(word({ level: 5 }), false, T0);
		expect(next.level).toBe(0);
		expect(next.nextReviewAt).toBe(addDays(T0, INTERVALS[0]));
	});

	it('girdiyi değiştirmez (saf fonksiyon)', () => {
		const original = word({ level: 1 });
		const snapshot = JSON.parse(JSON.stringify(original));
		applyResult(original, true, T0);
		expect(original).toEqual(snapshot);
	});

	it('cevabı geçmişe ekler', () => {
		const next = applyResult(word(), true, T0);
		expect(next.history).toEqual([{ date: T0, known: true }]);
	});

	it(`üst üste ${LEARNED_STREAK} doğrudan sonra öğrenilmiş sayar`, () => {
		let w = word();
		for (let i = 0; i < LEARNED_STREAK; i++) w = applyResult(w, true, T0);
		expect(isLearned(w)).toBe(true);
		expect(w.level).toBe(MAX_LEVEL);
	});

	it('regresyon: araya yanlış girerse öğrenilmiş saymaz', () => {
		let w = word();
		for (let i = 0; i < 4; i++) w = applyResult(w, true, T0);
		w = applyResult(w, false, T0); // seri kırıldı
		for (let i = 0; i < 4; i++) w = applyResult(w, true, T0);
		expect(isLearned(w)).toBe(false);
	});

	it('history alanı olmayan kayıtta çökmez', () => {
		const next = applyResult({ en: 'x', tr: 'y', level: 0 }, true, T0);
		expect(next.history).toHaveLength(1);
	});
});

describe('buildReviewQueue', () => {
	const words = [
		word({ id: 'gecikmis', level: 1, nextReviewAt: day(-5) }),
		word({ id: 'bugun', level: 0, nextReviewAt: day(0) }),
		word({ id: 'gelecek', level: 3, nextReviewAt: day(7) }),
		word({ id: 'ogrenilmis', level: MAX_LEVEL, nextReviewAt: day(-10) })
	];

	it('regresyon: normal tekrar SADECE zamanı gelenleri alır', () => {
		// Eski sürümde isDue hiç çağrılmıyordu; "gelecek" de kuyruğa giriyordu.
		const q = buildReviewQueue(words, { free: false, isDue });
		expect(q.map((w) => w.id)).toEqual(['gecikmis', 'bugun']);
	});

	it('en çok gecikmiş kelime başta gelir', () => {
		const q = buildReviewQueue(words, { free: false, isDue });
		expect(q[0].id).toBe('gecikmis');
	});

	it('serbest tekrar zamanı gelmemişleri de alır', () => {
		const q = buildReviewQueue(words, { free: true, isDue, shuffle: (a) => a });
		expect(q.map((w) => w.id)).toEqual(['gecikmis', 'bugun', 'gelecek']);
	});

	it('öğrenilmiş kelimeler hiçbir modda kuyruğa girmez', () => {
		for (const free of [true, false]) {
			const q = buildReviewQueue(words, { free, isDue, shuffle: (a) => a });
			expect(q.some((w) => w.id === 'ogrenilmis')).toBe(false);
		}
	});

	it('kaynak diziyi değiştirmez', () => {
		const snapshot = words.map((w) => w.id);
		buildReviewQueue(words, { free: true, isDue });
		expect(words.map((w) => w.id)).toEqual(snapshot);
	});
});
