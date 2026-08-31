/**
 * Uygulama durumu ve veri işlemleri.
 *
 * Tek yazma noktası: arayüz durumu doğrudan değiştirmez, buradaki
 * fonksiyonları çağırır. Her değişiklikten sonra abonelere haber verilir,
 * böylece render çağrılarını elle takip etmek gerekmez.
 */
import { applyResult, MAX_LEVEL, scheduleNext } from '../core/srs.js';
import { isSameDay, todayISO } from '../core/time.js';
import { normalizeWord, normalizeWords } from '../core/word.js';
import { DEFAULT_SETTINGS, loadSettings, loadWords, persist, wipe } from './storage.js';

/** @type {{words: object[], settings: typeof DEFAULT_SETTINGS}} */
export const state = {
	words: [],
	settings: { ...DEFAULT_SETTINGS, today: todayISO() }
};

/** @type {Set<Function>} */
const listeners = new Set();

/** Durum değiştiğinde çağrılacak fonksiyonu kaydeder. */
export function subscribe(fn) {
	listeners.add(fn);
	return () => listeners.delete(fn);
}

function emit() {
	for (const fn of listeners) fn(state);
}

/** Depolama hatalarını (kota dolması gibi) arayüze bildirmek için. */
let onStorageError = null;
export function setStorageErrorHandler(fn) {
	onStorageError = fn;
}

function save() {
	const result = persist(state.words, state.settings);
	if (!result.ok && onStorageError) onStorageError(result.error);
	return result.ok;
}

// ===================== Yaşam döngüsü =====================

export function init() {
	state.words = normalizeWords(loadWords());
	state.settings = loadSettings();
	if (!state.settings.today) state.settings.today = todayISO();

	// Gün değiştiyse günlük sayacı sıfırla
	if (!isSameDay(state.settings.today, new Date())) {
		state.settings.today = todayISO();
		state.settings.todayAdded = 0;
	}
	emit();
}

// ===================== Kelime işlemleri =====================

/** @returns {boolean} Aynı İngilizce kelime zaten var mı? */
export function hasWord(en) {
	const key = String(en || '').trim().toLowerCase();
	if (!key) return false;
	return state.words.some((w) => w.en.toLowerCase() === key);
}

/**
 * @param {object} word createWord() çıktısı
 * @returns {{ok: boolean, reason?: string}}
 */
export function addWord(word) {
	if (!word) return { ok: false, reason: 'invalid' };
	if (hasWord(word.en)) return { ok: false, reason: 'duplicate' };

	state.words.unshift(word);
	state.settings.todayAdded += 1;
	save();
	emit();
	return { ok: true };
}

/**
 * Bir cevabı kaydeder ve tekrar takvimini günceller.
 * @param {string} id
 * @param {boolean} known
 */
export function markResult(id, known) {
	const index = state.words.findIndex((w) => w.id === id);
	if (index === -1) return null;

	const updated = applyResult(state.words[index], known);
	state.words[index] = updated;
	save();
	emit();
	return updated;
}

/** Kelimeyi elle "öğrenilmiş" seviyesine taşır. */
export function markLearned(id) {
	const w = state.words.find((x) => x.id === id);
	if (!w) return;
	w.level = MAX_LEVEL;
	w.nextReviewAt = scheduleNext(MAX_LEVEL);
	save();
	emit();
}

export function deleteWord(id) {
	const before = state.words.length;
	state.words = state.words.filter((w) => w.id !== id);
	if (state.words.length === before) return false;
	save();
	emit();
	return true;
}

// ===================== Ayarlar =====================

export function setDailyGoal(value) {
	const v = Number.parseInt(value, 10);
	state.settings.dailyGoal = Math.max(1, Math.min(1000, Number.isFinite(v) ? v : 10));
	save();
	emit();
}

export function resetTodayCounter() {
	state.settings.today = todayISO();
	state.settings.todayAdded = 0;
	save();
	emit();
}

export function wipeAll() {
	wipe();
	state.words = [];
	state.settings = { ...DEFAULT_SETTINGS, today: todayISO() };
	emit();
}

// ===================== İçe / dışa aktarma =====================

/**
 * Gelen veriyi mevcut havuzla birleştirir. Var olan kelimeler korunur,
 * üzerine yazılmaz.
 *
 * @param {unknown} data
 * @returns {{added: number, skipped: number}}
 */
export function mergeImported(data) {
	if (!data || !Array.isArray(/** @type {any} */ (data).words)) {
		throw new Error('Geçersiz dosya: "words" dizisi bulunamadı.');
	}
	const incoming = /** @type {any} */ (data).words;
	const existing = new Set(state.words.map((w) => w.en.toLowerCase()));

	let added = 0;
	let skipped = 0;
	for (const raw of incoming) {
		const w = normalizeWord(raw);
		if (!w) {
			skipped++;
			continue;
		}
		const key = w.en.toLowerCase();
		if (existing.has(key)) {
			skipped++;
			continue;
		}
		existing.add(key);
		state.words.push(w);
		added++;
	}

	const goal = /** @type {any} */ (data).settings?.dailyGoal;
	if (goal) state.settings.dailyGoal = goal;

	save();
	emit();
	return { added, skipped };
}

/** Yedek dosyasının içeriği. */
export function exportPayload() {
	return {
		words: state.words,
		settings: state.settings,
		exportedAt: new Date().toISOString()
	};
}

// ===================== Türetilmiş sayılar =====================

/**
 * @param {(iso: string) => boolean} isDue
 */
export function getStats(isDue) {
	const total = state.words.length;
	let due = 0;
	let learned = 0;
	let addedToday = 0;
	const now = new Date();

	for (const w of state.words) {
		if (w.level >= MAX_LEVEL) learned++;
		else if (isDue(w.nextReviewAt)) due++;
		if (isSameDay(w.createdAt, now)) addedToday++;
	}

	return { total, due, learned, addedToday, unlearned: total - learned };
}
