/**
 * Konuşma karşılaştırması.
 *
 * Kullanıcı bir cümleyi söylüyor, konuşma tanıma bir metin döndürüyor
 * ve burada hedefle karşılaştırılıyor.
 *
 * NE ÖLÇÜLDÜĞÜ konusunda dürüst olmak gerekiyor: bu bir TELAFFUZ
 * PUANI DEĞİL. Fonem düzeyinde analiz (§12'deki "TH sesin zayıf")
 * ücretli, özel bir servis istiyor. Burada ölçülen şey, konuşma
 * tanımanın söylediklerini hedef cümleyle ne kadar eşleştirebildiği.
 * Bu yine de değerli: yanlış telaffuz edilen kelime çoğu zaman
 * tanınmıyor ve kullanıcı hangi kelimede takıldığını görüyor.
 *
 * Arayüz bu farkı gizlememeli; "telaffuz puanın" demek, veremediğimiz
 * bir söz vermek olur.
 *
 * Saf mantık: mikrofona, DOM'a ve depoya dokunmaz.
 */
import { editDistance } from './exercise.js';

/**
 * Yaygın kısaltmalar. Konuşma tanıma "I'm" yerine "I am" (ya da tersi)
 * döndürebiliyor; bu fark telaffuz hatası değil, yazıya dökme tercihi.
 */
const CONTRACTIONS = [
	["i'm", 'i am'], ["you're", 'you are'], ["we're", 'we are'],
	["they're", 'they are'], ["he's", 'he is'], ["she's", 'she is'],
	["it's", 'it is'], ["that's", 'that is'], ["there's", 'there is'],
	["what's", 'what is'], ["let's", 'let us'], ["i've", 'i have'],
	["i'll", 'i will'], ["i'd", 'i would'], ["don't", 'do not'],
	["doesn't", 'does not'], ["didn't", 'did not'], ["can't", 'can not'],
	["won't", 'will not'], ["isn't", 'is not'], ["aren't", 'are not'],
	["wasn't", 'was not'], ["couldn't", 'could not'], ["wouldn't", 'would not'],
	["shouldn't", 'should not'], ["haven't", 'have not'], ["hasn't", 'has not']
];

/** Karşılaştırma için sözcük dizisine çevirir. */
export function tokenize(text) {
	let s = String(text || '').toLowerCase();
	for (const [kisa, uzun] of CONTRACTIONS) {
		s = s.split(kisa).join(uzun);
	}
	return s
		.replace(/[^a-z\s']/g, ' ')
		.replace(/'/g, '')
		.split(/\s+/)
		.filter(Boolean);
}

/**
 * İki sözcük aynı sayılır mı?
 *
 * Uzun sözcüklerde bir harflik fark bağışlanıyor: konuşma tanıma
 * "worked" yerine "work" yazabiliyor ve bunu hata saymak kullanıcıyı
 * yapmadığı bir yanlış için cezalandırmak olur.
 */
function esitMi(a, b) {
	if (a === b) return true;
	if (a.length < 4 || b.length < 4) return false;
	return editDistance(a, b) <= 1;
}

/**
 * Hedef ve duyulan sözcük dizileri arasındaki en uzun ortak alt dizi.
 * Sıra önemli: "milk the drink" ile "drink the milk" aynı sayılmamalı.
 */
function lcsEslesme(hedef, duyulan) {
	const n = hedef.length;
	const m = duyulan.length;
	const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
	for (let i = n - 1; i >= 0; i--) {
		for (let j = m - 1; j >= 0; j--) {
			dp[i][j] = esitMi(hedef[i], duyulan[j])
				? dp[i + 1][j + 1] + 1
				: Math.max(dp[i + 1][j], dp[i][j + 1]);
		}
	}
	// Geri izleyerek hangi hedef sozcuklerin eslestigini bul
	const eslesen = new Array(n).fill(false);
	let i = 0;
	let j = 0;
	while (i < n && j < m) {
		if (esitMi(hedef[i], duyulan[j])) {
			eslesen[i] = true;
			i++;
			j++;
		} else if (dp[i + 1][j] >= dp[i][j + 1]) {
			i++;
		} else {
			j++;
		}
	}
	return eslesen;
}

/** Puana göre kısa geri bildirim. */
function yorum(score) {
	if (score >= 90) return 'Neredeyse kusursuz.';
	if (score >= 70) return 'İyi. Eksik kalan kelimeleri tekrar dene.';
	if (score >= 40) return 'Yarısı anlaşıldı. Daha yavaş ve net söyle.';
	return 'Anlaşılmadı. Önce dinle, sonra tekrar et.';
}

/**
 * Söylenen cümleyi hedefle karşılaştırır.
 *
 * @param {string} target Hedef cümle
 * @param {string} heard Konuşma tanımanın döndürdüğü metin
 * @returns {{score: number, words: {word: string, ok: boolean}[],
 *   matched: number, total: number, heard: string, comment: string}}
 */
export function compareUtterance(target, heard) {
	const hedefSozcukler = tokenize(target);
	const duyulanSozcukler = tokenize(heard);

	if (!hedefSozcukler.length) {
		return { score: 0, words: [], matched: 0, total: 0, heard: '', comment: yorum(0) };
	}

	const eslesen = duyulanSozcukler.length
		? lcsEslesme(hedefSozcukler, duyulanSozcukler)
		: new Array(hedefSozcukler.length).fill(false);

	const matched = eslesen.filter(Boolean).length;
	const score = Math.round((matched / hedefSozcukler.length) * 100);

	// Kelimeler HEDEF cumledeki haliyle gosteriliyor, kucuk harfe
	// indirgenmis haliyle degil: kullanici kendi cumlesini taniyabilmeli.
	const gorunen = String(target).split(/\s+/).filter(Boolean);
	const words = hedefSozcukler.map((w, i) => ({
		word: gorunen[i] || w,
		ok: eslesen[i]
	}));

	return {
		score,
		words,
		matched,
		total: hedefSozcukler.length,
		heard: String(heard || '').trim(),
		comment: yorum(score)
	};
}

/** Kabul eşiği: bu puanın altında tekrar denemek öğretici. */
export const PASS_SCORE = 70;

/** Deneme başarılı sayılır mı? */
export function isPass(result) {
	return !!result && result.score >= PASS_SCORE;
}
