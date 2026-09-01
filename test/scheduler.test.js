/**
 * SM-2 zamanlayıcısının testleri.
 *
 * Kritik sözleşme: eski (level tabanlı) kayıtlar veri kaybetmeden
 * yeni sisteme geçmeli. 1.0'dan gelen kullanıcının aylarca süren
 * çalışması bir alan adı değişikliği yüzünden sıfırlanamaz.
 */
import { describe, expect, it } from 'vitest';
import {
	applyRating,
	EASE_DEFAULT,
	EASE_MAX,
	EASE_MIN,
	formatInterval,
	isLearned,
	LEARNED_INTERVAL,
	levelFor,
	previewIntervals,
	RATINGS,
	readSchedule
} from '../src/core/scheduler.js';

const T0 = '2026-09-01T00:00:00.000Z';

function card(overrides = {}) {
	return { id: 'w', en: 'test', tr: 'deneme', history: [], level: 0, ...overrides };
}

describe('readSchedule', () => {
	it('eksik alanları varsayılanlarla doldurur', () => {
		const s = readSchedule(card());
		expect(s.ease).toBe(EASE_DEFAULT);
		expect(s.interval).toBe(0);
		expect(s.reps).toBe(0);
	});

	it('regresyon: eski level alanından aralık türetir', () => {
		// 1.0 verisinde ease/interval yok. Level 5 = 30 günlük basamak.
		expect(readSchedule(card({ level: 5 })).interval).toBe(30);
		expect(readSchedule(card({ level: 6 })).interval).toBe(60);
		expect(readSchedule(card({ level: 1 })).interval).toBe(2);
	});

	it('mevcut interval alanı level yerine geçerlidir', () => {
		expect(readSchedule(card({ level: 1, interval: 42 })).interval).toBe(42);
	});

	it('geçmişten tekrar ve unutma sayısını çıkarır', () => {
		const s = readSchedule(card({
			history: [{ known: true }, { known: false }, { known: true }]
		}));
		expect(s.reps).toBe(2);
		expect(s.lapses).toBe(1);
	});

	it('kolaylık katsayısını geçerli aralığa sıkıştırır', () => {
		expect(readSchedule(card({ ease: 99 })).ease).toBe(EASE_MAX);
		expect(readSchedule(card({ ease: 0.1 })).ease).toBe(EASE_MIN);
		expect(readSchedule(card({ ease: 'bozuk' })).ease).toBe(EASE_DEFAULT);
	});

	it('bozuk girdide çökmez', () => {
		expect(() => readSchedule(null)).not.toThrow();
		expect(() => readSchedule({})).not.toThrow();
	});
});

describe('applyRating', () => {
	it('ilk doğru cevap 1 gün sonraya planlar', () => {
		expect(applyRating(card(), 'good', { now: T0 }).interval).toBe(1);
	});

	it('ilk cevapta "kolay" daha uzağa planlar', () => {
		expect(applyRating(card(), 'easy', { now: T0 }).interval).toBe(4);
	});

	it('aralık tekrarlarla açılır', () => {
		let w = card();
		const intervals = [];
		for (let i = 0; i < 5; i++) {
			w = applyRating(w, 'good', { now: T0 });
			intervals.push(w.interval);
		}
		// Her adım bir öncekinden büyük olmalı
		for (let i = 1; i < intervals.length; i++) {
			expect(intervals[i]).toBeGreaterThan(intervals[i - 1]);
		}
	});

	it('"zor" aralığı açar ama "iyi"den daha yavaş', () => {
		const base = card({ interval: 20, reps: 5, ease: EASE_DEFAULT });
		const hard = applyRating(base, 'hard', { now: T0 });
		const good = applyRating(base, 'good', { now: T0 });
		expect(hard.interval).toBeGreaterThan(base.interval);
		expect(hard.interval).toBeLessThan(good.interval);
	});

	it('"kolay" en uzun aralığı verir', () => {
		const base = card({ interval: 20, reps: 5 });
		const p = previewIntervals(base);
		expect(p.easy).toBeGreaterThan(p.good);
		expect(p.good).toBeGreaterThan(p.hard);
		expect(p.hard).toBeGreaterThan(p.again);
	});

	it('regresyon: "hiç hatırlamadım" ilerlemeyi tamamen silmez', () => {
		// 1.0'da tek yanlış cevap seviyeyi 0'a çekiyordu; aylarca
		// çalışılmış kelime hiç görülmemiş gibi ele alınıyordu.
		const base = card({ interval: 60, reps: 8, ease: 2.5, lapses: 0 });
		const after = applyRating(base, 'again', { now: T0 });
		expect(after.interval).toBe(1);
		expect(after.lapses).toBe(1);
		// Kolaylık katsayısı düşer ama taban değerin altına inmez
		expect(after.ease).toBeGreaterThanOrEqual(EASE_MIN);
		expect(after.ease).toBeLessThan(base.ease);
	});

	it('kolaylık katsayısı değerlendirmeye göre değişir', () => {
		const base = card({ interval: 10, reps: 3, ease: 2.5 });
		expect(applyRating(base, 'easy', { now: T0 }).ease).toBeGreaterThan(2.5);
		expect(applyRating(base, 'hard', { now: T0 }).ease).toBeLessThan(2.5);
		expect(applyRating(base, 'good', { now: T0 }).ease).toBe(2.5);
	});

	it('kolaylık katsayısı sınırların dışına çıkmaz', () => {
		let w = card({ ease: EASE_MIN, interval: 5, reps: 3 });
		for (let i = 0; i < 10; i++) w = applyRating(w, 'hard', { now: T0 });
		expect(w.ease).toBe(EASE_MIN);

		let e = card({ ease: EASE_MAX, interval: 5, reps: 3 });
		for (let i = 0; i < 10; i++) e = applyRating(e, 'easy', { now: T0 });
		expect(e.ease).toBe(EASE_MAX);
	});

	it('aralık 1 yılı aşmaz', () => {
		let w = card({ interval: 300, reps: 20, ease: EASE_MAX });
		for (let i = 0; i < 5; i++) w = applyRating(w, 'easy', { now: T0 });
		expect(w.interval).toBeLessThanOrEqual(365);
	});

	it('cevabı geçmişe değerlendirmesiyle birlikte yazar', () => {
		const w = applyRating(card(), 'hard', { now: T0 });
		expect(w.history).toHaveLength(1);
		expect(w.history[0]).toEqual({ date: T0, known: true, rating: 'hard' });
	});

	it('"hiç hatırlamadım" geçmişte known:false olarak durur', () => {
		const w = applyRating(card(), 'again', { now: T0 });
		expect(w.history[0].known).toBe(false);
	});

	it('girdiyi değiştirmez', () => {
		const original = card({ interval: 10, reps: 3 });
		const snapshot = JSON.stringify(original);
		applyRating(original, 'good', { now: T0 });
		expect(JSON.stringify(original)).toBe(snapshot);
	});

	it('geçersiz değerlendirmede "iyi" varsayar', () => {
		const a = applyRating(card(), /** @type {any} */ ('sacma'), { now: T0 });
		const b = applyRating(card(), 'good', { now: T0 });
		expect(a.interval).toBe(b.interval);
	});

	it('level alanını aralığa göre günceller', () => {
		const w = applyRating(card({ interval: 40, reps: 6 }), 'good', { now: T0 });
		expect(w.level).toBe(levelFor(w.interval));
	});
});

describe('levelFor / isLearned', () => {
	it('aralığı basamağa çevirir', () => {
		expect(levelFor(0)).toBe(0);
		expect(levelFor(1)).toBe(0);
		expect(levelFor(4)).toBe(2);
		expect(levelFor(30)).toBe(5);
		expect(levelFor(120)).toBe(6);
	});

	it('öğrenilmiş eşiği aralığa dayanır', () => {
		expect(isLearned(card({ interval: LEARNED_INTERVAL }))).toBe(true);
		expect(isLearned(card({ interval: LEARNED_INTERVAL - 1 }))).toBe(false);
	});

	it('eski level 6 kayıtları öğrenilmiş sayılır', () => {
		expect(isLearned(card({ level: 6 }))).toBe(true);
	});
});

describe('previewIntervals', () => {
	it('her seçenek için gün döner', () => {
		const p = previewIntervals(card());
		for (const r of RATINGS) expect(p[r]).toBeGreaterThan(0);
	});
});

describe('formatInterval', () => {
	it('okunur etiket üretir', () => {
		expect(formatInterval(1)).toBe('1 gün');
		expect(formatInterval(12)).toBe('12 gün');
		expect(formatInterval(30)).toBe('1 ay');
		expect(formatInterval(90)).toBe('3 ay');
		expect(formatInterval(365)).toBe('1 yıl');
	});
});
