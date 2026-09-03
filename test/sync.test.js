/**
 * Eşitleme birleştirme testleri.
 *
 * Bu katman en riskli yer: yanlış birleştirme, kullanıcının aylarca
 * biriktirdiği tekrar takvimini SESSİZCE bozar. Kullanıcı bunu ancak
 * yanlış kelimeler karşısına çıkmaya başlayınca, geri dönüşü olmayan
 * bir noktada fark eder.
 */
import { describe, expect, it } from 'vitest';
import {
	isWorthSyncing,
	mergeProfile,
	mergeProgress,
	mergeProgressLists
} from '../src/core/sync.js';

function kayit(wordId, gecmisSayisi, sonTarih, extra = {}) {
	const history = [];
	for (let i = 0; i < gecmisSayisi; i++) {
		history.push({ date: sonTarih, known: true, rating: 'good' });
	}
	return { wordId, level: 0, history, learnedManually: false, ...extra };
}

describe('mergeProgress', () => {
	it('daha çok çalışılmış kayıt kazanır', () => {
		// Calisma geri alinamaz: 10 kez calisilmis kayit, 3 kez
		// calisilmis olandan gunceldir - hangi cihazda yazildigindan
		// bagimsiz olarak.
		const yerel = kayit('w', 10, '2026-01-01');
		const uzak = kayit('w', 3, '2026-09-01');
		expect(mergeProgress(yerel, uzak).winner).toBe('local');
	});

	it('son yazan DEĞİL, daha çok çalışan kazanır', () => {
		// Bu testin varlik sebebi: "last write wins" yaygin ve yanlis.
		const yerel = kayit('w', 2, '2026-01-01');
		const uzak = kayit('w', 9, '2025-01-01');
		expect(mergeProgress(yerel, uzak).winner).toBe('remote');
	});

	it('geçmiş eşitse son çalışma anı yeni olan kazanır', () => {
		const yerel = kayit('w', 4, '2026-01-01');
		const uzak = kayit('w', 4, '2026-06-01');
		expect(mergeProgress(yerel, uzak).winner).toBe('remote');
	});

	it('tek taraf varsa o kazanır', () => {
		const k = kayit('w', 1, '2026-01-01');
		expect(mergeProgress(k, null)).toEqual({ record: k, winner: 'local' });
		expect(mergeProgress(null, k)).toEqual({ record: k, winner: 'remote' });
		expect(mergeProgress(null, null).record).toBeNull();
	});

	it('hiç çalışılmamışsa elle öğrenildi işareti kazanır', () => {
		const yerel = kayit('w', 0, null, { learnedManually: true });
		const uzak = kayit('w', 0, null);
		expect(mergeProgress(yerel, uzak).winner).toBe('local');
		expect(mergeProgress(uzak, yerel).winner).toBe('remote');
	});

	it('ayırt edilemiyorsa yereli tutar ve yazma yapmaz', () => {
		const a = kayit('w', 3, '2026-01-01');
		const b = kayit('w', 3, '2026-01-01');
		expect(mergeProgress(a, b).winner).toBe('equal');
	});
});

describe('isWorthSyncing', () => {
	it('dokunulmamış kaydı göndermez', () => {
		// Paket 5276 kayit kuruyor; hepsini gondermek ~1 MB demek ve
		// karsi tarafta zaten aynisi var.
		expect(isWorthSyncing(kayit('w', 0, null))).toBe(false);
	});

	it('çalışılmış, seviyesi olan ya da elle işaretlenmiş kaydı gönderir', () => {
		expect(isWorthSyncing(kayit('w', 1, '2026-01-01'))).toBe(true);
		expect(isWorthSyncing(kayit('w', 0, null, { level: 2 }))).toBe(true);
		expect(isWorthSyncing(kayit('w', 0, null, { learnedManually: true }))).toBe(true);
	});

	it('bozuk girdide false', () => {
		expect(isWorthSyncing(null)).toBe(false);
	});
});

describe('mergeProgressLists', () => {
	it('iki tarafı birleştirir ve ne yapılacağını söyler', () => {
		const yerel = [kayit('a', 5, '2026-01-01'), kayit('b', 1, '2026-01-01')];
		const uzak = [kayit('a', 2, '2026-01-01'), kayit('c', 3, '2026-01-01')];
		const r = mergeProgressLists(yerel, uzak);

		expect(r.merged).toHaveLength(3);
		expect(r.toUpload.map((x) => x.wordId).sort()).toEqual(['a', 'b']);
		expect(r.toApply.map((x) => x.wordId)).toEqual(['c']);
	});

	it('dokunulmamış kayıtları göndermeye çalışmaz', () => {
		const yerel = [kayit('a', 0, null), kayit('b', 4, '2026-01-01')];
		const r = mergeProgressLists(yerel, []);
		expect(r.merged).toHaveLength(2);
		expect(r.toUpload.map((x) => x.wordId)).toEqual(['b']);
	});

	it('aynı olanlar için iş çıkarmaz', () => {
		const a = kayit('a', 3, '2026-01-01');
		const r = mergeProgressLists([a], [{ ...a }]);
		expect(r.toUpload).toHaveLength(0);
		expect(r.toApply).toHaveLength(0);
		expect(r.stats.degismeyen).toBe(1);
	});

	it('boş ve bozuk girdide çökmez', () => {
		expect(mergeProgressLists(null, null).merged).toEqual([]);
		expect(mergeProgressLists([null, { level: 1 }], []).merged).toEqual([]);
	});

	it('hiçbir kayıt kaybolmaz', () => {
		// En onemli garanti: birlestirme veri silmemeli.
		const yerel = Array.from({ length: 40 }, (_, i) => kayit('y' + i, i % 5, '2026-01-01'));
		const uzak = Array.from({ length: 30 }, (_, i) => kayit('u' + i, i % 3, '2026-02-01'));
		const r = mergeProgressLists(yerel, uzak);
		expect(r.merged).toHaveLength(70);
	});
});

describe('mergeProfile', () => {
	it('seri sayaçları geri gitmez', () => {
		const r = mergeProfile({ streak: 3, longestStreak: 12 }, { streak: 9, longestStreak: 7 });
		expect(r.streak).toBe(9);
		expect(r.longestStreak).toBe(12);
	});

	it('en son ölçülen seviye kazanır', () => {
		const r = mergeProfile(
			{ level: 'A2', placedAt: '2026-01-01' },
			{ level: 'B1', placedAt: '2026-06-01' }
		);
		expect(r.level).toBe('B1');
	});

	it('günlük sayaç yalnızca aynı güne aitse karşılaştırılır', () => {
		// Farkli gunun sayacini karsilastirmak anlamsiz.
		const r = mergeProfile(
			{ lastStudyDate: '2026-09-01', studiedToday: 4 },
			{ lastStudyDate: '2026-09-03', studiedToday: 1 }
		);
		expect(r.lastStudyDate).toBe('2026-09-03');
		expect(r.studiedToday).toBe(1);
	});

	it('aynı günse en yükseği alır', () => {
		const r = mergeProfile(
			{ lastStudyDate: '2026-09-03', studiedToday: 4 },
			{ lastStudyDate: '2026-09-03', studiedToday: 9 }
		);
		expect(r.studiedToday).toBe(9);
	});

	it('uzak profil yoksa yereli aynen döner', () => {
		expect(mergeProfile({ streak: 2 }, null)).toEqual({ streak: 2 });
	});
});
