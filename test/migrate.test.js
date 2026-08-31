/**
 * Göç ve ilerleme onarımı testleri.
 *
 * Bu iki iş kullanıcının gerçek öğrenme verisine dokunuyor; bir hata
 * aylarca süren çalışmayı kaybettirir. Buradaki testler iki sözleşmeyi
 * kilitler:
 *   1. Göç hiçbir ilerlemeyi kaybetmez ve hiçbir seviyeyi "düzeltmez".
 *   2. Onarım yalnızca şüpheli kayıtlara dokunur, seçilen kipe uyar.
 */
import { describe, expect, it } from 'vitest';
import { analyzeProgress, planMigration, repairProgress, replayLevel } from '../src/data/migrate.js';
import { MAX_LEVEL } from '../src/core/srs.js';
import { isDue, todayISO } from '../src/core/time.js';
import { normalizeDefinition } from '../src/core/word.js';

const NOW = '2026-08-31T00:00:00.000Z';

/** Eski (1.0) biçiminde kayıt. */
function legacy(en, overrides = {}) {
	return {
		id: 'old-' + en,
		en,
		tr: en + ' anlamı',
		example: '',
		tags: [],
		level: 0,
		nextReviewAt: '2026-01-01T00:00:00.000Z',
		createdAt: '2025-10-01T00:00:00.000Z',
		history: [],
		...overrides
	};
}

/** İçerik paketindeki tanım. */
function packDef(en) {
	return normalizeDefinition({ en, tr: en + ' paket anlamı' }, { source: 'core' });
}

describe('planMigration', () => {
	const pack = [packDef('abandon'), packDef('ability'), packDef('look down on')];

	it('paketteki kelimeleri kararlı kimlikle eşleştirir', () => {
		const { definitions, report } = planMigration([legacy('abandon')], pack);
		expect(definitions[0].id).toBe('core:abandon');
		expect(definitions[0].source).toBe('core');
		expect(report.matched).toBe(1);
		expect(report.userOwned).toBe(0);
	});

	it('büyük/küçük harf ve fazla boşluğa rağmen eşleştirir', () => {
		const { report } = planMigration([legacy('  Look  Down   On ')], pack);
		expect(report.matched).toBe(1);
	});

	it('pakette olmayan kelimeyi kullanıcının kendi kelimesi olarak korur', () => {
		const { definitions, report } = planMigration([legacy('serendipity')], pack);
		expect(definitions[0].source).toBe('user');
		expect(definitions[0].id.startsWith('user:')).toBe(true);
		expect(report.userOwned).toBe(1);
	});

	it('ilerlemeyi olduğu gibi taşır - hiçbir seviyeyi düzeltmez', () => {
		// Göç bir onarım aracı DEĞİL. Yanlış hesaplanmış seviye bile
		// olduğu gibi taşınır; onarım ayrı ve kullanıcının onayına bağlı.
		const input = legacy('abandon', {
			level: MAX_LEVEL,
			history: [{ date: '2025-11-01T00:00:00.000Z', known: true }]
		});
		const { progress } = planMigration([input], pack);
		expect(progress[0].level).toBe(MAX_LEVEL);
		expect(progress[0].history).toHaveLength(1);
		expect(progress[0].addedAt).toBe('2025-10-01T00:00:00.000Z');
	});

	it('tanım ve ilerlemeyi aynı kimliğe bağlar', () => {
		const { definitions, progress } = planMigration([legacy('abandon'), legacy('serendipity')], pack);
		expect(progress.map((p) => p.wordId)).toEqual(definitions.map((d) => d.id));
	});

	it('kullanıcının örnek cümlesini ve etiketlerini korur', () => {
		const input = legacy('abandon', { example: 'Benim cümlem.', tags: ['zor'] });
		const { definitions } = planMigration([input], pack);
		expect(definitions[0].example).toBe('Benim cümlem.');
		expect(definitions[0].tags).toContain('zor');
	});

	it('mükerrer kayıtları ayrı kimliklerle korur, üzerine yazmaz', () => {
		const { definitions, report } = planMigration([legacy('abandon'), legacy('abandon')], pack);
		expect(definitions).toHaveLength(2);
		expect(definitions[0].id).not.toBe(definitions[1].id);
		expect(report.collisions).toBe(1);
	});

	it('çakışan ikinci kayıt kullanıcı kelimesi olarak etiketlenir', () => {
		// Kimlik ile kaynak tutarlı kalmalı: "user:" kimlikli bir kaydın
		// source alanı "core" görünmemeli.
		const { definitions } = planMigration([legacy('abandon'), legacy('abandon')], pack);
		const second = definitions[1];
		expect(second.id.startsWith('user:')).toBe(true);
		expect(second.source).toBe('user');
	});

	it('takma ad üzerinden de paket kelimesine bağlanır', () => {
		// Paket üreticisi "prosperity, welfare, wealth" -> "prosperity"
		// dönüşümü yaptı; kullanıcının ilerlemesi eski yazımda duruyor.
		const withAlias = normalizeDefinition(
			{ en: 'prosperity', tr: 'refah', aliases: ['prosperity, welfare, wealth'] },
			{ source: 'core' }
		);
		const { definitions, report } = planMigration(
			[legacy('prosperity, welfare, wealth')],
			[withAlias]
		);
		expect(definitions[0].id).toBe('core:prosperity');
		expect(report.matched).toBe(1);
		expect(report.userOwned).toBe(0);
	});

	it('kurtarılamayan kayıtları atar ve raporlar', () => {
		const { report } = planMigration([legacy('abandon'), { en: '', tr: 'x' }, null], pack);
		expect(report.skipped).toBe(2);
		expect(report.total).toBe(3);
	});

	it('paket verilmezse her şeyi kullanıcı kelimesi sayar', () => {
		const { report } = planMigration([legacy('abandon')], []);
		expect(report.userOwned).toBe(1);
		expect(report.matched).toBe(0);
	});
});

describe('replayLevel', () => {
	it('boş geçmişte 0 döner', () => {
		expect(replayLevel([])).toBe(0);
		expect(replayLevel(null)).toBe(0);
	});

	it('her doğru cevap seviyeyi bir artırır', () => {
		expect(replayLevel([{ known: true }, { known: true }])).toBe(2);
	});

	it('yanlış cevap seviyeyi sıfırlar', () => {
		expect(replayLevel([{ known: true }, { known: true }, { known: false }])).toBe(0);
	});

	it('üst üste 5 doğru öğrenilmiş seviyesine çıkarır', () => {
		expect(replayLevel(Array(5).fill({ known: true }))).toBe(MAX_LEVEL);
	});

	it('regresyon: araya yanlış girerse öğrenilmiş saymaz', () => {
		const history = [
			{ known: true }, { known: true }, { known: true }, { known: true },
			{ known: false },
			{ known: true }
		];
		expect(replayLevel(history)).toBe(1);
	});
});

describe('analyzeProgress', () => {
	const records = [
		{ id: 'a', level: MAX_LEVEL, history: Array(5).fill({ known: true }) },   // hak etmiş
		{ id: 'b', level: MAX_LEVEL, history: [{ known: true }] },                 // zayıf
		{ id: 'c', level: MAX_LEVEL, history: [] },                                // geçmişsiz
		{ id: 'd', level: 2, history: [{ known: true }] }                          // öğrenilmiş değil
	];

	it('öğrenilmiş kelimeleri hak edenler / etmeyenler diye ayırır', () => {
		const a = analyzeProgress(records);
		expect(a.learnedCount).toBe(3);
		expect(a.earned).toBe(1);
		expect(a.weak).toBe(1);
		expect(a.noHistory).toBe(1);
		expect(a.suspect).toBe(2);
	});

	it('öğrenilmiş olmayan kayıtlara bakmaz', () => {
		const a = analyzeProgress(records);
		expect(a.groups.weak.some((r) => r.id === 'd')).toBe(false);
	});

	it('hiçbir şeyi değiştirmez', () => {
		const snapshot = JSON.parse(JSON.stringify(records));
		analyzeProgress(records);
		expect(records).toEqual(snapshot);
	});
});

describe('repairProgress', () => {
	const base = { addedAt: '2025-10-01T00:00:00.000Z', learnedManually: false };
	const records = [
		{ ...base, id: 'earned', level: MAX_LEVEL, nextReviewAt: NOW, history: Array(5).fill({ known: true }) },
		{ ...base, id: 'weak', level: MAX_LEVEL, nextReviewAt: NOW, history: [{ known: true }] },
		{ ...base, id: 'nohist', level: MAX_LEVEL, nextReviewAt: NOW, history: [] },
		{ ...base, id: 'normal', level: 2, nextReviewAt: NOW, history: [{ known: true }] }
	];

	it('yalnızca şüpheli kayıtlara dokunur', () => {
		for (const mode of ['verify', 'replay', 'reset']) {
			const { updates } = repairProgress(records, mode);
			expect(updates.map((u) => u.wordId).sort()).toEqual(['nohist', 'weak']);
		}
	});

	it('verify: geçmişi korur ve kelimeyi tekrar kuyruğuna sokar', () => {
		const { updates } = repairProgress(records, 'verify');
		const weak = updates.find((u) => u.wordId === 'weak');
		expect(weak.history).toHaveLength(1);           // geçmiş korundu
		expect(weak.level).toBe(MAX_LEVEL - 1);          // artık kuyruğa girebilir
		expect(isDue(weak.nextReviewAt)).toBe(true);
	});

	it('replay: gerçek seviyeyi geçmişten hesaplar', () => {
		const { updates } = repairProgress(records, 'replay');
		expect(updates.find((u) => u.wordId === 'weak').level).toBe(1);
		expect(updates.find((u) => u.wordId === 'nohist').level).toBe(0);
	});

	it('reset: sıfırdan başlatır', () => {
		const { updates } = repairProgress(records, 'reset');
		for (const u of updates) {
			expect(u.level).toBe(0);
			expect(isDue(u.nextReviewAt)).toBe(true);
		}
	});

	it('elle işaretlenmiş damgasını kaldırır', () => {
		const manual = [{ ...base, id: 'm', level: MAX_LEVEL, nextReviewAt: NOW, history: [], learnedManually: true }];
		const { updates } = repairProgress(manual, 'verify');
		expect(updates[0].learnedManually).toBe(false);
	});

	it('girdiyi değiştirmez', () => {
		const snapshot = JSON.parse(JSON.stringify(records));
		repairProgress(records, 'reset');
		expect(records).toEqual(snapshot);
	});

	it('şüpheli kayıt yoksa hiçbir şey yapmaz', () => {
		const clean = [{ ...base, id: 'x', level: 1, nextReviewAt: NOW, history: [] }];
		expect(repairProgress(clean, 'verify').changed).toBe(0);
	});
});

describe('onarım sonrası tekrar kuyruğu', () => {
	it('verify kipinden sonra kelimeler gerçekten sorulabilir hâle gelir', async () => {
		// En kritik davranış: onarımın amacı bu kelimeleri tekrar
		// görünür kılmak. Seviye MAX_LEVEL kalırsa kuyruğa hiç girmezler.
		const { buildReviewQueue } = await import('../src/core/srs.js');

		const records = [
			{ id: 'weak', level: MAX_LEVEL, nextReviewAt: todayISO(), addedAt: NOW, history: [{ known: true }] }
		];
		expect(buildReviewQueue(records, { free: false, isDue })).toHaveLength(0);

		const { updates } = repairProgress(records, 'verify');
		const repaired = records.map((r) => ({ ...r, ...updates[0], id: r.id }));
		expect(buildReviewQueue(repaired, { free: false, isDue })).toHaveLength(1);
	});
});
