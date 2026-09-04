/**
 * Rozetler.
 *
 * Her rozet SAF bir koşul: girdi olarak istatistik alır, boole döner.
 * Kazanılmış rozet listesi saklanmıyor — koşullar her seferinde
 * yeniden değerlendiriliyor. Sebep: saklanan liste ile gerçek durum
 * ayrışabiliyor (kullanıcı verisi göç ederse, bir sayaç düzeltilirse)
 * ve "kazandım ama görünmüyor" hatası kullanıcı için en can sıkıcı
 * olanı.
 *
 * Bunun bir bedeli var ve kabul edildi: geriye dönük hesaplanamayan
 * bir şey rozet olamaz. "Bir oturumda 20 kelime" gibi anlık koşullar
 * bu yüzden yok; hepsi birikimli sayaçlara dayanıyor.
 *
 * Saf mantık: depoya ve DOM'a dokunmaz.
 */

/**
 * Rozet tanımları.
 *
 * `test(stats)` doğru dönerse rozet kazanılmış sayılır. `progress`
 * varsa kilitli rozette "3 / 10" gibi ilerleme gösterilir — ne kadar
 * kaldığını göstermeyen kilitli rozet motive etmiyor, sinirlendiriyor.
 */
export const BADGES = [
	{
		id: 'ilk-adim', icon: '🌱', name: 'İlk adım',
		desc: 'İlk kelimeni çalıştın',
		test: (s) => s.reviewed >= 1,
		progress: (s) => ({ have: Math.min(s.reviewed, 1), need: 1 })
	},
	{
		id: 'yuz-kelime', icon: '💯', name: 'Yüz kelime',
		desc: '100 kelime çalıştın',
		test: (s) => s.reviewed >= 100,
		progress: (s) => ({ have: Math.min(s.reviewed, 100), need: 100 })
	},
	{
		id: 'bin-kelime', icon: '🏔️', name: 'Bin kelime',
		desc: '1000 kelime çalıştın',
		test: (s) => s.reviewed >= 1000,
		progress: (s) => ({ have: Math.min(s.reviewed, 1000), need: 1000 })
	},
	{
		id: 'ogrenilmis-50', icon: '🎓', name: 'Elli mezun',
		desc: '50 kelimeyi öğrenilmiş seviyeye taşıdın',
		test: (s) => s.learned >= 50,
		progress: (s) => ({ have: Math.min(s.learned, 50), need: 50 })
	},
	{
		id: 'seri-7', icon: '🔥', name: 'Bir hafta',
		desc: '7 gün üst üste çalıştın',
		test: (s) => s.streak >= 7,
		progress: (s) => ({ have: Math.min(s.streak, 7), need: 7 })
	},
	{
		id: 'seri-30', icon: '🏆', name: 'Bir ay',
		desc: '30 gün üst üste çalıştın',
		test: (s) => s.streak >= 30,
		progress: (s) => ({ have: Math.min(s.streak, 30), need: 30 })
	},
	{
		id: 'dilbilgisi-5', icon: '📐', name: 'Kurallar oturdu',
		desc: '5 dilbilgisi dersini geçtin',
		test: (s) => s.lessons >= 5,
		progress: (s) => ({ have: Math.min(s.lessons, 5), need: 5 })
	},
	{
		id: 'okuma-5', icon: '📖', name: 'Okur',
		desc: '5 okuma parçasını anladın',
		test: (s) => s.texts >= 5,
		progress: (s) => ({ have: Math.min(s.texts, 5), need: 5 })
	},
	{
		id: 'yazma-3', icon: '✍️', name: 'Kalem tuttu',
		desc: '3 yazma görevini tamamladın',
		test: (s) => s.tasks >= 3,
		progress: (s) => ({ have: Math.min(s.tasks, 3), need: 3 })
	},
	{
		id: 'diyalog-10', icon: '💬', name: 'Sohbetçi',
		desc: '10 diyalog tamamladın',
		test: (s) => s.dialogues >= 10,
		progress: (s) => ({ have: Math.min(s.dialogues, 10), need: 10 })
	},
	{
		id: 'seviye-10', icon: '⭐', name: 'Onuncu seviye',
		desc: 'XP seviyende 10\'a ulaştın',
		test: (s) => s.level >= 10,
		progress: (s) => ({ have: Math.min(s.level, 10), need: 10 })
	},
	{
		id: 'hedef-3', icon: '🎯', name: 'Üç hafta üst üste',
		desc: '3 haftalık hedefi tamamladın',
		test: (s) => s.weeksDone >= 3,
		progress: (s) => ({ have: Math.min(s.weeksDone, 3), need: 3 })
	}
];

/** Eksik alanları sıfırlar; bozuk girdide koşullar patlamasın. */
function normalize(stats) {
	const s = stats || {};
	return {
		reviewed: Number(s.reviewed) || 0,
		learned: Number(s.learned) || 0,
		streak: Number(s.streak) || 0,
		lessons: Number(s.lessons) || 0,
		texts: Number(s.texts) || 0,
		tasks: Number(s.tasks) || 0,
		dialogues: Number(s.dialogues) || 0,
		level: Number(s.level) || 1,
		weeksDone: Number(s.weeksDone) || 0
	};
}

/** Tüm rozetlerin durumu. */
export function evaluateBadges(stats) {
	const s = normalize(stats);
	return BADGES.map((b) => {
		const kazanildi = !!b.test(s);
		const p = b.progress ? b.progress(s) : null;
		return {
			id: b.id,
			icon: b.icon,
			name: b.name,
			desc: b.desc,
			earned: kazanildi,
			have: p ? p.have : 0,
			need: p ? p.need : 0
		};
	});
}

/** Kazanılan rozet sayısı. */
export function earnedCount(stats) {
	return evaluateBadges(stats).filter((b) => b.earned).length;
}

/**
 * Sıradaki en yakın rozet.
 *
 * Ana ekranda tek bir hedef göstermek için: on iki kilitli rozet
 * göstermek yerine "bir tanesine 3 kaldı" demek işe yarıyor.
 */
export function nextBadge(stats) {
	const kilitli = evaluateBadges(stats).filter((b) => !b.earned && b.need > 0);
	if (!kilitli.length) return null;
	return kilitli.sort((a, b) => (b.have / b.need) - (a.have / a.need))[0];
}
