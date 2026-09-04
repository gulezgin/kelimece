/**
 * XP, haftalık hedef ve rozetler.
 *
 * Üçü birlikte test ediliyor çünkü ikisi XP'nin üstüne kurulu ve asıl
 * risk aradaki bağda: hedef hafta ortasında değişirse ya da XP günlük
 * kayıtları yanlış budanırsa hata ancak günler sonra fark edilir.
 */
import { describe, expect, it } from 'vitest';
import {
	challengeRecord,
	challengeStatus,
	MAX_GOAL,
	MIN_GOAL,
	STARTER_GOAL,
	weeklyGoal
} from '../src/core/challenge.js';
import { BADGES, earnedCount, evaluateBadges, nextBadge } from '../src/core/badges.js';
import {
	addXp,
	dayKey,
	KEEP_DAYS,
	levelFromXp,
	levelProgress,
	pruneDays,
	weekStart,
	weekTotal,
	XP,
	xpForLevel,
	xpOnDay,
	xpSeries
} from '../src/core/xp.js';

/** 2026-09-04 bir cuma. */
const CUMA = new Date('2026-09-04T12:00:00');
const PAZARTESI = new Date('2026-08-31T12:00:00');
const PAZAR = new Date('2026-09-06T12:00:00');

function gun(offset, from = CUMA) {
	const d = new Date(from);
	d.setDate(d.getDate() + offset);
	return dayKey(d);
}

describe('seviye eğrisi', () => {
	it('birinci seviye sıfır XP', () => {
		expect(xpForLevel(1)).toBe(0);
		expect(levelFromXp(0)).toBe(1);
	});

	it('eşikler artan maliyetli', () => {
		expect(xpForLevel(2)).toBe(100);
		expect(xpForLevel(3)).toBe(300);
		expect(xpForLevel(4)).toBe(600);
	});

	it('eşiğin bir altı bir önceki seviye', () => {
		expect(levelFromXp(99)).toBe(1);
		expect(levelFromXp(100)).toBe(2);
		expect(levelFromXp(299)).toBe(2);
		expect(levelFromXp(300)).toBe(3);
	});

	it('eğri kendisiyle tutarlı', () => {
		// Her seviye icin esik degeri o seviyeyi vermeli; formul ile
		// ters formul birbirinden kaymamali.
		for (let l = 1; l <= 60; l++) {
			expect(levelFromXp(xpForLevel(l)), 'seviye ' + l).toBe(l);
			expect(levelFromXp(xpForLevel(l) - 1), 'seviye ' + l + ' alt').toBe(Math.max(1, l - 1));
		}
	});

	it('negatif ve bozuk XP birinci seviye', () => {
		expect(levelFromXp(-50)).toBe(1);
		expect(levelFromXp(null)).toBe(1);
		expect(levelFromXp('abc')).toBe(1);
	});

	it('levelProgress yüzde verir', () => {
		const p = levelProgress(200);
		expect(p.level).toBe(2);
		expect(p.into).toBe(100);
		expect(p.need).toBe(200);
		expect(p.percent).toBe(50);
		expect(p.remaining).toBe(100);
	});
});

describe('addXp', () => {
	it('toplam ve günlük artar', () => {
		const s = addXp(null, XP.REVIEW_OK, CUMA);
		expect(s.total).toBe(10);
		expect(xpOnDay(s, CUMA)).toBe(10);
	});

	it('aynı gün birikir', () => {
		const s = addXp(addXp(null, 10, CUMA), 30, CUMA);
		expect(s.total).toBe(40);
		expect(xpOnDay(s, CUMA)).toBe(40);
	});

	it('girdiyi değiştirmez', () => {
		const once = { total: 5, byDay: { [dayKey(CUMA)]: 5 } };
		addXp(once, 10, CUMA);
		expect(once.total).toBe(5);
		expect(once.byDay[dayKey(CUMA)]).toBe(5);
	});

	it('sıfır ve negatif XP gün kaydı açmaz', () => {
		const s = addXp(null, 0, CUMA);
		expect(s.total).toBe(0);
		expect(Object.keys(s.byDay).length).toBe(0);
		expect(addXp(null, -20, CUMA).total).toBe(0);
	});

	it('bozuk girdide çökmez', () => {
		expect(addXp('bozuk', 10, CUMA).total).toBe(10);
		expect(addXp({ total: 'abc' }, 10, CUMA).total).toBe(10);
	});
});

describe('pruneDays', () => {
	it('eski günleri atar', () => {
		const eski = gun(-(KEEP_DAYS + 10));
		const yeni = gun(-3);
		const out = pruneDays({ [eski]: 100, [yeni]: 50 }, CUMA);
		expect(out[eski]).toBeUndefined();
		expect(out[yeni]).toBe(50);
	});

	it('sınırdaki günü tutar', () => {
		const s = gun(-(KEEP_DAYS - 1));
		expect(pruneDays({ [s]: 10 }, CUMA)[s]).toBe(10);
	});

	it('addXp içinde de budar', () => {
		const eski = gun(-(KEEP_DAYS + 5));
		const s = addXp({ total: 100, byDay: { [eski]: 100 } }, 10, CUMA);
		expect(s.byDay[eski]).toBeUndefined();
		// Toplam KORUNUYOR: budama gunluk kayitlari kucultuyor,
		// kullanicinin kazandigi XP'yi silmiyor.
		expect(s.total).toBe(110);
	});

	it('boş girdide çökmez', () => {
		expect(pruneDays(null, CUMA)).toEqual({});
	});
});

describe('xpSeries', () => {
	it('istenen gün sayısı kadar nokta verir', () => {
		expect(xpSeries({ byDay: {} }, 7, CUMA).length).toBe(7);
	});

	it('boş günleri sıfırla doldurur', () => {
		const s = xpSeries({ byDay: { [dayKey(CUMA)]: 40 } }, 3, CUMA);
		expect(s.map((x) => x.xp)).toEqual([0, 0, 40]);
	});

	it('son nokta bugün', () => {
		const s = xpSeries({ byDay: {} }, 5, CUMA);
		expect(s[s.length - 1].day).toBe(dayKey(CUMA));
	});
});

describe('hafta', () => {
	it('hafta pazartesi başlar', () => {
		expect(dayKey(weekStart(CUMA))).toBe('2026-08-31');
		expect(dayKey(weekStart(PAZARTESI))).toBe('2026-08-31');
	});

	it('pazar aynı haftaya ait', () => {
		// getDay() pazar icin 0 donduruyor; kaydirma yanlis olsaydi
		// pazar bir sonraki haftaya dusup haftalik hedefi sifirlardi.
		expect(dayKey(weekStart(PAZAR))).toBe('2026-08-31');
	});

	it('haftanın toplamını sayar', () => {
		const byDay = { '2026-08-31': 100, '2026-09-04': 50, '2026-09-06': 25, '2026-09-07': 999 };
		expect(weekTotal({ byDay }, CUMA)).toBe(175);
	});
});

describe('haftalık hedef', () => {
	it('geçmişi olmayana başlangıç hedefi', () => {
		expect(weeklyGoal({ byDay: {} }, null, CUMA).goal).toBe(STARTER_GOAL);
	});

	it('geçen haftanın biraz üstünü ister', () => {
		const byDay = {};
		// Gecen hafta (24-30 Agustos) 1000 XP
		for (const d of ['2026-08-24', '2026-08-25', '2026-08-26', '2026-08-27']) byDay[d] = 250;
		const g = weeklyGoal({ byDay }, null, CUMA);
		expect(g.goal).toBe(1100);
	});

	it('alt ve üst sınırı aşmaz', () => {
		const az = weeklyGoal({ byDay: { '2026-08-24': 10 } }, null, CUMA);
		expect(az.goal).toBe(MIN_GOAL);
		const cok = weeklyGoal({ byDay: { '2026-08-24': 99999 } }, null, CUMA);
		expect(cok.goal).toBe(MAX_GOAL);
	});

	it('hafta ortasında hedef değişmez', () => {
		// Hedef hafta icinde kayarsa ilerleme cubugu geri gidiyor ve
		// kullanici kazandigi XP'yi kaybetmis saniyor.
		const kayitli = { week: '2026-08-31', goal: 777 };
		const g = weeklyGoal({ byDay: { '2026-08-24': 5000 } }, kayitli, CUMA);
		expect(g.goal).toBe(777);
		expect(g.carried).toBe(true);
	});

	it('yeni haftada kayıtlı hedef geçersiz', () => {
		const eski = { week: '2026-08-24', goal: 777 };
		expect(weeklyGoal({ byDay: {} }, eski, CUMA).goal).toBe(STARTER_GOAL);
	});

	it('challengeRecord saklanacak kaydı verir', () => {
		const r = challengeRecord({ byDay: {} }, null, CUMA);
		expect(r).toEqual({ week: '2026-08-31', goal: STARTER_GOAL });
	});
});

describe('challengeStatus', () => {
	it('ilerleme ve kalan günü verir', () => {
		const byDay = { '2026-08-31': 100, '2026-09-01': 50 };
		const s = challengeStatus({ byDay }, { week: '2026-08-31', goal: 300 }, CUMA);
		expect(s.earned).toBe(150);
		expect(s.remaining).toBe(150);
		expect(s.percent).toBe(50);
		expect(s.done).toBe(false);
		expect(s.daysLeft).toBe(3);
		expect(s.perDay).toBe(50);
	});

	it('hedefi aşınca tamamlandı', () => {
		const s = challengeStatus({ byDay: { '2026-09-04': 500 } }, { week: '2026-08-31', goal: 300 }, CUMA);
		expect(s.done).toBe(true);
		expect(s.percent).toBe(100);
		expect(s.remaining).toBe(0);
	});

	it('pazar günü bir gün kalır', () => {
		const s = challengeStatus({ byDay: {} }, { week: '2026-08-31', goal: 300 }, PAZAR);
		expect(s.daysLeft).toBe(1);
	});

	it('boş girdide çökmez', () => {
		expect(challengeStatus(null, null, CUMA).earned).toBe(0);
	});
});

describe('rozetler', () => {
	const bos = {
		reviewed: 0, learned: 0, streak: 0, lessons: 0,
		texts: 0, tasks: 0, dialogues: 0, level: 1, weeksDone: 0
	};

	it('kimlikler benzersiz', () => {
		const ids = BADGES.map((b) => b.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('her rozetin adı ve açıklaması var', () => {
		for (const b of BADGES) {
			expect(b.name, b.id).toBeTruthy();
			expect(b.desc, b.id).toBeTruthy();
			expect(b.icon, b.id).toBeTruthy();
		}
	});

	it('boş istatistikte hiçbiri kazanılmamış', () => {
		expect(earnedCount(bos)).toBe(0);
	});

	it('ilk kelimede ilk rozet gelir', () => {
		const r = evaluateBadges({ ...bos, reviewed: 1 });
		expect(r.find((b) => b.id === 'ilk-adim').earned).toBe(true);
	});

	it('kilitli rozette ilerleme gösterir', () => {
		const r = evaluateBadges({ ...bos, reviewed: 40 });
		const yuz = r.find((b) => b.id === 'yuz-kelime');
		expect(yuz.earned).toBe(false);
		expect(yuz.have).toBe(40);
		expect(yuz.need).toBe(100);
	});

	it('ilerleme hedefi aşmaz', () => {
		// "150 / 100" gostermek bozuk gorunuyor.
		const r = evaluateBadges({ ...bos, reviewed: 5000 });
		const yuz = r.find((b) => b.id === 'yuz-kelime');
		expect(yuz.have).toBe(100);
	});

	it('nextBadge en yakını seçer', () => {
		const n = nextBadge({ ...bos, reviewed: 90, learned: 1 });
		expect(n.id).toBe('yuz-kelime');
	});

	it('hepsi kazanılmışsa nextBadge boş', () => {
		const tam = {
			reviewed: 9999, learned: 9999, streak: 999, lessons: 99,
			texts: 99, tasks: 99, dialogues: 99, level: 99, weeksDone: 99
		};
		expect(earnedCount(tam)).toBe(BADGES.length);
		expect(nextBadge(tam)).toBeNull();
	});

	it('bozuk girdide çökmez', () => {
		expect(() => evaluateBadges(null)).not.toThrow();
		expect(earnedCount(null)).toBe(0);
		expect(evaluateBadges({ reviewed: 'abc' }).length).toBe(BADGES.length);
	});
});
