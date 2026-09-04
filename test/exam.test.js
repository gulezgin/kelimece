/**
 * Sınav modu.
 *
 * İçerik doğrulamasının ağırlığı yazma görevlerinde: bunlar
 * `core/writing.js` motoruna giriyor ve orada geçerli olan kural
 * burada da geçerli — örnek cevap kendi kontrolünden geçmezse görev
 * imkânsız demektir.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
	examContent,
	examSummaries,
	findExam,
	findSpeakingTask,
	findVocabSet,
	formatClock,
	isExamTaskUnlocked,
	speakingPhases
} from '../src/core/exam.js';
import { checkWriting, findMistakes } from '../src/core/writing.js';
import { grantPremium, NO_PREMIUM, PRODUCTS } from '../src/core/entitlements.js';

const NOW = new Date('2026-09-04T12:00:00Z');
const PACK = JSON.parse(readFileSync('public/content/exam.json', 'utf8'));

describe('içerik dosyası', () => {
	it('iki sınav da var', () => {
		expect(PACK.exams.map((e) => e.id).sort()).toEqual(['ielts', 'toefl']);
	});

	it('her sınavın biçimi ve ipuçları var', () => {
		for (const e of PACK.exams) {
			expect(e.name, e.id).toBeTruthy();
			expect(e.scale, e.id).toBeTruthy();
			expect(e.format.length, e.id).toBeGreaterThan(2);
			expect(e.tips.length, e.id).toBeGreaterThan(2);
			for (const f of e.format) {
				expect(f.part, e.id).toBeTruthy();
				expect(f.time, e.id).toBeTruthy();
				expect(f.detail, e.id).toBeTruthy();
			}
		}
	});

	it('kimlikler benzersiz', () => {
		const ids = [
			...PACK.exams.map((x) => x.id),
			...PACK.writing.map((x) => x.id),
			...PACK.speaking.map((x) => x.id),
			...PACK.vocabulary.map((x) => x.id)
		];
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('her içerik geçerli bir sınava bağlı', () => {
		const gecerli = new Set([...PACK.exams.map((e) => e.id), 'both']);
		for (const grup of [PACK.writing, PACK.speaking, PACK.vocabulary]) {
			for (const x of grup) expect(gecerli.has(x.exam), x.id).toBe(true);
		}
	});

	it('her sınavın en az bir yazma ve bir konuşma görevi var', () => {
		for (const e of PACK.exams) {
			const c = examContent(PACK, e.id);
			expect(c.writing.length, e.id).toBeGreaterThan(0);
			expect(c.speaking.length, e.id).toBeGreaterThan(0);
			expect(c.vocabulary.length, e.id).toBeGreaterThan(0);
		}
	});
});

describe('yazma görevleri', () => {
	it('yazma motorunun beklediği alanlar var', () => {
		for (const w of PACK.writing) {
			expect(w.prompt, w.id).toBeTruthy();
			expect(w.model, w.id).toBeTruthy();
			expect(w.minWords, w.id).toBeGreaterThan(0);
			expect(w.maxWords, w.id).toBeGreaterThan(w.minWords);
			expect(w.require.length, w.id).toBeGreaterThan(0);
		}
	});

	it('her örnek cevap kendi kontrolünü geçiyor', () => {
		for (const w of PACK.writing) {
			const r = checkWriting(w, w.model);
			expect(r.required.filter((c) => !c.ok).map((c) => c.label), w.id).toEqual([]);
			expect(r.lengthOk, `${w.id}: ${r.words} kelime (${w.minWords}-${w.maxWords})`).toBe(true);
		}
	});

	it('örnek cevaplarda kalıp hatası yok', () => {
		for (const w of PACK.writing) {
			expect(findMistakes(w.model).map((h) => h.id), w.id).toEqual([]);
		}
	});

	it('IELTS kelime alt sınırları gerçek sınavla uyumlu', () => {
		// Gercek sinavda Task 1 icin 150, Task 2 icin 250 kelime alt
		// sinir; yanlis bir sayi ogrenciyi eksik yazmaya alistirir.
		expect(PACK.writing.find((w) => w.id === 'x-ielts-t1').minWords).toBe(150);
		expect(PACK.writing.find((w) => w.id === 'x-ielts-t2').minWords).toBe(250);
	});
});

describe('konuşma görevleri', () => {
	it('süreler tanımlı ve makul', () => {
		for (const s of PACK.speaking) {
			expect(s.cue, s.id).toBeTruthy();
			expect(s.points.length, s.id).toBeGreaterThan(1);
			expect(s.talkSeconds, s.id).toBeGreaterThan(0);
			expect(s.talkSeconds, s.id).toBeLessThanOrEqual(180);
			expect(s.prepSeconds, s.id).toBeGreaterThanOrEqual(0);
		}
	});

	it('IELTS cue card 1 dk hazırlık + 2 dk konuşma', () => {
		const t = PACK.speaking.find((s) => s.id === 's-ielts-p2-place');
		expect(t.prepSeconds).toBe(60);
		expect(t.talkSeconds).toBe(120);
	});

	it('speakingPhases iki aşama üretir', () => {
		const f = speakingPhases({ prepSeconds: 60, talkSeconds: 120 });
		expect(f.map((x) => x.id)).toEqual(['prep', 'talk']);
		expect(f[1].seconds).toBe(120);
	});

	it('hazırlık yoksa tek aşama', () => {
		const f = speakingPhases({ prepSeconds: 0, talkSeconds: 45 });
		expect(f.length).toBe(1);
		expect(f[0].id).toBe('talk');
	});

	it('bozuk girdide çökmez', () => {
		expect(speakingPhases(null)).toEqual([]);
		expect(speakingPhases({}).length).toBe(1);
	});
});

describe('formatClock', () => {
	it('dakika:saniye verir', () => {
		expect(formatClock(0)).toBe('0:00');
		expect(formatClock(9)).toBe('0:09');
		expect(formatClock(60)).toBe('1:00');
		expect(formatClock(125)).toBe('2:05');
	});

	it('negatif ve bozuk girdide sıfır', () => {
		expect(formatClock(-5)).toBe('0:00');
		expect(formatClock(null)).toBe('0:00');
		expect(formatClock('abc')).toBe('0:00');
	});
});

describe('kelime setleri', () => {
	it('her kelimede çeviri var', () => {
		for (const v of PACK.vocabulary) {
			expect(v.words.length, v.id).toBeGreaterThan(4);
			for (const w of v.words) {
				expect(w.en, v.id).toBeTruthy();
				expect(w.tr, v.id + ' / ' + w.en).toBeTruthy();
			}
		}
	});

	it('set içinde kelime tekrarı yok', () => {
		for (const v of PACK.vocabulary) {
			const ler = v.words.map((w) => w.en.toLowerCase());
			expect(new Set(ler).size, v.id).toBe(ler.length);
		}
	});
});

describe('sorgular ve kilit', () => {
	it('examSummaries sayıları verir', () => {
		const o = examSummaries(PACK).find((e) => e.id === 'ielts');
		expect(o.writing).toBeGreaterThan(0);
		expect(o.speaking).toBeGreaterThan(0);
	});

	it("'both' içeriği iki sınavda da görünür", () => {
		const ortak = PACK.vocabulary.find((v) => v.exam === 'both');
		expect(examContent(PACK, 'ielts').vocabulary).toContain(ortak);
		expect(examContent(PACK, 'toefl').vocabulary).toContain(ortak);
	});

	it('sınava özgü içerik diğerine sızmıyor', () => {
		const idsToefl = examContent(PACK, 'toefl').writing.map((w) => w.id);
		expect(idsToefl).not.toContain('x-ielts-t1');
	});

	it('sınav görevleri ücretsiz katmanda kilitli', () => {
		// Sinav icerigi B2-C1; ucretsiz katman A1-A2.
		for (const w of PACK.writing) {
			expect(isExamTaskUnlocked(w, NO_PREMIUM, NOW), w.id).toBe(false);
		}
	});

	it('abonelikle açılır', () => {
		const p = grantPremium(PRODUCTS.LIFETIME, { now: NOW });
		for (const w of PACK.writing) {
			expect(isExamTaskUnlocked(w, p, NOW), w.id).toBe(true);
		}
	});

	it('seviyesi olmayan görev en yüksek seviye sayılır', () => {
		expect(isExamTaskUnlocked({}, NO_PREMIUM, NOW)).toBe(false);
	});

	it('bozuk girdide çökmez', () => {
		expect(findExam(null, 'ielts')).toBeNull();
		expect(examContent(PACK, 'yok')).toBeNull();
		expect(examSummaries(null)).toEqual([]);
		expect(findSpeakingTask(null, 'x')).toBeNull();
		expect(findVocabSet(PACK, 'yok')).toBeNull();
	});
});
