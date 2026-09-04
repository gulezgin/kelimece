/**
 * Haftalık hedef.
 *
 * Hedef sabit değil, kullanıcının KENDİ geçmişinden türetiliyor.
 * Herkese aynı sayıyı vermek iki yönden de bozuk: günde beş dakika
 * çalışan biri için ulaşılamaz olup vazgeçirir, çok çalışan biri için
 * salı günü biter ve haftanın kalanı anlamsızlaşır.
 *
 * Kural, geçen haftanın biraz üstü ama sert değil. İyi bir haftadan
 * sonra hedefin fırlaması, hastalanınca ya da tatile çıkınca seriyi
 * imkânsız kılıyor; bu yüzden artış oranlı ve tavanlı.
 *
 * Saf mantık: depoya ve DOM'a dokunmaz.
 */

import { dayKey, weekStart, weekTotal } from './xp.js';

/** Hiç geçmişi olmayan kullanıcı için başlangıç hedefi. */
export const STARTER_GOAL = 300;
/** Hedefin inebileceği en düşük değer. */
export const MIN_GOAL = 150;
/** Hedefin çıkabileceği en yüksek değer. */
export const MAX_GOAL = 3000;
/** Geçen haftanın üstüne eklenen oran. */
export const GROWTH = 1.1;

/** Bir önceki haftanın toplamı. */
function previousWeekTotal(xpState, now) {
	const gecen = weekStart(now);
	gecen.setDate(gecen.getDate() - 7);
	return weekTotal(xpState, gecen);
}

/**
 * Bu haftanın hedefini hesaplar.
 *
 * `saved` varsa ve aynı haftaya aitse korunur: hafta ortasında hedefin
 * değişmesi ilerlemeyi anlamsız kılar.
 */
export function weeklyGoal(xpState, saved = null, now = new Date()) {
	const buHafta = dayKey(weekStart(now));
	if (saved && saved.week === buHafta && Number(saved.goal) > 0) {
		return { week: buHafta, goal: Math.round(saved.goal), carried: true };
	}

	const gecen = previousWeekTotal(xpState, now);
	const ham = gecen > 0 ? gecen * GROWTH : STARTER_GOAL;
	// 50'nin katina yuvarlaniyor: "487 XP" gibi bir hedef rastgele
	// gorunuyor ve akilda kalmiyor.
	const yuvarlak = Math.round(ham / 50) * 50;
	return {
		week: buHafta,
		goal: Math.min(MAX_GOAL, Math.max(MIN_GOAL, yuvarlak)),
		carried: false
	};
}

/**
 * Haftalık durum: hedef, ilerleme, kalan gün.
 */
export function challengeStatus(xpState, saved = null, now = new Date()) {
	const hedef = weeklyGoal(xpState, saved, now);
	const kazanilan = weekTotal(xpState, now);
	// Pazartesi 1, pazar 7 -> kalan gun (bugun dahil).
	const gunIndex = (new Date(now).getDay() + 6) % 7;
	const kalanGun = 7 - gunIndex;

	return {
		week: hedef.week,
		goal: hedef.goal,
		earned: kazanilan,
		remaining: Math.max(0, hedef.goal - kazanilan),
		percent: hedef.goal ? Math.min(100, Math.round((kazanilan / hedef.goal) * 100)) : 0,
		done: kazanilan >= hedef.goal,
		daysLeft: kalanGun,
		// Hedefe yetismek icin gunluk gereken; kullanicinin sorabilecegi
		// tek pratik soru bu.
		perDay: kalanGun > 0 ? Math.ceil(Math.max(0, hedef.goal - kazanilan) / kalanGun) : 0
	};
}

/**
 * Kaydedilecek hafta kaydı.
 *
 * Hedef bir kez hesaplanıp saklanıyor; her açılışta yeniden hesaplamak
 * hafta içinde geçen haftanın verisi budandığında hedefi kaydırırdı.
 */
export function challengeRecord(xpState, saved = null, now = new Date()) {
	const h = weeklyGoal(xpState, saved, now);
	return { week: h.week, goal: h.goal };
}
