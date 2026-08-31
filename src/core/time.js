/**
 * Tarih yardımcıları.
 *
 * Uygulamadaki tüm tarihler "günün başlangıcı" (00:00 yerel saat) olarak
 * normalize edilir. Tekrar takvimi gün hassasiyetinde çalıştığı için saat
 * bilgisi taşımak, aynı günü iki farklı gün gibi göstermeye yol açıyor.
 */

/** Bugünün başlangıcı, ISO string. */
export function todayISO() {
	const d = new Date();
	d.setHours(0, 0, 0, 0);
	return d.toISOString();
}

/**
 * Verilen tarihe gün ekler ve günün başlangıcına yuvarlar.
 * @param {string} iso
 * @param {number} days
 * @returns {string}
 */
export function addDays(iso, days) {
	const d = new Date(iso);
	d.setDate(d.getDate() + days);
	d.setHours(0, 0, 0, 0);
	return d.toISOString();
}

/**
 * Tekrar zamanı geldi mi? Tarihi olmayan kayıt "hemen" sayılır.
 * @param {string|null|undefined} iso
 * @returns {boolean}
 */
export function isDue(iso) {
	if (!iso) return true;
	const due = new Date(iso).getTime();
	if (Number.isNaN(due)) return true;
	const now = new Date();
	now.setHours(0, 0, 0, 0);
	return due <= now.getTime();
}

/** İki tarih aynı takvim gününe mi düşüyor? */
export function isSameDay(a, b) {
	const da = new Date(a);
	const dbb = new Date(b);
	if (Number.isNaN(da.getTime()) || Number.isNaN(dbb.getTime())) return false;
	return da.toDateString() === dbb.toDateString();
}

/**
 * Geçerli bir tarihse normalize edilmiş ISO string, değilse null döner.
 * Dışarıdan gelen veriyi doğrularken kullanılır.
 * @param {unknown} value
 * @returns {string|null}
 */
export function toValidISO(value) {
	if (!value) return null;
	const d = new Date(/** @type {any} */ (value));
	return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
