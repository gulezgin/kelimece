/**
 * IndexedDB üzerine ince bir sarmalayıcı.
 *
 * Neden IndexedDB: localStorage'ın ~5MB sınırı A1-C2 müfredatını (kelime +
 * gramer + örnek cümle + ileride ses) kaldırmaz. Ayrıca localStorage her
 * yazmada tüm veriyi JSON'a çevirir; 1682 kelimede bu her cevapta ~600KB
 * serialize demek.
 *
 * Neden kütüphane değil: erişim desenimiz basit (topluca oku, topluca yaz,
 * anahtarla getir/sil). Karmaşık sorgu yok — filtreleme bellekte yapılıyor.
 * Bu yüzden ~30KB'lık bir bağımlılık yerine bu dosya yeterli.
 */

const DB_NAME = 'kelime_havuzum';
const DB_VERSION = 1;

export const STORE_WORDS = 'words';
export const STORE_PROGRESS = 'progress';
export const STORE_META = 'meta';

/** @type {IDBDatabase|null} */
let dbInstance = null;

/** Tarayıcı IndexedDB destekliyor mu? (Bazı gizli pencerelerde kapalı olabilir.) */
export function isSupported() {
	try {
		return typeof indexedDB !== 'undefined' && indexedDB !== null;
	} catch {
		return false;
	}
}

/**
 * Veritabanını açar (ilk çağrıda şemayı kurar).
 * @returns {Promise<IDBDatabase>}
 */
export function openDB() {
	if (dbInstance) return Promise.resolve(dbInstance);

	return new Promise((resolve, reject) => {
		if (!isSupported()) {
			reject(new Error('Bu tarayıcıda IndexedDB kullanılamıyor.'));
			return;
		}

		const request = indexedDB.open(DB_NAME, DB_VERSION);

		request.onupgradeneeded = (event) => {
			const db = request.result;
			const from = event.oldVersion;

			// v1: ilk şema
			if (from < 1) {
				// Tanımlar: paketten gelen veya kullanıcının eklediği kelimeler
				const words = db.createObjectStore(STORE_WORDS, { keyPath: 'id' });
				words.createIndex('source', 'source', { unique: false });
				words.createIndex('cefr', 'cefr', { unique: false });

				// İlerleme: kullanıcıya ait öğrenme durumu, tanımdan ayrı
				const progress = db.createObjectStore(STORE_PROGRESS, { keyPath: 'wordId' });
				progress.createIndex('nextReviewAt', 'nextReviewAt', { unique: false });

				// Ayarlar, paket sürümleri, göç kayıtları
				db.createObjectStore(STORE_META, { keyPath: 'key' });
			}
		};

		request.onsuccess = () => {
			dbInstance = request.result;
			// Başka bir sekme sürüm yükseltirse bu bağlantıyı kapat.
			dbInstance.onversionchange = () => {
				dbInstance.close();
				dbInstance = null;
			};
			resolve(dbInstance);
		};

		request.onerror = () => reject(request.error || new Error('IndexedDB açılamadı.'));
		request.onblocked = () => reject(new Error('Veritabanı başka bir sekmede açık. Diğer sekmeleri kapatın.'));
	});
}

/** İşlemi söze (promise) çevirir. */
function txDone(tx) {
	return new Promise((resolve, reject) => {
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
		tx.onabort = () => reject(tx.error || new Error('İşlem iptal edildi.'));
	});
}

function reqDone(request) {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

/**
 * Bir depodaki tüm kayıtları döner.
 * @param {string} storeName
 * @returns {Promise<any[]>}
 */
export async function getAll(storeName) {
	const db = await openDB();
	const tx = db.transaction(storeName, 'readonly');
	return reqDone(tx.objectStore(storeName).getAll());
}

/**
 * Tek kayıt getirir.
 * @returns {Promise<any|undefined>}
 */
export async function get(storeName, key) {
	const db = await openDB();
	const tx = db.transaction(storeName, 'readonly');
	return reqDone(tx.objectStore(storeName).get(key));
}

/**
 * Tek kayıt yazar (varsa üzerine).
 */
export async function put(storeName, value) {
	const db = await openDB();
	const tx = db.transaction(storeName, 'readwrite');
	tx.objectStore(storeName).put(value);
	return txDone(tx);
}

/**
 * Çok sayıda kaydı TEK işlemde yazar.
 *
 * Tek tek put() çağırmak 1682 kayıtta 1682 işlem açar; bu sürüm hepsini
 * tek işlemde toplar ve ya hepsi yazılır ya hiçbiri.
 *
 * @param {string} storeName
 * @param {any[]} values
 */
export async function bulkPut(storeName, values) {
	if (!values.length) return;
	const db = await openDB();
	const tx = db.transaction(storeName, 'readwrite');
	const store = tx.objectStore(storeName);
	for (const v of values) store.put(v);
	return txDone(tx);
}

/**
 * Birden fazla depoya tek işlemde yazar — ya hepsi ya hiçbiri.
 * Tanım ve ilerleme birlikte yazılırken tutarlılığı korur.
 *
 * @param {Record<string, any[]>} byStore { storeName: values[] }
 */
export async function bulkPutMulti(byStore) {
	const names = Object.keys(byStore).filter((n) => byStore[n] && byStore[n].length);
	if (!names.length) return;

	const db = await openDB();
	const tx = db.transaction(names, 'readwrite');
	for (const name of names) {
		const store = tx.objectStore(name);
		for (const v of byStore[name]) store.put(v);
	}
	return txDone(tx);
}

/** Anahtara göre siler. */
export async function remove(storeName, key) {
	const db = await openDB();
	const tx = db.transaction(storeName, 'readwrite');
	tx.objectStore(storeName).delete(key);
	return txDone(tx);
}

/** Birden fazla anahtarı tek işlemde siler. */
export async function bulkRemove(storeName, keys) {
	if (!keys.length) return;
	const db = await openDB();
	const tx = db.transaction(storeName, 'readwrite');
	const store = tx.objectStore(storeName);
	for (const k of keys) store.delete(k);
	return txDone(tx);
}

/** Bir depoyu tamamen boşaltır. */
export async function clear(storeName) {
	const db = await openDB();
	const tx = db.transaction(storeName, 'readwrite');
	tx.objectStore(storeName).clear();
	return txDone(tx);
}

/** Tüm depoları tek işlemde boşaltır. */
export async function clearAll() {
	const db = await openDB();
	const names = [STORE_WORDS, STORE_PROGRESS, STORE_META];
	const tx = db.transaction(names, 'readwrite');
	for (const n of names) tx.objectStore(n).clear();
	return txDone(tx);
}

/** meta deposundan değer okur. */
export async function getMeta(key, fallback = null) {
	const row = await get(STORE_META, key);
	return row ? row.value : fallback;
}

/** meta deposuna değer yazar. */
export function setMeta(key, value) {
	return put(STORE_META, { key, value });
}

/** Test ve "tüm veriyi sil" sonrası bağlantıyı serbest bırakır. */
export function closeDB() {
	if (dbInstance) {
		dbInstance.close();
		dbInstance = null;
	}
}
