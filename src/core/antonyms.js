/**
 * Zıt anlamlılar.
 *
 * Ayrı bir içerik dosyasında duruyor, kelime paketinin içinde değil.
 * Sebep mimari: pakete alan eklemek `PACK_VERSION` yükseltmeyi ve
 * 5276 kaydın yeniden kurulmasını gerektirir. Zıt anlamlı listesi
 * ilerlemeyle ilgisi olmayan salt içerik; ayrı tutmak göç riskini
 * sıfıra indiriyor.
 *
 * Soru iki yönlü sorulur (a→b ve b→a) çünkü "big'in zıttı small"
 * ezberi "small'un zıttı big" bilgisini vermiyor.
 */

import { isLevelUnlocked } from './entitlements.js';

export const DEFAULT_OPTION_COUNT = 4;

function shuffle(arr, random = Math.random) {
	const out = arr.slice();
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}

/** Çiftin kilidi açık mı. */
export function isPairUnlocked(pair, premium, now = new Date()) {
	return isLevelUnlocked(pair && pair.level, premium, now);
}

/** Kilidi açık çiftler. */
export function unlockedPairs(pairs, premium, now = new Date()) {
	return (pairs || []).filter((p) => isPairUnlocked(p, premium, now));
}

/** Seviyeye göre gruplar; liste ekranı için. */
export function pairsByLevel(pairs, premium, now = new Date()) {
	const sira = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
	const gruplar = new Map();
	for (const p of pairs || []) {
		if (!gruplar.has(p.level)) gruplar.set(p.level, []);
		gruplar.get(p.level).push({ ...p, unlocked: isPairUnlocked(p, premium, now) });
	}
	return sira
		.filter((l) => gruplar.has(l))
		.map((level) => ({ level, pairs: gruplar.get(level) }));
}

/**
 * Bir çiftten soru üretir.
 *
 * `reverse` doğruysa soru b'den sorulur. Çeldiriciler AYNI SÖZCÜK
 * TÜRÜNDEN seçiliyor: "increase'in zıttı?" sorusuna {cold, small,
 * decrease, quiet} şıkları verilirse öğrenci anlamı bilmeden de doğru
 * cevabı bulur, soru hiçbir şey ölçmez.
 *
 * `also` alanındaki kelimeler çeldirici olamaz — onlar da doğru cevap
 * sayılabilecek eş anlamlılar ve şıkta görünürlerse soru haksız olur.
 */
export function buildAntonymQuestion(pair, allPairs, options = {}) {
	if (!pair) return null;
	const {
		reverse = false,
		count = DEFAULT_OPTION_COUNT,
		random = Math.random
	} = options;

	const soru = reverse ? pair.b : pair.a;
	const cevap = reverse ? pair.a : pair.b;

	const yasak = new Set([
		String(soru.en).toLowerCase(),
		String(cevap.en).toLowerCase(),
		...(pair.also || []).map((w) => String(w).toLowerCase())
	]);

	const havuz = [];
	for (const p of allPairs || []) {
		if (p.id === pair.id) continue;
		for (const yan of [p.a, p.b]) {
			const k = String(yan.en).toLowerCase();
			if (yasak.has(k)) continue;
			yasak.add(k);
			havuz.push({ en: yan.en, tr: yan.tr, pos: p.pos, level: p.level });
		}
	}

	// Once ayni sozcuk turu ve ayni seviye, sonra ayni sozcuk turu,
	// en son kalan her sey. Sirali daraltma, kucuk listelerde soruyu
	// uretilemez birakmiyor.
	const ayniTurSeviye = havuz.filter((c) => c.pos === pair.pos && c.level === pair.level);
	const ayniTur = havuz.filter((c) => c.pos === pair.pos);
	const secilen = [];
	for (const kaynak of [ayniTurSeviye, ayniTur, havuz]) {
		for (const c of shuffle(kaynak, random)) {
			if (secilen.length >= count - 1) break;
			if (secilen.some((s) => s.en === c.en)) continue;
			secilen.push(c);
		}
		if (secilen.length >= count - 1) break;
	}

	const siklar = shuffle([{ ...cevap, dogru: true }, ...secilen.map((c) => ({ ...c, dogru: false }))], random);
	return {
		pairId: pair.id,
		level: pair.level,
		pos: pair.pos,
		prompt: soru,
		answer: cevap,
		options: siklar,
		answerIndex: siklar.findIndex((o) => o.dogru)
	};
}

/**
 * Bir tur soru dizisi.
 *
 * Her çift en fazla bir kez soruluyor; aynı çiftin iki yönü de aynı
 * turda çıkarsa ikincisi ilkinin cevabını ele veriyor.
 */
export function buildRound(pairs, options = {}) {
	const { size = 10, random = Math.random, count = DEFAULT_OPTION_COUNT } = options;
	const liste = shuffle(pairs || [], random).slice(0, size);
	return liste
		.map((p) => buildAntonymQuestion(p, pairs, { reverse: random() < 0.5, count, random }))
		.filter(Boolean);
}

/** Tur sonucu. */
export function gradeRound(questions, answers) {
	const toplam = (questions || []).length;
	let dogru = 0;
	const detay = (questions || []).map((q, i) => {
		const secim = (answers || [])[i];
		const ok = secim === q.answerIndex;
		if (ok) dogru++;
		return {
			prompt: q.prompt,
			answer: q.answer,
			chosen: secim != null ? q.options[secim] : null,
			ok
		};
	});
	return { correct: dogru, total: toplam, score: toplam ? Math.round((dogru / toplam) * 100) : 0, detay };
}

/** İçerik dosyasını indirir. */
export async function loadPairs(url) {
	const res = await fetch(url);
	if (!res.ok) throw new Error('Zıt anlamlı içeriği yüklenemedi');
	const data = await res.json();
	return data.pairs || [];
}
