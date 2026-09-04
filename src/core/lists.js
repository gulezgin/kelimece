/**
 * Kişisel kelime listeleri.
 *
 * Liste yalnızca KİMLİK tutar, tanım kopyalamaz. Mimarinin içerik ↔
 * ilerleme ayrımıyla aynı gerekçe: paket güncellenip bir kelimenin
 * anlamı düzeltilince listedeki kayıt da düzelir. Tanımı listeye
 * kopyalamak, kullanıcının listesini eski ve yanlış bilginin arşivi
 * hâline getirirdi.
 *
 * Kelime EKLEME değil, var olan kelimeleri gruplama özelliği. İkisi
 * karıştırılmamalı; kullanıcı sözlüğe yeni kelime yazmıyor.
 *
 * Saf mantık: depoya ve DOM'a dokunmaz.
 */

export const MAX_LISTS = 20;
export const MAX_NAME = 40;

/** Ad temizler; boş ya da yalnızca boşluksa null döner. */
export function normalizeName(name) {
	const s = String(name == null ? '' : name).replace(/\s+/g, ' ').trim();
	return s ? s.slice(0, MAX_NAME) : null;
}

/** Türkçe duyarlı karşılaştırma için sadeleştirir. */
function foldName(name) {
	return String(name || '').toLocaleLowerCase('tr');
}

/**
 * Yeni liste ekler.
 *
 * @returns {{ok: boolean, lists: object[], error?: string, id?: string}}
 */
export function createList(lists, name) {
	const mevcut = Array.isArray(lists) ? lists : [];
	const ad = normalizeName(name);
	if (!ad) return { ok: false, lists: mevcut, error: 'Liste adı boş olamaz.' };
	if (mevcut.length >= MAX_LISTS) {
		return { ok: false, lists: mevcut, error: `En fazla ${MAX_LISTS} liste olabilir.` };
	}
	if (mevcut.some((l) => foldName(l.name) === foldName(ad))) {
		return { ok: false, lists: mevcut, error: 'Bu adda bir liste zaten var.' };
	}
	// Kimlik zaman damgasi + rastgele: ayni saniyede iki liste
	// kurulursa carpismasin.
	const id = 'lst-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
	return {
		ok: true,
		id,
		lists: [...mevcut, { id, name: ad, wordIds: [], createdAt: new Date().toISOString() }]
	};
}

/** Liste adını değiştirir. */
export function renameList(lists, id, name) {
	const mevcut = Array.isArray(lists) ? lists : [];
	const ad = normalizeName(name);
	if (!ad) return { ok: false, lists: mevcut, error: 'Liste adı boş olamaz.' };
	if (!mevcut.some((l) => l.id === id)) return { ok: false, lists: mevcut, error: 'Liste bulunamadı.' };
	if (mevcut.some((l) => l.id !== id && foldName(l.name) === foldName(ad))) {
		return { ok: false, lists: mevcut, error: 'Bu adda bir liste zaten var.' };
	}
	return { ok: true, lists: mevcut.map((l) => (l.id === id ? { ...l, name: ad } : l)) };
}

/** Listeyi siler. Kelimeler silinmez; yalnızca gruplama kalkar. */
export function deleteList(lists, id) {
	const mevcut = Array.isArray(lists) ? lists : [];
	return mevcut.filter((l) => l.id !== id);
}

/** Kelimeyi listeye ekler ya da çıkarır. */
export function toggleWord(lists, listId, wordId) {
	const mevcut = Array.isArray(lists) ? lists : [];
	return mevcut.map((l) => {
		if (l.id !== listId) return l;
		const ids = l.wordIds || [];
		return ids.includes(wordId)
			? { ...l, wordIds: ids.filter((w) => w !== wordId) }
			: { ...l, wordIds: [...ids, wordId] };
	});
}

/** Kelime bu listede mi. */
export function isInList(lists, listId, wordId) {
	const l = (lists || []).find((x) => x.id === listId);
	return !!l && (l.wordIds || []).includes(wordId);
}

/** Kelimenin bulunduğu liste sayısı. */
export function listCountFor(lists, wordId) {
	return (lists || []).filter((l) => (l.wordIds || []).includes(wordId)).length;
}

/**
 * Listedeki kelimeleri sözlükten çözer.
 *
 * Sözlükte artık bulunmayan kimlikler SESSİZCE atlanıyor. Paket
 * güncellemesinde bir kelime kalkarsa listenin tamamen bozulması
 * yerine o satırın düşmesi doğru davranış.
 */
export function wordsInList(words, list) {
	if (!list) return [];
	const ids = new Set(list.wordIds || []);
	return (words || []).filter((w) => ids.has(w.id));
}

/** Liste ekranı için özet. */
export function listSummaries(lists, words) {
	const sozluk = new Map((words || []).map((w) => [w.id, w]));
	return (Array.isArray(lists) ? lists : []).map((l) => {
		const ids = l.wordIds || [];
		const cozulen = ids.map((id) => sozluk.get(id)).filter(Boolean);
		const seviyeler = new Set(cozulen.map((w) => w.cefr).filter(Boolean));
		return {
			id: l.id,
			name: l.name,
			count: cozulen.length,
			// Sozlukte olmayan kimlik sayisi; arayuz bunu gostermiyor
			// ama liste "5 kelime" derken 3 gostermesin diye sayim
			// cozulen uzerinden yapiliyor.
			missing: ids.length - cozulen.length,
			levels: [...seviyeler].sort()
		};
	});
}

/** Kimliğe göre liste. */
export function findList(lists, id) {
	return (lists || []).find((l) => l.id === id) || null;
}
