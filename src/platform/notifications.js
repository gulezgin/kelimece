/**
 * Günlük çalışma hatırlatması.
 *
 * Neden önemli: aralıklı tekrarın işe yaraması için kullanıcının
 * zamanı geldiğinde uygulamaya dönmesi gerekiyor. Hatırlatma olmadan
 * en iyi algoritma bile boşa çalışır — kullanıcı unutur, kelimeler
 * birikir, geri dönmek yıldırıcı hâle gelir.
 *
 * İki ortam:
 *   Android (Capacitor) — LocalNotifications, uygulama kapalıyken de çalışır
 *   Tarayıcı            — Notification API, yalnızca sekme açıkken güvenilir
 *
 * Her iki ortamda da izin ZORUNLU olarak kullanıcıdan istenir ve
 * reddedilirse sessizce devre dışı kalır; hiçbir yerde ısrar edilmez.
 */

const NOTIFICATION_ID = 1001;

let plugin = null;
let pluginChecked = false;

/** Capacitor eklentisi var mı? (Tarayıcıda yok.) */
async function getPlugin() {
	if (pluginChecked) return plugin;
	pluginChecked = true;
	try {
		const core = await import('@capacitor/core');
		if (!core.Capacitor?.isNativePlatform?.()) return null;
		const mod = await import('@capacitor/local-notifications');
		plugin = mod.LocalNotifications;
	} catch {
		plugin = null;
	}
	return plugin;
}

/** Bu ortamda hatırlatma kurulabilir mi? */
export async function isSupported() {
	if (await getPlugin()) return true;
	return typeof Notification !== 'undefined';
}

/**
 * İzin ister.
 * @returns {Promise<boolean>} İzin verildi mi
 */
export async function requestPermission() {
	const p = await getPlugin();
	if (p) {
		try {
			const result = await p.requestPermissions();
			return result.display === 'granted';
		} catch {
			return false;
		}
	}

	if (typeof Notification === 'undefined') return false;
	try {
		const result = await Notification.requestPermission();
		return result === 'granted';
	} catch {
		return false;
	}
}

/** İzin durumunu sorar, istemez. */
export async function hasPermission() {
	const p = await getPlugin();
	if (p) {
		try {
			return (await p.checkPermissions()).display === 'granted';
		} catch {
			return false;
		}
	}
	return typeof Notification !== 'undefined' && Notification.permission === 'granted';
}

/**
 * Hatırlatma metnini duruma göre seçer.
 *
 * Suçlayıcı ya da baskıcı bir dil kullanılmıyor: "serini kaybettin"
 * değil, "seni bekliyor". Baskı kısa vadede tıklatır, uzun vadede
 * uygulamayı sildirir.
 */
export function buildMessage({ due = 0, streak = 0 } = {}) {
	if (due > 0 && streak > 1) {
		return {
			title: `${streak} günlük serin sürüyor`,
			body: `Bugün tekrar zamanı gelen ${due} kelime var. Birkaç dakika yeter.`
		};
	}
	if (due > 0) {
		return {
			title: 'Tekrar zamanı',
			body: `${due} kelime seni bekliyor.`
		};
	}
	if (streak > 1) {
		return {
			title: `${streak} günlük serin sürüyor`,
			body: 'Bugün birkaç yeni kelime öğrenmeye ne dersin?'
		};
	}
	return {
		title: 'Kelime Havuzum',
		body: 'Bugün birkaç kelime çalışmaya ne dersin?'
	};
}

/**
 * Günlük tekrarlayan hatırlatmayı kurar.
 * Var olan hatırlatmayı önce iptal eder — çift bildirim olmasın.
 *
 * @param {{hour: number, minute: number, due?: number, streak?: number}} options
 * @returns {Promise<boolean>} Kurulabildi mi
 */
export async function scheduleDaily({ hour, minute, due = 0, streak = 0 }) {
	if (!(await hasPermission())) return false;

	const { title, body } = buildMessage({ due, streak });
	const p = await getPlugin();

	if (p) {
		try {
			await cancelAll();
			await p.schedule({
				notifications: [{
					id: NOTIFICATION_ID,
					title,
					body,
					// Her gün aynı saatte
					schedule: { on: { hour, minute }, allowWhileIdle: true },
					smallIcon: 'ic_stat_icon_config_sample'
				}]
			});
			return true;
		} catch {
			return false;
		}
	}

	// Tarayıcıda gerçek zamanlama yok; sayfa açıkken çalışan bir
	// zamanlayıcı kuruluyor. Sekme kapanınca düşer - bu yüzden web
	// sürümünde hatırlatma "en iyi çaba" düzeyinde.
	scheduleBrowserFallback(hour, minute, title, body);
	return true;
}

let browserTimer = null;

function scheduleBrowserFallback(hour, minute, title, body) {
	if (browserTimer) clearTimeout(browserTimer);

	const now = new Date();
	const target = new Date(now);
	target.setHours(hour, minute, 0, 0);
	if (target <= now) target.setDate(target.getDate() + 1);

	browserTimer = setTimeout(() => {
		try {
			new Notification(title, { body, icon: './icons/icon-192.png', tag: 'daily' });
		} catch {
			// yoksay
		}
		scheduleBrowserFallback(hour, minute, title, body);
	}, target.getTime() - now.getTime());
}

/** Kurulu tüm hatırlatmaları iptal eder. */
export async function cancelAll() {
	if (browserTimer) {
		clearTimeout(browserTimer);
		browserTimer = null;
	}
	const p = await getPlugin();
	if (!p) return;
	try {
		const pending = await p.getPending();
		if (pending.notifications?.length) {
			await p.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
		}
	} catch {
		// yoksay
	}
}

/** "HH:MM" -> {hour, minute} */
export function parseTime(value) {
	const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || '').trim());
	if (!match) return null;
	const hour = Number(match[1]);
	const minute = Number(match[2]);
	if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
	return { hour, minute };
}

/** {hour, minute} -> "HH:MM" */
export function formatTime(hour, minute) {
	return String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0');
}
