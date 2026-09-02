/**
 * Günlük konuşma diyalogları.
 *
 * Kelime çalışması tek başına konuşmayı öğretmiyor: "restaurant"
 * kelimesini bilmek, garsonla konuşabilmek demek değil. Diyaloglar
 * kelimeleri gerçek bir kullanım bağlamına oturtuyor.
 *
 * İçerik statik ve küçük (16 KB). Kelime paketi gibi IndexedDB'ye
 * kurulmuyor; ilerleme tutulmadığı için buna gerek yok, bellekte
 * tutmak yeterli.
 */
import { isLevelUnlocked } from './entitlements.js';

let cache = null;

/**
 * Diyalogları yükler. İkinci çağrıda ağa çıkmaz.
 * @param {string} url
 * @returns {Promise<object[]>}
 */
export async function loadDialogues(url) {
	if (cache) return cache;
	try {
		const res = await fetch(url);
		if (!res.ok) throw new Error('HTTP ' + res.status);
		const data = await res.json();
		cache = Array.isArray(data.dialogues) ? data.dialogues : [];
	} catch {
		// Ağ ya da dosya hatasında boş liste: ekran "içerik yok" der,
		// uygulama çökmez.
		cache = [];
	}
	return cache;
}

/** Test ve yeniden yükleme için önbelleği temizler. */
export function resetCache() {
	cache = null;
}

/**
 * Diyalog abonelik olmadan açılabilir mi?
 * Kelimelerdeki kuralın aynısı: A1 ve A2 ücretsiz.
 */
export function isDialogueUnlocked(dialogue, premium, now) {
	if (!dialogue) return false;
	return isLevelUnlocked(dialogue.cefr, premium, now);
}

/**
 * Listeleme için özet: kilit durumu ve satır sayısı eklenmiş kopyalar.
 * Kilitliler listeden çıkarılmıyor — kullanıcı neyi kaçırdığını
 * görmeden abone olmaz.
 */
export function dialogueSummaries(dialogues, premium, now) {
	return (dialogues || []).filter(Boolean).map((d) => ({
		id: d.id,
		title: d.title,
		icon: d.icon || '💬',
		cefr: d.cefr,
		summary: d.summary || '',
		lineCount: (d.lines || []).length,
		locked: !isDialogueUnlocked(d, premium, now)
	}));
}

/** Kimliğe göre tek diyalog. */
export function findDialogue(dialogues, id) {
	return (dialogues || []).find((d) => d && d.id === id) || null;
}

/**
 * Diyalogda geçen ve havuzda karşılığı olan kelimeler.
 *
 * Amaç: diyalogu okurken bilinmeyen bir kelimeye dokunup anlamını
 * görebilmek. Eşleştirme kaba ama yeterli — noktalama atılıp küçük
 * harfe indirgenmiş sözcükler havuzla karşılaştırılıyor.
 */
export function wordsInLine(line, wordIndex) {
	const found = [];
	const seen = new Set();
	for (const raw of String(line || '').split(/[^A-Za-z']+/)) {
		const key = raw.toLowerCase().replace(/^'+|'+$/g, '');
		if (key.length < 2 || seen.has(key)) continue;
		seen.add(key);
		const w = wordIndex.get(key);
		if (w) found.push(w);
	}
	return found;
}
