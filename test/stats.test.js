/**
 * İstatistik hesaplamalarının testleri.
 *
 * Bu sayılar kullanıcıya "ne kadar yol aldım" diye gösteriliyor;
 * yanlış olurlarsa güven kaybı yaratır.
 */
import { describe, expect, it } from 'vitest';
import {
	dailyActivity,
	estimatedVocabulary,
	hardestWords,
	maturityBreakdown,
	recallRate,
	studyHistory,
	upcomingLoad
} from '../src/core/stats.js';

const NOW = new Date('2026-09-01T12:00:00');
const DAY = 24 * 60 * 60 * 1000;

/** n gün önce/sonra, ISO. */
function day(n, base = NOW) {
	return new Date(base.getTime() + n * DAY).toISOString();
}

function word(overrides = {}) {
	return {
		id: 'w',
		en: 'test',
		tr: 'deneme',
		history: [],
		interval: 0,
		ease: 2.5,
		lapses: 0,
		nextReviewAt: day(0),
		...overrides
	};
}

describe('dailyActivity', () => {
	it('cevapları güne göre toplar', () => {
		const words = [
			word({ history: [{ date: day(0), known: true }, { date: day(0), known: false }] }),
			word({ history: [{ date: day(-1), known: true }] })
		];
		const rows = dailyActivity(words, { days: 3, now: NOW });
		const today = rows[rows.length - 1];
		expect(today.total).toBe(2);
		expect(today.correct).toBe(1);
		expect(today.accuracy).toBe(0.5);
		expect(rows[rows.length - 2].total).toBe(1);
	});

	it('istenen gün sayısı kadar satır döner', () => {
		expect(dailyActivity([], { days: 14, now: NOW })).toHaveLength(14);
	});

	it('aralık dışındaki cevapları saymaz', () => {
		const words = [word({ history: [{ date: day(-90), known: true }] })];
		const rows = dailyActivity(words, { days: 7, now: NOW });
		expect(rows.reduce((s, r) => s + r.total, 0)).toBe(0);
	});

	it('bozuk tarihte çökmez', () => {
		const words = [word({ history: [{ date: 'gecersiz', known: true }, null] })];
		expect(() => dailyActivity(words, { days: 7, now: NOW })).not.toThrow();
	});

	it('kronolojik sırada döner', () => {
		const rows = dailyActivity([], { days: 5, now: NOW });
		for (let i = 1; i < rows.length; i++) {
			expect(rows[i].date.getTime()).toBeGreaterThan(rows[i - 1].date.getTime());
		}
	});
});

describe('recallRate', () => {
	const words = [
		word({ history: [{ date: day(0), known: true }, { date: day(-1), known: false }] }),
		word({ history: [{ date: day(-40), known: true }] })
	];

	it('tüm geçmişte doğru oranını verir', () => {
		const r = recallRate(words);
		expect(r.total).toBe(3);
		expect(r.correct).toBe(2);
		expect(r.rate).toBeCloseTo(2 / 3);
	});

	it('süre kısıtı uygulanabilir', () => {
		const r = recallRate(words, { sinceDays: 7, now: NOW });
		expect(r.total).toBe(2);
	});

	it('geçmiş yoksa sıfır döner, bölme hatası vermez', () => {
		const r = recallRate([word()]);
		expect(r.total).toBe(0);
		expect(r.rate).toBe(0);
	});
});

describe('maturityBreakdown', () => {
	it('kelimeleri aşamalara ayırır', () => {
		const words = [
			word({ interval: 0 }),                                      // hiç çalışılmamış
			word({ interval: 2, history: [{ date: day(0), known: true }] }),  // öğreniliyor
			word({ interval: 10, history: [{ date: day(0), known: true }] }), // genç
			word({ interval: 30, history: [{ date: day(0), known: true }] }), // pekişiyor
			word({ interval: 90, history: [{ date: day(0), known: true }] })  // öğrenilmiş
		];
		const b = maturityBreakdown(words);
		expect(b.untouched).toBe(1);
		expect(b.learning).toBe(1);
		expect(b.young).toBe(1);
		expect(b.maturing).toBe(1);
		expect(b.learned).toBe(1);
		expect(b.total).toBe(5);
	});

	it('toplam her zaman kelime sayısına eşit', () => {
		const words = Array.from({ length: 20 }, (_, i) => word({ interval: i * 5 }));
		const b = maturityBreakdown(words);
		expect(b.untouched + b.learning + b.young + b.maturing + b.learned).toBe(20);
	});
});

describe('hardestWords', () => {
	it('en çok unutulanı öne alır', () => {
		const words = [
			word({ id: 'kolay', lapses: 0, ease: 2.6, history: [{ date: day(0), known: true }] }),
			word({ id: 'zor', lapses: 5, ease: 1.5, history: [{ date: day(0), known: false }] }),
			word({ id: 'orta', lapses: 1, ease: 2.3, history: [{ date: day(0), known: false }] })
		];
		const hard = hardestWords(words);
		expect(hard[0].word.id).toBe('zor');
		expect(hard.map((h) => h.word.id)).not.toContain('kolay');
	});

	it('hiç çalışılmamış kelimeyi zor saymaz', () => {
		const words = [word({ id: 'yeni', lapses: 0, history: [] })];
		expect(hardestWords(words)).toEqual([]);
	});

	it('sınır uygulanır', () => {
		const words = Array.from({ length: 30 }, (_, i) =>
			word({ id: 'w' + i, lapses: i + 1, history: [{ date: day(0), known: false }] })
		);
		expect(hardestWords(words, { limit: 5 })).toHaveLength(5);
	});
});

describe('upcomingLoad', () => {
	it('geciken ve gelecek yükü ayırır', () => {
		const words = [
			word({ interval: 5, nextReviewAt: day(-3) }),
			word({ interval: 5, nextReviewAt: day(0) }),
			word({ interval: 5, nextReviewAt: day(2) }),
			word({ interval: 5, nextReviewAt: day(2) })
		];
		const load = upcomingLoad(words, { days: 7, now: NOW });
		expect(load.overdue).toBe(1);
		expect(load.days[0].count).toBe(1);
		expect(load.days[2].count).toBe(2);
	});

	it('öğrenilmiş kelimeleri saymaz', () => {
		const words = [word({ interval: 90, nextReviewAt: day(1) })];
		const load = upcomingLoad(words, { days: 7, now: NOW });
		expect(load.days.reduce((s, d) => s + d.count, 0)).toBe(0);
	});

	it('aralık dışına düşen kelimeler görmezden gelinir', () => {
		const words = [word({ interval: 5, nextReviewAt: day(60) })];
		const load = upcomingLoad(words, { days: 7, now: NOW });
		expect(load.overdue).toBe(0);
		expect(load.days.reduce((s, d) => s + d.count, 0)).toBe(0);
	});
});

describe('studyHistory', () => {
	it('çalışılan gün sayısını ve en uzun seriyi bulur', () => {
		const words = [word({
			history: [
				{ date: day(-5), known: true },
				{ date: day(-4), known: true },
				{ date: day(-3), known: true },
				{ date: day(-1), known: true }
			]
		})];
		const h = studyHistory(words);
		expect(h.activeDays).toBe(4);
		expect(h.longestStreak).toBe(3);
	});

	it('aynı gün birden fazla cevap tek gün sayılır', () => {
		const words = [word({
			history: [
				{ date: day(0), known: true },
				{ date: day(0), known: true },
				{ date: day(0), known: false }
			]
		})];
		expect(studyHistory(words).activeDays).toBe(1);
	});

	it('geçmiş yoksa sıfır döner', () => {
		const h = studyHistory([word()]);
		expect(h.activeDays).toBe(0);
		expect(h.longestStreak).toBe(0);
		expect(h.firstDay).toBeNull();
	});
});

describe('estimatedVocabulary', () => {
	it('öğrenilmişleri tam, olgunlaşmakta olanları kısmen sayar', () => {
		const words = [
			...Array.from({ length: 10 }, () => word({ interval: 90, history: [{ date: day(0), known: true }] })),
			...Array.from({ length: 10 }, () => word({ interval: 30, history: [{ date: day(0), known: true }] }))
		];
		const est = estimatedVocabulary(words);
		expect(est).toBeGreaterThan(10);
		expect(est).toBeLessThan(20);
	});

	it('boş havuzda sıfır döner', () => {
		expect(estimatedVocabulary([])).toBe(0);
	});
});
