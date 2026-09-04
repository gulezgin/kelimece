/**
 * Günlük plan testleri.
 *
 * Planın işi kullanıcıyı yönlendirmek. Yanlış plan iki türlü zarar
 * verir: az iş verirse ilerleme durur, çok iş verirse kullanıcı
 * tamamlayamadığı için bırakır.
 */
import { describe, expect, it } from 'vitest';
import { buildDailyPlan, DAILY_MINUTES, GOALS, goalInfo } from '../src/core/plan.js';

const DIYALOGLAR = [
	{ id: 'd1', title: 'Toplantı', topic: 'iş' },
	{ id: 'd2', title: 'Otelde', topic: 'seyahat' },
	{ id: 'd3', title: 'Kafede', topic: 'yiyecek' }
];
const KONULAR = [
	{ topic: 'iş', icon: '💼' },
	{ topic: 'seyahat', icon: '✈️' },
	{ topic: 'yiyecek', icon: '🍽️' }
];

describe('goalInfo', () => {
	it('bilinen hedefi verir', () => {
		expect(goalInfo('travel').label).toBe('Seyahat');
	});

	it('bilinmeyen hedefte genele düşer', () => {
		expect(goalInfo('yok')).toBe(GOALS.general);
		expect(goalInfo(null)).toBe(GOALS.general);
	});
});

describe('buildDailyPlan — süre', () => {
	it('beş dakikada tek görev verir', () => {
		// Bes dakikasi olana dort gorev vermek, plani motive edici
		// olmaktan cikarip suclululuk uretecine cevirir.
		const p = buildDailyPlan({ dailyMinutes: 5, dialogues: DIYALOGLAR, topics: KONULAR });
		expect(p.total).toBe(1);
		expect(p.tasks[0].kind).toBe('words');
	});

	it('süre arttıkça görev artar', () => {
		const say = (m) => buildDailyPlan({
			dailyMinutes: m, dialogues: DIYALOGLAR, topics: KONULAR
		}).total;
		expect(say(5)).toBeLessThan(say(10));
		expect(say(10)).toBeLessThan(say(15));
		expect(say(15)).toBeLessThan(say(30));
	});

	it('her sürede kelime görevi var', () => {
		// Kelime, uygulamanin cekirdegi; hicbir planda eksik olmamali.
		for (const m of DAILY_MINUTES) {
			const p = buildDailyPlan({ dailyMinutes: m, dialogues: DIYALOGLAR, topics: KONULAR });
			expect(p.tasks.some((t) => t.kind === 'words'), String(m)).toBe(true);
		}
	});
});

describe('buildDailyPlan — hedef', () => {
	it('hedefe uyan içeriği öne alır', () => {
		const p = buildDailyPlan({
			goal: 'travel', dailyMinutes: 15, dialogues: DIYALOGLAR, topics: KONULAR
		});
		expect(p.tasks.find((t) => t.kind === 'dialogue').title).toBe('Otelde');
		expect(p.tasks.find((t) => t.kind === 'topic').title).toBe('seyahat');
	});

	it('iş hedefinde iş içeriği öne geçer', () => {
		const p = buildDailyPlan({
			goal: 'work', dailyMinutes: 15, dialogues: DIYALOGLAR, topics: KONULAR
		});
		expect(p.tasks.find((t) => t.kind === 'dialogue').title).toBe('Toplantı');
	});

	it('hedefe uymayan içeriği ELEMEZ', () => {
		// Elemek, hedefi seyahat olan birinin havuzun cogunu hic
		// gormemesi demek olurdu.
		const p = buildDailyPlan({
			goal: 'travel', dailyMinutes: 60, dialogues: DIYALOGLAR, topics: KONULAR
		});
		const baslıklar = p.tasks.filter((t) => t.kind === 'dialogue').map((t) => t.title);
		expect(baslıklar.length).toBe(2);
		expect(baslıklar).toContain('Otelde');
	});

	it('genel hedefte sıra bozulmaz', () => {
		const p = buildDailyPlan({
			goal: 'general', dailyMinutes: 15, dialogues: DIYALOGLAR, topics: KONULAR
		});
		expect(p.tasks.find((t) => t.kind === 'dialogue').title).toBe('Toplantı');
	});
});

describe('buildDailyPlan — durum', () => {
	it('tamamlananları işaretler ve sayar', () => {
		const p = buildDailyPlan({
			dailyMinutes: 15, dialogues: DIYALOGLAR, topics: KONULAR,
			doneIds: ['words-0']
		});
		expect(p.done).toBe(1);
		expect(p.tasks.find((t) => t.id === 'words-0').done).toBe(true);
	});

	it('içerik yoksa yalnızca kelime görevi kalır, çökmez', () => {
		const p = buildDailyPlan({ dailyMinutes: 60, dialogues: [], topics: [] });
		expect(p.tasks.every((t) => t.kind === 'words')).toBe(true);
	});

	it('hiç girdi verilmeden çalışır', () => {
		expect(buildDailyPlan().total).toBeGreaterThan(0);
	});
});
