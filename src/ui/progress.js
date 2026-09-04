/**
 * İlerleme paneli: XP seviyesi, haftalık hedef, beceri grafikleri,
 * rozetler.
 *
 * İstatistik ekranının BAŞINA ekleniyor, ayrı bir sekme açılmıyor:
 * altıncı bir sekme alt çubuğu 375 px ekranda okunmaz hâle getiriyor
 * ve bu içerik zaten "nasıl gidiyorum" sorusunun cevabı — istatistikle
 * aynı yerde durması doğru.
 */

import { el } from './dom.js';
import { progressRing, skillBars, xpBarChart } from './charts.js';
import { evaluateBadges } from '../core/badges.js';
import { levelProgress, xpSeries } from '../core/xp.js';
import { challengeStatus } from '../core/challenge.js';

/** Beceri sayaçlarını grafik girdisine çevirir. */
function skillRows(skills) {
	const s = skills || {};
	const tanim = [
		{ key: 'vocab', icon: '📚', name: 'Kelime' },
		{ key: 'grammar', icon: '📐', name: 'Dilbilgisi' },
		{ key: 'reading', icon: '📖', name: 'Okuma' },
		{ key: 'dialogue', icon: '💬', name: 'Diyalog' },
		{ key: 'speaking', icon: '🎤', name: 'Konuşma' }
	];
	return tanim.map((t) => ({
		icon: t.icon,
		name: t.name,
		correct: (s[t.key] && s[t.key].correct) || 0,
		total: (s[t.key] && s[t.key].total) || 0
	}));
}

/**
 * Paneli üretir; çağıran istediği yere yerleştirir.
 *
 * `sayimlar` dışarıdan geliyor (öğrenilen kelime, seri) çünkü bunlar
 * profilde değil, kelime havuzundan hesaplanıyor. Panelin havuzu
 * kendisi taraması `ui` katmanını veriye bağımlı yapardı.
 */
export function progressPanel(profile, sayimlar = {}, now = new Date()) {
	const p = profile || {};
	const xp = p.xp || { total: 0, byDay: {} };
	const seviye = levelProgress(xp.total);
	const hedef = challengeStatus(xp, p.challenge, now);

	const kok = el('div', { class: 'progressPanel' });

	// --- Seviye ve haftalık hedef ---
	const halkalar = el('div', { class: 'panel ringRow' }, [
		el('div', { class: 'ringBox' }, [
			progressRing(seviye.percent, { label: String(seviye.level), sub: 'seviye' }),
			el('div', { class: 'small', text: `${seviye.total} XP` }),
			el('div', { class: 'small', text: `Sonraki seviyeye ${seviye.remaining} XP` })
		]),
		el('div', { class: 'ringBox' }, [
			progressRing(hedef.percent, { label: '%' + hedef.percent, sub: 'hafta' }),
			el('div', { class: 'small', text: `${hedef.earned} / ${hedef.goal} XP` }),
			el('div', { class: 'small', text: hedef.done
				? '🎉 Bu haftanın hedefi tamam'
				: `${hedef.daysLeft} gün kaldı · günde ${hedef.perDay} XP` })
		])
	]);
	kok.appendChild(halkalar);

	// --- Günlük XP ---
	kok.appendChild(el('section', { class: 'panel' }, [
		el('h3', { text: '⚡ Son 7 gün' }),
		xpBarChart(xpSeries(xp, 7, now))
	]));

	// --- Beceriler ---
	const beceriler = skillRows(p.skills);
	kok.appendChild(el('section', { class: 'panel' }, [
		el('h3', { text: '🎯 Beceri başarı oranların' }),
		skillBars(beceriler),
		el('div', { class: 'small', text:
			'Oran, o becerideki denemelerin doğru olan yüzdesi. '
			+ 'Konuşma oranı söylenen kelimelerin tutturulmasını ölçer, '
			+ 'telaffuz kalitesini değil.' })
	]));

	// --- Rozetler ---
	const rozetler = evaluateBadges({
		reviewed: (p.skills && p.skills.vocab && p.skills.vocab.total) || 0,
		learned: sayimlar.learned || 0,
		streak: sayimlar.streak || 0,
		lessons: (p.lessonsDone || []).length,
		texts: (p.textsDone || []).length,
		tasks: (p.tasksDone || []).length,
		dialogues: (p.dialoguesDone || []).length,
		level: seviye.level,
		weeksDone: p.weeksDone || 0
	});
	const kazanilan = rozetler.filter((b) => b.earned).length;

	const izgara = el('div', { class: 'badgeGrid' });
	for (const b of rozetler) {
		izgara.appendChild(el('div', { class: 'badge2' + (b.earned ? ' badge2--on' : '') }, [
			el('span', { class: 'badge2Icon', text: b.icon }),
			el('span', { class: 'badge2Name', text: b.name }),
			el('span', { class: 'badge2Desc', text: b.earned || !b.need
				? b.desc
				: `${b.have} / ${b.need}` })
		]));
	}
	kok.appendChild(el('section', { class: 'panel' }, [
		el('h3', { text: `🏅 Rozetler (${kazanilan} / ${rozetler.length})` }),
		izgara
	]));

	return kok;
}
