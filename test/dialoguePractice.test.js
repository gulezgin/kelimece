/**
 * Diyalog alıştırması testleri.
 *
 * Kritik sözleşme: alıştırma İÇERİKTEN türetiliyor, içerikte yazılı
 * değil. Türetim bozulursa 60 diyalogun tamamı aynı anda bozulur.
 */
import { describe, expect, it } from 'vitest';
import {
	buildStep,
	checkBlank,
	checkChoice,
	checkOrder,
	collectDistractors,
	MODES,
	normalize,
	pickBlank,
	practiceSteps
} from '../src/core/dialoguePractice.js';

const noShuffle = () => 0;

function dlg(id, cefr, lines) {
	return { id, cefr, title: id, lines };
}

const ORNEK = dlg('d1', 'A1', [
	{ s: 'A', en: 'Good morning.', tr: 'Günaydın.' },
	{ s: 'B', en: 'A large coffee, please.', tr: 'Büyük bir kahve lütfen.' },
	{ s: 'A', en: 'With milk?', tr: 'Sütlü mü?' },
	{ s: 'B', en: 'Yes, with milk.', tr: 'Evet, sütlü.' },
	{ s: 'A', en: 'Anything else?', tr: 'Başka bir şey?' },
	{ s: 'B', en: 'No, thank you very much.', tr: 'Hayır, çok teşekkürler.' }
]);

describe('practiceSteps', () => {
	it('yalnızca kullanıcının repliklerini verir', () => {
		const steps = practiceSteps(ORNEK);
		expect(steps).toHaveLength(3);
		expect(steps.map((s) => s.index)).toEqual([1, 3, 5]);
	});

	it('tipler dönüşümlü atanır', () => {
		// Kullanici hep ayni alistirmayi cozmemeli.
		expect(practiceSteps(ORNEK).map((s) => s.mode))
			.toEqual([MODES.CHOICE, MODES.ORDER, MODES.BLANK]);
	});

	it('aynı diyalog her açılışta aynı alıştırmaları verir', () => {
		expect(practiceSteps(ORNEK).map((s) => s.mode))
			.toEqual(practiceSteps(ORNEK).map((s) => s.mode));
	});

	it('boş ve bozuk girdide çökmez', () => {
		expect(practiceSteps(null)).toEqual([]);
		expect(practiceSteps({ lines: [null] })).toEqual([]);
	});
});

describe('pickBlank', () => {
	it('en uzun içerik sözcüğünü seçer', () => {
		expect(pickBlank('No, thank you very much.').word).toBe('thank');
	});

	it('işlevsel sözcüğü seçmez', () => {
		// "with" silinirse soru dilbilgisi sorusuna doner.
		expect(pickBlank('Yes, with milk.').word).toBe('milk');
	});

	it('içerik sözcüğü yoksa null döner', () => {
		expect(pickBlank('Yes, I do.')).toBeNull();
	});
});

describe('collectDistractors', () => {
	const hepsi = [
		ORNEK,
		dlg('d2', 'A1', [{ s: 'B', en: 'See you tomorrow.', tr: 'Yarın görüşürüz.' }]),
		dlg('d3', 'A1', [{ s: 'B', en: 'I am from Turkey.', tr: 'Türkiyeliyim.' }]),
		dlg('d4', 'C1', [{ s: 'B', en: 'That would be a considerable oversimplification.', tr: '...' }])
	];

	it('aynı seviyeden alır', () => {
		// Seviye karisirsa uzun cumle soruyu ele verir.
		const d = collectDistractors(ORNEK, hepsi, 2, noShuffle);
		expect(d).toHaveLength(2);
		expect(d.some((t) => /oversimplification/.test(t))).toBe(false);
	});

	it('diyalogun kendi repliklerini yanıltıcı yapmaz', () => {
		const d = collectDistractors(ORNEK, hepsi, 2, noShuffle);
		expect(d.some((t) => /large coffee/.test(t))).toBe(false);
	});

	it('aynı seviyede malzeme yetmezse seviye kısıtını gevşetir', () => {
		// Eksik sikli bir soru, hic soru olmamasindan iyidir.
		const az = [ORNEK, hepsi[3]];
		expect(collectDistractors(ORNEK, az, 2, noShuffle).length).toBeGreaterThan(0);
	});
});

describe('buildStep', () => {
	const hepsi = [ORNEK, dlg('d2', 'A1', [{ s: 'B', en: 'See you tomorrow.', tr: '...' }])];

	it('seçme: doğru cevap şıklar arasında ve tek', () => {
		const step = practiceSteps(ORNEK)[0];
		const ex = buildStep(ORNEK, step, { allDialogues: hepsi, random: noShuffle });
		expect(ex.mode).toBe(MODES.CHOICE);
		expect(ex.options[ex.correctIndex]).toBe('A large coffee, please.');
		expect(ex.options.filter((o) => o === ex.answer)).toHaveLength(1);
	});

	it('dizme: kelimeler eksiksiz', () => {
		const step = practiceSteps(ORNEK)[1];
		const ex = buildStep(ORNEK, step, { allDialogues: hepsi, random: noShuffle });
		expect(ex.mode).toBe(MODES.ORDER);
		expect([...ex.tokens].sort()).toEqual([...ex.words].sort());
	});

	it('boşluk: cümle iki parçaya bölünür', () => {
		const step = practiceSteps(ORNEK)[2];
		const ex = buildStep(ORNEK, step, { allDialogues: hepsi, random: noShuffle });
		expect(ex.mode).toBe(MODES.BLANK);
		expect(ex.blank).toBe('thank');
		expect(ex.sentence.before + ' ' + ex.sentence.after).not.toContain('thank');
	});

	it('boşluk bırakılacak sözcük yoksa seçmeye düşer', () => {
		const d = dlg('x', 'A1', [{ s: 'B', en: 'Yes, I do.', tr: 'Evet.' }]);
		const ex = buildStep(d, { index: 0, turn: 2, mode: MODES.BLANK, line: d.lines[0] },
			{ allDialogues: hepsi, random: noShuffle });
		expect(ex.mode).toBe(MODES.CHOICE);
	});
});

describe('cevap denetimi', () => {
	it('şık: yalnızca doğru indeks kabul', () => {
		const ex = { correctIndex: 2 };
		expect(checkChoice(ex, 2)).toBe(true);
		expect(checkChoice(ex, 0)).toBe(false);
	});

	it('dizme: sıra önemli', () => {
		const ex = { answer: 'Yes, with milk.' };
		expect(checkOrder(ex, ['Yes,', 'with', 'milk.'])).toBe(true);
		expect(checkOrder(ex, ['with', 'Yes,', 'milk.'])).toBe(false);
	});

	it('boşluk: büyük harf ve noktalama farkı yanlış sayılmaz', () => {
		// Olculen kelimeyi bilmek, yazim titizligi degil.
		const ex = { blank: 'thank' };
		expect(checkBlank(ex, 'Thank')).toBe(true);
		expect(checkBlank(ex, ' thank ')).toBe(true);
		expect(checkBlank(ex, 'thanks')).toBe(false);
	});

	it('normalize boş girdide çökmez', () => {
		expect(normalize(null)).toBe('');
	});
});

describe('boşlukta noktalama', () => {
	it('kelime silinir, noktalama cümlede kalır', () => {
		// "No, thanks. How much is it?" -> "No, ___. How much is it?"
		// Butun belirteci silmek noktayi da goturuyordu.
		const d = dlg('p', 'A1', [
			{ s: 'B', en: 'No, thanks. How much is it?', tr: 'Hayır, teşekkürler.' }
		]);
		const ex = buildStep(d, { index: 0, turn: 2, mode: MODES.BLANK, line: d.lines[0] },
			{ allDialogues: [d], random: noShuffle });
		expect(ex.blank).toBe('thanks');
		expect(ex.sentence.before).toBe('No, ');
		expect(ex.sentence.after.startsWith('.')).toBe(true);
	});
});
