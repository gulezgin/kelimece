/**
 * Hatırlatma metinleri ve saat biçimi testleri.
 *
 * Platform çağrıları (Capacitor / Notification API) burada test
 * edilmiyor — saf yardımcılar test ediliyor.
 */
import { describe, expect, it } from 'vitest';
import { buildMessage, formatTime, parseTime } from '../src/platform/notifications.js';

describe('buildMessage', () => {
	it('bekleyen kelime varsa sayıyı söyler', () => {
		const m = buildMessage({ due: 42, streak: 0 });
		expect(m.body).toContain('42');
	});

	it('seri varsa seriyi öne çıkarır', () => {
		const m = buildMessage({ due: 12, streak: 7 });
		expect(m.title).toContain('7');
		expect(m.body).toContain('12');
	});

	it('bekleyen yokken de bir mesaj üretir', () => {
		const m = buildMessage({ due: 0, streak: 0 });
		expect(m.title).toBeTruthy();
		expect(m.body).toBeTruthy();
	});

	it('argümansız çağrıda çökmez', () => {
		const m = buildMessage();
		expect(m.title).toBeTruthy();
	});

	it('suçlayıcı dil kullanmaz', () => {
		// Baskı kısa vadede tıklatır, uzun vadede uygulamayı sildirir.
		const harsh = ['kaybettin', 'kaybediyorsun', 'başarısız', 'ihmal', 'unuttun'];
		for (const streak of [0, 1, 5, 30]) {
			for (const due of [0, 5, 200]) {
				const m = buildMessage({ due, streak });
				const text = (m.title + ' ' + m.body).toLowerCase();
				for (const word of harsh) expect(text).not.toContain(word);
			}
		}
	});
});

describe('parseTime / formatTime', () => {
	it('geçerli saati ayrıştırır', () => {
		expect(parseTime('20:00')).toEqual({ hour: 20, minute: 0 });
		expect(parseTime('7:05')).toEqual({ hour: 7, minute: 5 });
		expect(parseTime('  23:59  ')).toEqual({ hour: 23, minute: 59 });
	});

	it('geçersiz saatte null döner', () => {
		expect(parseTime('24:00')).toBeNull();
		expect(parseTime('12:60')).toBeNull();
		expect(parseTime('abc')).toBeNull();
		expect(parseTime('')).toBeNull();
		expect(parseTime(null)).toBeNull();
	});

	it('saati iki haneli biçimler', () => {
		expect(formatTime(9, 5)).toBe('09:05');
		expect(formatTime(20, 0)).toBe('20:00');
	});

	it('gidiş dönüş kayıpsız', () => {
		for (const t of ['00:00', '09:05', '13:30', '23:59']) {
			const p = parseTime(t);
			expect(formatTime(p.hour, p.minute)).toBe(t);
		}
	});
});
