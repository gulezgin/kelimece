/**
 * Yazma alıştırmaları.
 *
 * Burada YAPILMAYAN şey önemli: bu modül metnin anlamını, tonunu ya da
 * ne kadar iyi yazıldığını değerlendirmiyor. Onu yapabilmek için bir dil
 * modeli ve sunucu gerekir. Yapabildiği üç şey var ve üçü de kesin:
 *
 * 1. Uzunluk — istenen aralıkta mı
 * 2. İstenen ögeler — görevin şart koştuğu ifadeler geçiyor mu
 * 3. Mekanik hatalar — Türkçe konuşanların tekrar tekrar yaptığı,
 *    kalıp olarak tespit edilebilen yanlışlar
 *
 * Anlam değerlendirmesi kullanıcıya bırakılıyor: görevin örnek cevabı
 * yan yana gösteriliyor. "Kendi cevabını örnekle karşılaştır" dürüst
 * bir öğretim adımı; uydurma bir puan vermek değil.
 */

import { isLevelUnlocked } from './entitlements.js';

export const MIN_WORDS_DEFAULT = 20;

/**
 * Sık yapılan hatalar.
 *
 * Liste bilinçli olarak kısa: yalnızca yanlış alarm üretmeyen kalıplar
 * var. "Eksik artikel" gibi sözcük türü bilgisi gerektiren kontroller
 * dışarıda bırakıldı — doğru çalışmayan bir uyarı, hiç uyarmamaktan
 * kötüdür, çünkü kullanıcı doğru yazdığı cümleyi bozar.
 */
export const MISTAKES = [
	{ id: 'kucuk-i', re: /(^|[^\w'])i([^\w']|$)/g, bul: 'i', dogru: 'I', not: 'İngilizcede "ben" her yerde büyük I.' },
	{ id: 'am-agree', re: /\b(am|is|are|was|were)\s+agree\b/gi, dogru: 'agree', not: '"agree" fiildir: "I agree", "I am agree" değil.' },
	{ id: 'sayilamaz', re: /\b(informations|advices|furnitures|equipments|homeworks|researches|softwares)\b/gi, not: 'Bu kelimeler İngilizcede çoğul almaz.' },
	{ id: 'yas', re: /\b(have|has)\s+\d+\s+years?\s+old\b/gi, dogru: 'am / is + yaş + years old', not: 'Yaş "olmak" ile kurulur: "I am 25 years old".' },
	{ id: 'bence', re: /\baccording to me\b/gi, dogru: 'in my opinion', not: '"According to" başkasının görüşü için kullanılır.' },
	{ id: 'ilgilenmek', re: /\b(am|is|are|was|were)\s+interesting\s+in\b/gi, dogru: 'interested in', not: '"interesting" = ilginç, "interested" = ilgili.' },
	{ id: 'explain-me', re: /\b(explain|suggest|mention)\s+me\b/gi, dogru: 'explain to me', not: 'Bu fiiller kişiden önce "to" ister.' },
	{ id: 'discuss-about', re: /\bdiscuss about\b/gi, dogru: 'discuss', not: '"discuss" nesnesini doğrudan alır.' },
	{ id: 'married-with', re: /\bmarried with\b/gi, dogru: 'married to', not: 'Evlilik "to" ile kurulur.' },
	{ id: 'cift-ustunluk', re: /\b(more better|most best|more easier|very much good)\b/gi, not: 'Üstünlük iki kez işaretlenmez.' },
	{ id: 'didnt-past', re: /\b(did ?n'?t|does ?n'?t|do ?n'?t)\s+(went|saw|had|came|took|made|got|said|knew|thought|was|were)\b/gi, not: '"did not" sonrası fiil yalın hâlde kalır: "didn\u0027t go".' },
	{ id: 'in-nowadays', re: /\bin nowadays\b/gi, dogru: 'nowadays', not: '"nowadays" tek başına zarftır.' }
];

/** Metni cümlelere böler. */
function cumleler(text) {
	return String(text || '')
		.split(/(?<=[.!?])\s+/)
		.map((c) => c.trim())
		.filter(Boolean);
}

/** Kelime sayısı. */
export function wordCount(text) {
	return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Mekanik hataları arar.
 *
 * Aynı hatadan birden fazla varsa tek satır dönüyor; on kez tekrarlanan
 * uyarı listeyi okunmaz hâle getiriyor ve kullanıcı hepsini görmezden
 * geliyor.
 */
export function findMistakes(text) {
	const s = String(text || '');
	const out = [];

	for (const m of MISTAKES) {
		m.re.lastIndex = 0;
		const eslesme = s.match(m.re);
		if (!eslesme) continue;
		out.push({
			id: m.id,
			ornek: eslesme[0].trim(),
			adet: eslesme.length,
			dogru: m.dogru || '',
			not: m.not
		});
	}

	const cs = cumleler(s);
	const kucukBaslayan = cs.filter((c) => /^[a-z]/.test(c));
	if (kucukBaslayan.length) {
		out.push({
			id: 'buyuk-harf',
			ornek: kucukBaslayan[0].slice(0, 30),
			adet: kucukBaslayan.length,
			dogru: '',
			not: 'Cümleler büyük harfle başlar.'
		});
	}

	const govde = imzasiz(s);
	if (govde && !/[.!?]$/.test(govde)) {
		out.push({ id: 'nokta', ornek: '', adet: 1, dogru: '', not: 'Son cümle noktalama işareti ile bitmiyor.' });
	}

	return out;
}

/**
 * Metnin sonundaki imzayı atar.
 *
 * "Kind regards," ve altındaki isim cümle değil; noktayla bitmemeleri
 * hata da değil. Bu ayıklama olmadan her e-posta örneği "son cümle
 * noktalama ile bitmiyor" uyarısı alıyordu ve kullanıcı imzasının
 * sonuna nokta koymaya zorlanıyordu.
 */
function imzasiz(text) {
	const satirlar = String(text || '').split(/\r?\n/).map((l) => l.trim());
	while (satirlar.length) {
		const son = satirlar[satirlar.length - 1];
		const kisa = son.split(/\s+/).filter(Boolean).length <= 4;
		if (son === '' || (kisa && !/[.!?]$/.test(son))) satirlar.pop();
		else break;
	}
	return satirlar.join(' ').trim();
}

/**
 * Görevin şart koştuğu ögeler metinde var mı.
 *
 * Her öge bir dizi: seçeneklerden biri yeterli. "Selamlama" için hem
 * "Hi" hem "Dear" kabul edilmeli — tek doğru cevap dayatmak yazmayı
 * kopyalamaya çevirir.
 */
export function checkRequired(task, text) {
	const s = String(text || '').toLowerCase();
	return ((task && task.require) || []).map((r) => ({
		label: r.label,
		ok: (r.any || []).some((k) => gecerMi(s, k))
	}));
}

/**
 * Anahtar metinde tam sözcük olarak geçiyor mu.
 *
 * Düz `includes` kullanmak "hi" istendiğinde "this" ile eşleşiyordu;
 * kullanıcı istenen ögeyi hiç yazmadığı hâlde tik alıyordu. Sınır
 * kontrolü elle yapılıyor çünkü anahtar noktalama içerebiliyor ve
 * hazır bir sözcük sınırı ifadesi orada yanlış yerde duruyor.
 */
function gecerMi(metin, anahtar) {
	const k = String(anahtar).toLowerCase().trim();
	if (!k) return false;
	const harf = (c) => c !== undefined && /[a-z0-9]/.test(c);
	let i = metin.indexOf(k);
	while (i !== -1) {
		const solOk = !harf(k[0]) || !harf(metin[i - 1]);
		const sagOk = !harf(k[k.length - 1]) || !harf(metin[i + k.length]);
		if (solOk && sagOk) return true;
		i = metin.indexOf(k, i + 1);
	}
	return false;
}

/**
 * Tam kontrol.
 *
 * `ready` yalnızca uzunluk ve istenen ögeler için; mekanik hatalar
 * teslimi engellemiyor çünkü bunlar öneri, kural değil. Bir virgül
 * yüzünden görevi kapatamamak öğrenmeye hizmet etmez.
 */
export function checkWriting(task, text) {
	const words = wordCount(text);
	const min = (task && task.minWords) || MIN_WORDS_DEFAULT;
	const max = (task && task.maxWords) || 0;
	const cs = cumleler(text);
	const required = checkRequired(task, text);

	const uzunlukTamam = words >= min && (!max || words <= max);
	const ogelerTamam = required.every((r) => r.ok);

	return {
		words,
		sentences: cs.length,
		// Uzun cumle L2 yaziminda bir numarali sorun; olculebilen ve
		// soylenebilen tek uslup gostergesi bu.
		avgSentence: cs.length ? Math.round(words / cs.length) : 0,
		min,
		max,
		required,
		mistakes: findMistakes(text),
		lengthOk: uzunlukTamam,
		requiredOk: ogelerTamam,
		ready: uzunlukTamam && ogelerTamam
	};
}

/** Ders kilitli mi. */
export function isTaskUnlocked(task, premium, now = new Date()) {
	return isLevelUnlocked(task && task.level, premium, now);
}

/** Liste için özet. */
export function taskSummaries(tasks, premium, doneIds = [], now = new Date()) {
	const done = new Set(doneIds || []);
	return (tasks || []).map((t) => ({
		id: t.id,
		title: t.title,
		icon: t.icon || '✍️',
		level: t.level,
		summary: t.summary,
		kind: t.kind === 'email' ? 'E-posta' : 'Yazma',
		minWords: t.minWords || MIN_WORDS_DEFAULT,
		unlocked: isTaskUnlocked(t, premium, now),
		done: done.has(t.id)
	}));
}

/** Kimliğe göre görev. */
export function findTask(tasks, id) {
	return (tasks || []).find((t) => t.id === id) || null;
}

/** İçerik dosyasını indirir. */
export async function loadTasks(url) {
	const res = await fetch(url);
	if (!res.ok) throw new Error('Yazma içeriği yüklenemedi');
	const data = await res.json();
	return data.tasks || [];
}
