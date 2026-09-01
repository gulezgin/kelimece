/**
 * Üretilen içerik paketinin bütünlük testleri.
 *
 * Paket bir betikle üretiliyor (scripts/build-content-pack.mjs); bu testler
 * çıktının uygulamanın beklediği sözleşmeye uyduğunu doğrular. Bozuk bir
 * paket her kullanıcıya dağıtılacağı için burada sıkı davranmak gerekiyor.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { normalizeDefinition } from '../src/core/word.js';

const pack = JSON.parse(readFileSync(new URL('../public/content/core-v1.json', import.meta.url), 'utf8'));
const CEFR = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

describe('paket üst verisi', () => {
	it('kimlik ve sürüm taşır', () => {
		expect(pack.pack.id).toBe('core');
		expect(pack.pack.version).toBeGreaterThanOrEqual(1);
	});

	it('bildirilen kelime sayısı gerçekle uyuşur', () => {
		expect(pack.words).toHaveLength(pack.pack.wordCount);
	});
});

describe('kelime kayıtları', () => {
	it('boş değil', () => {
		expect(pack.words.length).toBeGreaterThan(4000);
	});

	it('her kaydın benzersiz kimliği var', () => {
		const ids = pack.words.map((w) => w.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('kimlikler paket ön ekini taşır', () => {
		for (const w of pack.words) expect(w.id.startsWith('core:')).toBe(true);
	});

	it('aynı İngilizce kelime iki kez geçmez', () => {
		const keys = pack.words.map((w) => w.en.toLowerCase());
		const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
		expect(dupes).toEqual([]);
	});

	it('her kaydın İngilizce ve Türkçe karşılığı dolu', () => {
		const empty = pack.words.filter((w) => !w.en.trim() || !w.tr.trim());
		expect(empty).toEqual([]);
	});

	it('İngilizce alanda Türkçe harf kalmadı', () => {
		// Regresyon: 16 kayıtta Türkçe noktasız 'ı' vardı ('ımprove').
		// Sözlük eşleşmesini, aramayı ve sesli okumayı bozuyordu.
		const bad = pack.words.filter((w) => /[ıİğĞşŞçÇöÖüÜ]/.test(w.en)).map((w) => w.en);
		expect(bad).toEqual([]);
	});

	it('baş sözcükte virgül kalmadı', () => {
		// "prosperity, welfare, wealth" -> baş sözcük + eş anlamlılar
		const bad = pack.words.filter((w) => w.en.includes(',')).map((w) => w.en);
		expect(bad).toEqual([]);
	});

	it('yer tutucu "x" kalmadı', () => {
		const bad = pack.words.filter((w) => /\s+x$/.test(w.en)).map((w) => w.en);
		expect(bad).toEqual([]);
	});

	it('eş anlamlı listesi baş sözcüğü tekrar etmez', () => {
		const bad = pack.words
			.filter((w) => w.synonyms.some((s) => s.toLowerCase() === w.en.toLowerCase()))
			.map((w) => w.en);
		expect(bad).toEqual([]);
	});
});

describe('CEFR seviyeleri', () => {
	it('her kelimenin geçerli bir seviyesi var', () => {
		const bad = pack.words.filter((w) => !CEFR.includes(w.cefr)).map((w) => w.en);
		expect(bad).toEqual([]);
	});

	it('her seviyede kelime var', () => {
		for (const level of CEFR) {
			expect(pack.words.filter((w) => w.cefr === level).length).toBeGreaterThan(0);
		}
	});

	it('temel seviyeler ileri seviyelerden kalabalık', () => {
		// Sağlıklı bir öğrenme eğrisi: A1+A2 toplamı C1+C2'den fazla olmalı.
		const basic = pack.words.filter((w) => w.cefr === 'A1' || w.cefr === 'A2').length;
		const advanced = pack.words.filter((w) => w.cefr === 'C1' || w.cefr === 'C2').length;
		expect(basic).toBeGreaterThan(advanced);
	});
});

describe('A1 temel kelime dağarcığı', () => {
	const has = (en) => pack.words.some((w) => w.en.toLowerCase() === en.toLowerCase());

	it('sayıları içerir', () => {
		for (const n of ['one', 'two', 'three', 'ten', 'hundred', 'thousand']) {
			expect(has(n), n + ' eksik').toBe(true);
		}
	});

	it('gün ve ayları içerir', () => {
		for (const d of ['Monday', 'Sunday', 'January', 'December', 'today', 'tomorrow']) {
			expect(has(d), d + ' eksik').toBe(true);
		}
	});

	it('soru kelimelerini içerir', () => {
		for (const q of ['what', 'when', 'where', 'why', 'how', 'who', 'which']) {
			expect(has(q), q + ' eksik').toBe(true);
		}
	});

	it('zamirleri ve bağlaçları içerir', () => {
		for (const w of ['I', 'you', 'he', 'she', 'we', 'and', 'but', 'or', 'because', 'if']) {
			expect(has(w), w + ' eksik').toBe(true);
		}
	});
});

describe('örnek cümleler', () => {
	const withExample = pack.words.filter((w) => w.example);

	it('kelimelerin büyük çoğunluğunda örnek cümle var', () => {
		expect(withExample.length / pack.words.length).toBeGreaterThan(0.9);
	});

	it('örneklerin neredeyse tamamında Türkçe çeviri var', () => {
		const withTr = withExample.filter((w) => w.exampleTr);
		expect(withTr.length / withExample.length).toBeGreaterThan(0.98);
	});

	it('örnek cümle hedef kelimeyi içerir', () => {
		// Çekim toleransı: "bury" cümlede "buries" olarak geçebilir,
		// bu yüzden y->i dönüşümü de kök sayılıyor.
		const failures = [];
		for (const w of withExample.slice(0, 400)) {
			if (/[\s-]/.test(w.en)) continue; // öbekler ayrı ele alınır
			const lower = w.en.toLowerCase();
			const stems = [lower, lower.replace(/e$/, ''), lower.replace(/y$/, 'i')];
			const text = w.example.toLowerCase();
			if (!stems.some((s) => text.includes(s))) failures.push(w.en);
		}
		expect(failures).toEqual([]);
	});

	it('örnek cümleler makul uzunlukta', () => {
		const bad = withExample.filter((w) => {
			const n = w.example.split(/\s+/).length;
			return n < 3 || n > 16;
		});
		expect(bad.map((w) => w.en)).toEqual([]);
	});

	it('örnek cümleler noktalama ile biter', () => {
		const bad = withExample.filter((w) => !/[.!?]$/.test(w.example.trim()));
		expect(bad.map((w) => w.en)).toEqual([]);
	});
});

describe('kaynak atfı', () => {
	it('paket Tatoeba atfını taşır', () => {
		// CC BY 2.0 FR atfı zorunlu kılıyor; kaldırılırsa lisans ihlali.
		const attribution = pack.pack.attribution || [];
		expect(attribution.some((a) => a.name === 'Tatoeba')).toBe(true);
		const tatoeba = attribution.find((a) => a.name === 'Tatoeba');
		expect(tatoeba.license).toContain('CC BY');
		expect(tatoeba.url).toBeTruthy();
	});
});

describe('sıklık ve sınıflandırma alanları', () => {
	it('tek kelimelerin çoğunda sıklık sırası var', () => {
		const single = pack.words.filter((w) => !/[\s-]/.test(w.en));
		const ranked = single.filter((w) => w.freqRank);
		expect(ranked.length / single.length).toBeGreaterThan(0.9);
	});

	it('çok kelimeli ifadelerde sıklık sırası yok', () => {
		// Öbeğin zorluğu bileşenlerinin sıklığından okunamaz.
		const bad = pack.words.filter((w) => /[\s-]/.test(w.en) && w.freqRank).map((w) => w.en);
		expect(bad).toEqual([]);
	});

	it('sıklık sıraları pozitif', () => {
		const bad = pack.words.filter((w) => w.freqRank !== null && w.freqRank < 1);
		expect(bad).toEqual([]);
	});
});

describe('sözcük türü ve konu', () => {
	const VALID_POS = new Set([
		'noun', 'verb', 'adjective', 'adverb', 'pronoun', 'preposition',
		'conjunction', 'determiner', 'number', 'ordinal', 'phrasal verb', 'phrase',
		'interjection'
	]);

	it('kelimelerin yarısından fazlasında sözcük türü var', () => {
		const withPos = pack.words.filter((w) => w.pos);
		expect(withPos.length / pack.words.length).toBeGreaterThan(0.5);
	});

	it('yalnızca bilinen sözcük türleri kullanılıyor', () => {
		const bad = pack.words.filter((w) => w.pos && !VALID_POS.has(w.pos)).map((w) => w.en + ':' + w.pos);
		expect(bad).toEqual([]);
	});

	it('Türkçe mastar ile biten kayıtlar fiil işaretli', () => {
		// "-mek/-mak" en güvenilir tür ipucu; kaçırılmamalı.
		//
		// İki istisna:
		//  - Noktalı virgül ayrı anlamları gösterir ("aşçı; pişirmek"),
		//    orada isim de fiil de doğru olabilir.
		//  - "parmak", "ekmek" gibi Türkçe isimler mastar gibi biter.
		const TR_NOUNS = new Set(['parmak', 'ekmek', 'yemek', 'çocuk', 'ayak',
			'yatak', 'bardak', 'bıçak', 'kaynak', 'dudak', 'yanak', 'sıcak',
			'oyuncak', 'tabak']);

		const missed = pack.words.filter((w) => {
			if (/[\s-]/.test(w.en)) return false;
			if (w.tr.includes(';')) return false;
			// "Her anlamı mastar" olmalı: "report" = "bildirmek, rapor"
			// hem isim hem fiil, ikisi de doğru. Ama tüm anlamları
			// mastarsa kelime kesin fiildir.
			const senses = w.tr.toLowerCase().split(',').map((p) => p.trim()).filter(Boolean);
			const allVerbs = senses.length > 0 && senses.every(
				(p) => /(mek|mak)$/.test(p) && !(!/\s/.test(p) && TR_NOUNS.has(p))
			);
			return allVerbs && w.pos !== 'verb';
		}).map((w) => w.en);
		expect(missed).toEqual([]);
	});

	it('sözcük türü yalnızca kaynak dosyalardan ya da çıkarımdan gelir', () => {
		// Regresyon: infer-pos.mjs üretilmiş paketi okuyup kendi eski
		// çıktısını "elle yazılmış" sanıyordu. Hatalı bir çıkarım sonsuza
		// kadar korunuyor, düzeltme hiç uygulanmıyordu.
		// "bread" (ekmek) yanlışlıkla fiil işaretlenmişti.
		const bread = pack.words.find((w) => w.en === 'bread');
		expect(bread.pos).not.toBe('verb');
	});

	it('konusu olan kayıtlarda konu boş metin değil', () => {
		const bad = pack.words.filter((w) => w.topic !== null && !String(w.topic).trim());
		expect(bad).toEqual([]);
	});
});

describe('şema uyumu', () => {
	it('her kayıt normalizeDefinition sınırından değişmeden geçer', () => {
		// Paket, uygulamanın doğrulama katmanıyla birebir uyumlu olmalı;
		// aksi hâlde kurulumda sessizce alan kaybı olur.
		for (const w of pack.words.slice(0, 200)) {
			const normalized = normalizeDefinition(w, { source: 'core' });
			expect(normalized, w.en).not.toBeNull();
			expect(normalized.id).toBe(w.id);
			expect(normalized.en).toBe(w.en);
			expect(normalized.cefr).toBe(w.cefr);
			expect(normalized.freqRank).toBe(w.freqRank);
		}
	});
});
