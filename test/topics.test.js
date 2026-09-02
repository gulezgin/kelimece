/**
 * Konu grupları testleri.
 *
 * Bu katman sayı gösteriyor: "12 / 40 kelime". Yanlış sayı, kullanıcının
 * ilerlemesini yanlış okumasına yol açar — sessiz ve fark edilmesi zor
 * bir hata türü.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { NO_PREMIUM, grantPremium, PRODUCTS } from '../src/core/entitlements.js';
import { MAX_LEVEL } from '../src/core/srs.js';
import { TOPIC_ICONS, topicProgress, topicSummaries, wordsInTopic } from '../src/core/topics.js';

const PAST = new Date(Date.now() - 86400000).toISOString();
const FUTURE = new Date(Date.now() + 86400000).toISOString();

function w(topic, extra = {}) {
	return {
		id: topic + '-' + (extra.en || Math.random()),
		en: 'x',
		tr: 'y',
		cefr: 'A1',
		source: 'core',
		level: 0,
		nextReviewAt: FUTURE,
		topic,
		...extra
	};
}

describe('topicSummaries', () => {
	it('konuya göre gruplar ve sayar', () => {
		const { topics } = topicSummaries([w('ev'), w('ev'), w('vücut')]);
		expect(topics).toHaveLength(2);
		expect(topics[0].topic).toBe('ev');
		expect(topics[0].total).toBe(2);
	});

	it('konusuz kelimeleri grup yapmaz, ayrıca sayar', () => {
		const { topics, untopiced } = topicSummaries([w('ev'), w(null), w(undefined)]);
		expect(topics).toHaveLength(1);
		expect(untopiced).toBe(2);
	});

	it('öğrenilmiş ve tekrar bekleyeni ayırır', () => {
		const { topics } = topicSummaries([
			w('ev', { level: MAX_LEVEL }),
			w('ev', { nextReviewAt: PAST }),
			w('ev')
		]);
		expect(topics[0].learned).toBe(1);
		expect(topics[0].due).toBe(1);
		expect(topics[0].total).toBe(3);
	});

	it('öğrenilmiş kelime ayrıca tekrar sayılmaz', () => {
		// En üst kutudaki kelime gecmis tarihli olsa bile kuyruğa girmez.
		const { topics } = topicSummaries([w('ev', { level: MAX_LEVEL, nextReviewAt: PAST })]);
		expect(topics[0].learned).toBe(1);
		expect(topics[0].due).toBe(0);
	});

	it('abonelik verilince kilitli sayar', () => {
		const { topics } = topicSummaries(
			[w('ev', { cefr: 'A1' }), w('ev', { cefr: 'B2' }), w('ev', { cefr: 'C1' })],
			NO_PREMIUM
		);
		expect(topics[0].locked).toBe(2);
	});

	it('kullanıcının kendi kelimesi kilitli sayılmaz', () => {
		const { topics } = topicSummaries([w('ev', { cefr: 'C2', source: 'user' })], NO_PREMIUM);
		expect(topics[0].locked).toBe(0);
	});

	it('abone için kilitli kalmaz', () => {
		const premium = grantPremium(PRODUCTS.LIFETIME);
		const { topics } = topicSummaries([w('ev', { cefr: 'C1' })], premium);
		expect(topics[0].locked).toBe(0);
	});

	it('abonelik verilmezse kilit hesaplanmaz', () => {
		const { topics } = topicSummaries([w('ev', { cefr: 'C1' })]);
		expect(topics[0].locked).toBe(0);
	});

	it('büyük konu önce gelir, eşitlikte alfabetik', () => {
		const { topics } = topicSummaries([w('zaman'), w('ev'), w('ev'), w('aile')]);
		expect(topics.map((t) => t.topic)).toEqual(['ev', 'aile', 'zaman']);
	});

	it('bilinen konuya simge atar, bilinmeyene varsayılan', () => {
		const { topics } = topicSummaries([w('ev'), w('bilinmeyen konu')]);
		const byName = Object.fromEntries(topics.map((t) => [t.topic, t.icon]));
		expect(byName['ev']).toBe(TOPIC_ICONS['ev']);
		expect(byName['bilinmeyen konu']).toBe('📗');
	});

	it('boş ve bozuk girdide çökmez', () => {
		expect(topicSummaries([]).topics).toEqual([]);
		expect(topicSummaries(null).topics).toEqual([]);
		expect(topicSummaries([null, undefined]).untopiced).toBe(2);
	});
});

describe('wordsInTopic', () => {
	it('yalnızca o konudakileri döner', () => {
		const list = [w('ev'), w('vücut'), w('ev')];
		expect(wordsInTopic(list, 'ev')).toHaveLength(2);
		expect(wordsInTopic(list, 'yok')).toHaveLength(0);
	});

	it('bozuk girdide çökmez', () => {
		expect(wordsInTopic(null, 'ev')).toEqual([]);
		expect(wordsInTopic([null], 'ev')).toEqual([]);
	});
});

describe('topicProgress', () => {
	it('yüzdeyi yuvarlar', () => {
		expect(topicProgress({ total: 3, learned: 1 })).toBe(33);
		expect(topicProgress({ total: 4, learned: 4 })).toBe(100);
	});

	it('boş konuda sıfır', () => {
		expect(topicProgress({ total: 0, learned: 0 })).toBe(0);
		expect(topicProgress(null)).toBe(0);
	});
});

describe('paket ile simge eşleşmesi', () => {
	// Konu listesi scripts/infer-pos.mjs'de, simgeler src/core/topics.js'de
	// duruyor. Yeni bir konu grubu eklenip simgesi unutulunca kart sessizce
	// varsayilan simgeye dusuyor - ekranda fark edilmesi zor. Bu test o
	// kaymayi yakalar.
	it('paketteki her konunun simgesi var', () => {
		const pack = JSON.parse(readFileSync('public/content/core-v1.json', 'utf8'));
		const topics = [...new Set(pack.words.filter((w) => w.topic).map((w) => w.topic))];
		expect(topics.length).toBeGreaterThan(0);
		const missing = topics.filter((t) => !TOPIC_ICONS[t]);
		expect(missing).toEqual([]);
	});
});
