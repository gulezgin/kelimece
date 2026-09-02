/**
 * Diyalog testleri.
 *
 * Bu katman hem para (kilit) hem de icerik dogrulugu tasiyor:
 * yanlis kilit ya odeyen kullaniciyi icerikten mahrum birakir ya da
 * ucretli icerigi bedava dagitir; bozuk bir diyalog dosyasi ise
 * ekrani cokertir.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { grantPremium, NO_PREMIUM, PRODUCTS } from '../src/core/entitlements.js';
import {
	dialogueSummaries,
	findDialogue,
	isDialogueUnlocked,
	wordsInLine
} from '../src/core/dialogues.js';

const NOW = new Date('2026-09-01T12:00:00Z');
const PACK = JSON.parse(readFileSync('public/content/dialogues.json', 'utf8'));

function dlg(cefr, id = 'x') {
	return { id, title: 'T', cefr, summary: 's', lines: [{ s: 'A', en: 'Hi.', tr: 'Merhaba.' }] };
}

describe('içerik dosyası', () => {
	it('diyaloglar yüklenebiliyor ve boş değil', () => {
		expect(Array.isArray(PACK.dialogues)).toBe(true);
		expect(PACK.dialogues.length).toBeGreaterThan(0);
	});

	it('her diyalogda gerekli alanlar var', () => {
		for (const d of PACK.dialogues) {
			expect(d.id, d.title).toBeTruthy();
			expect(d.title, d.id).toBeTruthy();
			expect(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']).toContain(d.cefr);
			expect(d.lines.length, d.id).toBeGreaterThan(2);
		}
	});

	it('her satırda konuşmacı, İngilizce ve Türkçe var', () => {
		// Ceviri eksik bir satir ekranda bos kutu birakir.
		for (const d of PACK.dialogues) {
			for (const line of d.lines) {
				expect(['A', 'B'], d.id).toContain(line.s);
				expect(line.en.trim(), d.id).not.toBe('');
				expect(line.tr.trim(), d.id + ' / ' + line.en).not.toBe('');
			}
		}
	});

	it('kimlikler benzersiz', () => {
		const ids = PACK.dialogues.map((d) => d.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('ücretsiz seviyede en az bir diyalog var', () => {
		// Yoksa odemeyen kullanici bu ekrani hic goremez.
		const free = PACK.dialogues.filter((d) => isDialogueUnlocked(d, NO_PREMIUM, NOW));
		expect(free.length).toBeGreaterThan(0);
	});
});

describe('isDialogueUnlocked', () => {
	it('A1 ve A2 abonelik olmadan açık', () => {
		expect(isDialogueUnlocked(dlg('A1'), NO_PREMIUM, NOW)).toBe(true);
		expect(isDialogueUnlocked(dlg('A2'), NO_PREMIUM, NOW)).toBe(true);
	});

	it('B1 ve üstü abonelik olmadan kilitli', () => {
		expect(isDialogueUnlocked(dlg('B1'), NO_PREMIUM, NOW)).toBe(false);
		expect(isDialogueUnlocked(dlg('C1'), NO_PREMIUM, NOW)).toBe(false);
	});

	it('abonelikle hepsi açık', () => {
		const p = grantPremium(PRODUCTS.YEARLY, { now: NOW });
		expect(isDialogueUnlocked(dlg('B2'), p, NOW)).toBe(true);
	});

	it('geçersiz girdide false', () => {
		expect(isDialogueUnlocked(null, NO_PREMIUM, NOW)).toBe(false);
	});
});

describe('dialogueSummaries', () => {
	it('kilitli olanı listeden çıkarmaz, işaretler', () => {
		// Kullanici neyi kacirdigini gormeden abone olmaz.
		const out = dialogueSummaries([dlg('A1', 'a'), dlg('B1', 'b')], NO_PREMIUM, NOW);
		expect(out).toHaveLength(2);
		expect(out.find((d) => d.id === 'b').locked).toBe(true);
		expect(out.find((d) => d.id === 'a').locked).toBe(false);
	});

	it('satır sayısını verir', () => {
		expect(dialogueSummaries([dlg('A1')], NO_PREMIUM, NOW)[0].lineCount).toBe(1);
	});

	it('bozuk girdide çökmez', () => {
		expect(dialogueSummaries(null, NO_PREMIUM, NOW)).toEqual([]);
		expect(dialogueSummaries([null], NO_PREMIUM, NOW)).toEqual([]);
	});
});

describe('findDialogue', () => {
	it('kimliğe göre bulur, yoksa null', () => {
		const list = [dlg('A1', 'a'), dlg('A2', 'b')];
		expect(findDialogue(list, 'b').cefr).toBe('A2');
		expect(findDialogue(list, 'yok')).toBeNull();
		expect(findDialogue(null, 'a')).toBeNull();
	});
});

describe('wordsInLine', () => {
	const index = new Map([['coffee', { en: 'coffee', tr: 'kahve' }], ['please', { en: 'please', tr: 'lütfen' }]]);

	it('havuzda karşılığı olanları bulur', () => {
		const out = wordsInLine('A large coffee, please.', index);
		expect(out.map((w) => w.en).sort()).toEqual(['coffee', 'please']);
	});

	it('aynı kelimeyi iki kez döndürmez', () => {
		expect(wordsInLine('Coffee, coffee, coffee!', index)).toHaveLength(1);
	});

	it('boş girdide boş döner', () => {
		expect(wordsInLine('', index)).toEqual([]);
		expect(wordsInLine(null, index)).toEqual([]);
	});
});
