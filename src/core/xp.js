/**
 * XP ve seviye.
 *
 * XP'nin tek işlevi var: kullanıcıya "bugün bir şey yaptım" diyebilmek.
 * Öğrenmeyi ÖLÇMÜYOR — onu SM-2 aralıkları ölçüyor. İkisini karıştırmak
 * tehlikeli olurdu: XP'yi öğrenme göstergesi gibi sunmak, kolay
 * alıştırmayı tekrarlayarak "ilerleme" üretmeyi teşvik eder.
 *
 * Bu yüzden yanlış cevap da XP veriyor (daha az). Yalnızca doğruyu
 * ödüllendirmek, kullanıcıyı bildiği kelimeleri tekrar etmeye ve
 * bilmediklerinden kaçınmaya iter — aralıklı tekrarın tam tersi.
 *
 * Saf mantık: depoya ve DOM'a dokunmaz.
 */

/** XP kaynakları ve değerleri. */
export const XP = {
	/** Tekrarda doğru cevap. */
	REVIEW_OK: 10,
	/** Tekrarda yanlış cevap — çaba da sayılır. */
	REVIEW_FAIL: 3,
	/** Diyalog rol yapma tamamlandı. */
	DIALOGUE: 30,
	/** Dilbilgisi dersi quizi geçildi. */
	GRAMMAR: 50,
	/** Okuma parçası anlaşıldı. */
	READING: 50,
	/** Yazma / e-posta görevi tamamlandı. */
	WRITING: 60,
	/** Zıt anlamlı turu bitti. */
	ANTONYM_ROUND: 20,
	/** Seviye testi tamamlandı. */
	PLACEMENT: 40
};

/**
 * Bir seviyeye ulaşmak için gereken toplam XP.
 *
 * Artan maliyet: her seviye bir öncekinden 100 XP fazla istiyor.
 * Sabit maliyet, ilerlemeyi yüzüncü seviyede de aynı hızda gösterip
 * sayıyı anlamsızlaştırırdı.
 */
export function xpForLevel(level) {
	const l = Math.max(1, Math.floor(level || 1));
	return 50 * l * (l - 1);
}

/** Toplam XP'den seviye. */
export function levelFromXp(xp) {
	const t = Math.max(0, Number(xp) || 0);
	// 50*L*(L-1) <= t  ->  L = floor((1 + sqrt(1 + 4t/50)) / 2)
	return Math.max(1, Math.floor((1 + Math.sqrt(1 + (4 * t) / 50)) / 2));
}

/** Seviye ilerlemesi: mevcut seviye, sonraki eşik ve yüzde. */
export function levelProgress(xp) {
	const total = Math.max(0, Number(xp) || 0);
	const level = levelFromXp(total);
	const basamak = xpForLevel(level);
	const sonraki = xpForLevel(level + 1);
	const araVerilen = total - basamak;
	const araGereken = sonraki - basamak;
	return {
		level,
		total,
		into: araVerilen,
		need: araGereken,
		remaining: sonraki - total,
		percent: araGereken ? Math.min(100, Math.round((araVerilen / araGereken) * 100)) : 0
	};
}

/** YYYY-AA-GG. */
export function dayKey(date = new Date()) {
	const d = date instanceof Date ? date : new Date(date);
	const ay = String(d.getMonth() + 1).padStart(2, '0');
	const gun = String(d.getDate()).padStart(2, '0');
	return `${d.getFullYear()}-${ay}-${gun}`;
}

/**
 * Günlük kayıtları budar.
 *
 * Sınır olmadan `byDay` her gün büyüyor ve profil bir yıl sonra
 * gereksiz yere şişiyor. 120 gün, en uzun grafikten (90 gün) fazlası.
 */
export const KEEP_DAYS = 120;

export function pruneDays(byDay, now = new Date()) {
	const sinir = new Date(now);
	sinir.setDate(sinir.getDate() - KEEP_DAYS);
	const esik = dayKey(sinir);
	const out = {};
	for (const [k, v] of Object.entries(byDay || {})) {
		if (k >= esik) out[k] = v;
	}
	return out;
}

/**
 * XP ekler.
 *
 * Saf: yeni bir nesne döndürür, girdiyi değiştirmez.
 */
export function addXp(state, amount, now = new Date()) {
	const miktar = Math.max(0, Math.round(Number(amount) || 0));
	const mevcut = state && typeof state === 'object' ? state : {};
	const byDay = { ...(mevcut.byDay || {}) };
	if (miktar) {
		const k = dayKey(now);
		byDay[k] = (byDay[k] || 0) + miktar;
	}
	return {
		total: Math.max(0, Number(mevcut.total) || 0) + miktar,
		byDay: pruneDays(byDay, now)
	};
}

/** Belirli bir günün XP'si. */
export function xpOnDay(state, date = new Date()) {
	return ((state && state.byDay) || {})[dayKey(date)] || 0;
}

/**
 * Son n günün XP dizisi — grafik için.
 *
 * Boş günler 0 ile dolduruluyor; yalnızca çalışılan günleri çizmek
 * grafiği yalancı biçimde düz gösterirdi.
 */
export function xpSeries(state, days = 7, now = new Date()) {
	const n = Math.max(1, Math.floor(days));
	const byDay = (state && state.byDay) || {};
	const out = [];
	for (let i = n - 1; i >= 0; i--) {
		const d = new Date(now);
		d.setDate(d.getDate() - i);
		const k = dayKey(d);
		out.push({ day: k, xp: byDay[k] || 0 });
	}
	return out;
}

/** Haftanın başlangıcı (pazartesi). */
export function weekStart(date = new Date()) {
	const d = new Date(date);
	d.setHours(0, 0, 0, 0);
	// getDay(): 0 pazar. Pazartesi baslangic icin pazari 6 gun geri al.
	const kaydir = (d.getDay() + 6) % 7;
	d.setDate(d.getDate() - kaydir);
	return d;
}

/** Bir haftanın toplam XP'si. */
export function weekTotal(state, date = new Date()) {
	const bas = weekStart(date);
	const byDay = (state && state.byDay) || {};
	let toplam = 0;
	for (let i = 0; i < 7; i++) {
		const d = new Date(bas);
		d.setDate(d.getDate() + i);
		toplam += byDay[dayKey(d)] || 0;
	}
	return toplam;
}
