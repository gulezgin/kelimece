/**
 * Yazma ve e-posta görevleri.
 *
 * Testlerin ağırlığı YANLIŞ ALARM tarafında: bir yazma kontrolü,
 * kullanıcının doğru yazdığı cümleye "yanlış" derse öğrenci doğruyu
 * bozar. Bu yüzden her hata kalıbı için hem yakalaması gereken hem de
 * yakalamaması gereken bir örnek var.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { grantPremium, NO_PREMIUM, PRODUCTS } from '../src/core/entitlements.js';
import {
	checkRequired,
	checkWriting,
	findMistakes,
	findTask,
	isTaskUnlocked,
	MISTAKES,
	taskSummaries,
	wordCount
} from '../src/core/writing.js';

const NOW = new Date('2026-09-04T12:00:00Z');
const YAZMA = JSON.parse(readFileSync('public/content/writing.json', 'utf8'));
const EPOSTA = JSON.parse(readFileSync('public/content/email.json', 'utf8'));
const HEPSI = [...YAZMA.tasks, ...EPOSTA.tasks];

function hataVar(metin, id) {
	return findMistakes(metin).some((h) => h.id === id);
}

describe('içerik dosyaları', () => {
	it('görevler yüklenebiliyor', () => {
		expect(YAZMA.tasks.length).toBeGreaterThan(0);
		expect(EPOSTA.tasks.length).toBeGreaterThan(0);
	});

	it('her görevde gerekli alanlar var', () => {
		for (const t of HEPSI) {
			expect(t.id, t.title).toBeTruthy();
			expect(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'], t.id).toContain(t.level);
			expect(t.prompt, t.id).toBeTruthy();
			expect(t.model, t.id).toBeTruthy();
			expect(t.minWords, t.id).toBeGreaterThan(0);
			expect(t.require.length, t.id).toBeGreaterThan(0);
		}
	});

	it('kimlikler benzersiz', () => {
		const ids = HEPSI.map((t) => t.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('istenen uzunluk sınırı makul', () => {
		for (const t of HEPSI) {
			if (t.maxWords) expect(t.maxWords, t.id).toBeGreaterThan(t.minWords);
		}
	});

	/**
	 * En önemli test: örnek cevap kendi görevinin kontrolünden geçmeli.
	 * Geçmiyorsa ya görev imkânsız ya da örnek yanlış — ikisi de
	 * kullanıcıyı çıkışsız bırakır.
	 */
	it('her örnek cevap kendi kontrolünü geçiyor', () => {
		for (const t of HEPSI) {
			const r = checkWriting(t, t.model);
			const eksik = r.required.filter((c) => !c.ok).map((c) => c.label);
			expect(eksik, t.id + ' eksik öge').toEqual([]);
			expect(r.lengthOk, `${t.id}: ${r.words} kelime (${t.minWords}-${t.maxWords})`).toBe(true);
		}
	});

	it('örnek cevaplarda kalıp hatası yok', () => {
		for (const t of HEPSI) {
			const hatalar = findMistakes(t.model).map((h) => h.id);
			expect(hatalar, t.id).toEqual([]);
		}
	});

	it('ücretsiz seviyede görev var', () => {
		expect(HEPSI.some((t) => isTaskUnlocked(t, NO_PREMIUM, NOW))).toBe(true);
	});

	it('seviyeler yükseldikçe uzunluk artıyor', () => {
		const a1 = YAZMA.tasks.filter((t) => t.level === 'A1');
		const c1 = YAZMA.tasks.filter((t) => t.level === 'C1');
		const ort = (l) => l.reduce((s, t) => s + t.minWords, 0) / l.length;
		expect(ort(a1)).toBeLessThan(ort(c1));
	});
});

describe('wordCount', () => {
	it('kelime sayar', () => expect(wordCount('one two  three')).toBe(3));
	it('boşta sıfır', () => expect(wordCount('   ')).toBe(0));
	it('null ile çökmez', () => expect(wordCount(null)).toBe(0));
});

describe('findMistakes — yakalaması gerekenler', () => {
	it('küçük i', () => expect(hataVar('Yesterday i went home.', 'kucuk-i')).toBe(true));
	it('am agree', () => expect(hataVar('I am agree with you.', 'am-agree')).toBe(true));
	it('sayılamayan çoğul', () => expect(hataVar('I need more informations.', 'sayilamaz')).toBe(true));
	it('yaş kalıbı', () => expect(hataVar('She has 30 years old.', 'yas')).toBe(true));
	it('according to me', () => expect(hataVar('According to me, it is fine.', 'bence')).toBe(true));
	it('interesting in', () => expect(hataVar('I am interesting in music.', 'ilgilenmek')).toBe(true));
	it('explain me', () => expect(hataVar('Please explain me the rule.', 'explain-me')).toBe(true));
	it('discuss about', () => expect(hataVar('We will discuss about it.', 'discuss-about')).toBe(true));
	it('married with', () => expect(hataVar('He is married with Ayse.', 'married-with')).toBe(true));
	it('çift üstünlük', () => expect(hataVar('This is more better.', 'cift-ustunluk')).toBe(true));
	it("didn't + past", () => expect(hataVar("I didn't went there.", 'didnt-past')).toBe(true));
	it('küçük harfle başlayan cümle', () => expect(hataVar('this is a test.', 'buyuk-harf')).toBe(true));
	it('noktalama eksik', () => expect(hataVar('This has no full stop', 'nokta')).toBe(true));
});

describe('findMistakes — yakalamaması gerekenler', () => {
	it('büyük I sorun değil', () => expect(hataVar('Yesterday I went home.', 'kucuk-i')).toBe(false));
	it('kelime içindeki i sayılmaz', () => expect(hataVar('This is interesting.', 'kucuk-i')).toBe(false));
	it('doğru agree', () => expect(hataVar('I agree with you.', 'am-agree')).toBe(false));
	it('tekil information', () => expect(hataVar('I need more information.', 'sayilamaz')).toBe(false));
	it('doğru yaş', () => expect(hataVar('She is 30 years old.', 'yas')).toBe(false));
	it('interested in doğru', () => expect(hataVar('I am interested in music.', 'ilgilenmek')).toBe(false));
	it('explain to me doğru', () => expect(hataVar('Please explain to me.', 'explain-me')).toBe(false));
	it("didn't + yalın fiil doğru", () => expect(hataVar("I didn't go there.", 'didnt-past')).toBe(false));
	it('doğru yazılmış metinde hata yok', () => {
		expect(findMistakes('I agree with you. She is thirty years old.')).toEqual([]);
	});

	it('aynı hata tek satır olur', () => {
		const h = findMistakes('i went home and i slept and i woke up.');
		expect(h.filter((x) => x.id === 'kucuk-i').length).toBe(1);
		expect(h.find((x) => x.id === 'kucuk-i').adet).toBeGreaterThan(1);
	});
});

describe('checkRequired', () => {
	const gorev = { require: [{ label: 'Selam', any: ['hi', 'dear'] }] };

	it('tam sözcük eşleşmesi arar', () => {
		// Duz `includes` "this" icinde "hi" buluyordu ve kullanici
		// selamlamayi hic yazmadigi halde tik aliyordu.
		expect(checkRequired(gorev, 'this machine is fine')[0].ok).toBe(false);
		expect(checkRequired(gorev, 'Hi John')[0].ok).toBe(true);
	});

	it('birden çok kelimeli kalıbı bulur', () => {
		const g = { require: [{ label: 'Teşekkür', any: ['thank you'] }] };
		expect(checkRequired(g, 'Thank you very much.')[0].ok).toBe(true);
	});

	it('kesme işaretli kalıp çalışır', () => {
		const g = { require: [{ label: 'Yazıyorum', any: ["i'm writing"] }] };
		expect(checkRequired(g, "I'm writing to invite you.")[0].ok).toBe(true);
	});

	it('şartsız görevde boş döner', () => {
		expect(checkRequired({}, 'anything')).toEqual([]);
	});
});

describe('checkWriting', () => {
	const gorev = { minWords: 10, maxWords: 20, require: [{ label: 'Selam', any: ['hello'] }] };

	it('kısa metin hazır değil', () => {
		expect(checkWriting(gorev, 'Hello there.').ready).toBe(false);
	});

	it('uzun metin hazır değil', () => {
		expect(checkWriting(gorev, 'Hello ' + 'word '.repeat(30)).lengthOk).toBe(false);
	});

	it('öge eksikse hazır değil', () => {
		expect(checkWriting(gorev, 'One two three four five six seven eight nine ten.').ready).toBe(false);
	});

	it('hepsi tamamsa hazır', () => {
		const r = checkWriting(gorev, 'Hello, this is a text with enough words to pass the check today.');
		expect(r.requiredOk).toBe(true);
		expect(r.ready).toBe(true);
	});

	it('mekanik hata teslimi engellemez', () => {
		// Bir virgul yuzunden gorevi kapatamamak ogrenmeye hizmet etmez.
		const r = checkWriting(gorev, 'Hello, i wrote this text with enough words to pass the check.');
		expect(r.mistakes.length).toBeGreaterThan(0);
		expect(r.ready).toBe(true);
	});

	it('ortalama cümle uzunluğu hesaplar', () => {
		const r = checkWriting({ minWords: 1 }, 'One two three. Four five six.');
		expect(r.sentences).toBe(2);
		expect(r.avgSentence).toBe(3);
	});

	it('boş metinde çökmez', () => {
		const r = checkWriting(gorev, '');
		expect(r.words).toBe(0);
		expect(r.ready).toBe(false);
	});
});

describe('kilit ve özet', () => {
	it('A1 ücretsiz, C1 kilitli', () => {
		expect(isTaskUnlocked({ level: 'A1' }, NO_PREMIUM, NOW)).toBe(true);
		expect(isTaskUnlocked({ level: 'C1' }, NO_PREMIUM, NOW)).toBe(false);
	});

	it('abonelikle hepsi açık', () => {
		const p = grantPremium(PRODUCTS.LIFETIME, { now: NOW });
		expect(isTaskUnlocked({ level: 'C1' }, p, NOW)).toBe(true);
	});

	it('e-posta türünü etiketler', () => {
		const o = taskSummaries([{ id: 'a', level: 'A1', kind: 'email', title: 'T', summary: 's' }],
			NO_PREMIUM, [], NOW);
		expect(o[0].kind).toBe('E-posta');
	});

	it('tamamlananı işaretler', () => {
		const o = taskSummaries([{ id: 'a', level: 'A1', title: 'T', summary: 's' }],
			NO_PREMIUM, ['a'], NOW);
		expect(o[0].done).toBe(true);
	});

	it('bozuk girdide çökmez', () => {
		expect(taskSummaries(null, NO_PREMIUM, [], NOW)).toEqual([]);
		expect(findTask(null, 'a')).toBeNull();
	});
});

describe('MISTAKES listesi', () => {
	it('kimlikler benzersiz', () => {
		const ids = MISTAKES.map((m) => m.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('her kalıbın açıklaması var', () => {
		for (const m of MISTAKES) expect(m.not, m.id).toBeTruthy();
	});
});
