/**
 * Bulut eşitleme: birleştirme mantığı.
 *
 * ANA RİSK BURADA. İki cihazda çalışan bir kullanıcının ilerlemesi
 * yanlış birleştirilirse, aylarca biriktirilmiş tekrar takvimi
 * SESSİZCE bozulur — kullanıcı bunu ancak yanlış kelimeler karşısına
 * çıkmaya başlayınca, geri dönüşü olmayan bir noktada fark eder.
 *
 * Bu yüzden birleştirme "son yazan kazanır" DEĞİL. Tek yönlü bir
 * gerçeğe dayanıyor: çalışma geri alınamaz. Bir kelimeyi 10 kez
 * çalıştıysan, o kayıt 3 kez çalışılmış olandan daha günceldir —
 * hangi cihazda ne zaman yazıldığından bağımsız olarak.
 *
 * Saf mantık: ağa, DOM'a ve depoya dokunmaz.
 */

/** Bir kaydın kaç kez çalışıldığı. */
function historyLength(record) {
	const h = record && record.history;
	return Array.isArray(h) ? h.length : 0;
}

/** Son çalışma anı (ISO). Geçmiş boşsa null. */
function lastStudiedAt(record) {
	const h = (record && record.history) || [];
	if (!h.length) return null;
	const son = h[h.length - 1];
	return (son && (son.date || son.at)) || null;
}

/**
 * Kayıt eşitlenmeye değer mi?
 *
 * Paket 5276 kelime kuruyor ve hepsinin bir ilerleme kaydı var; hepsini
 * göndermek kullanıcı başına ~1 MB demek. Dokunulmamış kayıt bilgi
 * taşımıyor: karşı tarafta zaten aynısı var.
 */
export function isWorthSyncing(record) {
	if (!record) return false;
	return historyLength(record) > 0
		|| Number(record.level) > 0
		|| record.learnedManually === true;
}

/**
 * İki ilerleme kaydını birleştirir.
 *
 * @returns {{record: object, winner: 'local'|'remote'|'equal'}}
 */
export function mergeProgress(local, remote) {
	if (!local && !remote) return { record: null, winner: 'equal' };
	if (!local) return { record: remote, winner: 'remote' };
	if (!remote) return { record: local, winner: 'local' };

	const yerelSayi = historyLength(local);
	const uzakSayi = historyLength(remote);

	// 1) Daha çok çalışılan kazanır. Çalışma geri alınamaz.
	if (yerelSayi !== uzakSayi) {
		return yerelSayi > uzakSayi
			? { record: local, winner: 'local' }
			: { record: remote, winner: 'remote' };
	}

	// 2) Eşitse son çalışma anı daha yeni olan kazanır.
	const yerelAn = lastStudiedAt(local);
	const uzakAn = lastStudiedAt(remote);
	if (yerelAn && uzakAn && yerelAn !== uzakAn) {
		return yerelAn > uzakAn
			? { record: local, winner: 'local' }
			: { record: remote, winner: 'remote' };
	}

	// 3) Hiç çalışılmamışsa "elle öğrenildi" işareti bilgi taşıyor.
	if (yerelSayi === 0 && local.learnedManually !== remote.learnedManually) {
		return local.learnedManually
			? { record: local, winner: 'local' }
			: { record: remote, winner: 'remote' };
	}

	// 4) Ayırt edilemiyor: yereli tut, gereksiz yazma yapma.
	return { record: local, winner: 'equal' };
}

/**
 * Yerel ve uzak ilerleme listelerini birleştirir.
 *
 * @param {object[]} local
 * @param {object[]} remote
 * @returns {{merged: object[], toUpload: object[], toApply: object[], stats: object}}
 *   merged   birleşmiş tam liste
 *   toUpload uzak tarafa yazılması gerekenler
 *   toApply  yerele uygulanması gerekenler
 */
export function mergeProgressLists(local, remote) {
	const yerel = new Map();
	for (const r of local || []) if (r && r.wordId) yerel.set(r.wordId, r);
	const uzak = new Map();
	for (const r of remote || []) if (r && r.wordId) uzak.set(r.wordId, r);

	const merged = [];
	const toUpload = [];
	const toApply = [];
	let ayni = 0;

	for (const id of new Set([...yerel.keys(), ...uzak.keys()])) {
		const l = yerel.get(id) || null;
		const u = uzak.get(id) || null;
		const { record, winner } = mergeProgress(l, u);
		if (!record) continue;
		merged.push(record);

		if (winner === 'local') {
			// Uzakta yok ya da geride: yalnizca gonderilmeye deger
			// kayitlari gonder, bos kayitlarla kotayi doldurma.
			if (isWorthSyncing(record)) toUpload.push(record);
		} else if (winner === 'remote') {
			toApply.push(record);
		} else {
			ayni++;
		}
	}

	return {
		merged,
		toUpload,
		toApply,
		stats: {
			yerel: yerel.size,
			uzak: uzak.size,
			gonderilecek: toUpload.length,
			uygulanacak: toApply.length,
			degismeyen: ayni
		}
	};
}

/**
 * Profil bilgilerini birleştirir.
 *
 * Alanların birleşme kuralı farklı, çünkü anlamları farklı:
 *  - seri sayaçları: en büyük kazanır (geri gitmemeli)
 *  - seviye: en son ölçüm kazanır
 *  - bugünkü sayaç: yalnızca aynı güne aitse anlamlı
 *  - profil (ad/e-posta): en son düzenlenen kazanır
 */
export function mergeProfile(local, remote) {
	const l = local || {};
	const u = remote || {};
	if (!remote) return { ...l };

	const sonOlcum = (a, b) => {
		if (!a.placedAt) return b;
		if (!b.placedAt) return a;
		return a.placedAt >= b.placedAt ? a : b;
	};
	const seviyeKaynagi = sonOlcum(l, u);

	// Bugunku sayac yalnizca ayni gune aitse karsilastirilabilir.
	let lastStudyDate = l.lastStudyDate;
	let studiedToday = Number(l.studiedToday) || 0;
	if (u.lastStudyDate && (!lastStudyDate || u.lastStudyDate > lastStudyDate)) {
		lastStudyDate = u.lastStudyDate;
		studiedToday = Number(u.studiedToday) || 0;
	} else if (u.lastStudyDate === lastStudyDate) {
		studiedToday = Math.max(studiedToday, Number(u.studiedToday) || 0);
	}

	return {
		...l,
		level: seviyeKaynagi.level ?? null,
		placedAt: seviyeKaynagi.placedAt ?? null,
		streak: Math.max(Number(l.streak) || 0, Number(u.streak) || 0),
		longestStreak: Math.max(Number(l.longestStreak) || 0, Number(u.longestStreak) || 0),
		lastStudyDate,
		studiedToday
	};
}
