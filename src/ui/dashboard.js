/**
 * Ana ekran: seviye, günlük durum ve çalışmaya başlama noktası.
 *
 * Uygulamanın ilk açılışta gösterdiği ekran. Kelime listesi bir araç;
 * ana ekran ise "bugün ne yapmalıyım" sorusunu cevaplar.
 */
import { CEFR_ORDER } from '../core/placement.js';
import { $, el } from './dom.js';

/**
 * @param {object} overview store.getOverview() çıktısı
 * @param {object} breakdown seviye başına dağılım
 * @param {{onStart: Function, onPlacement: Function, onPickLevel: Function, onBrowse: Function}} handlers
 */
export function renderDashboard(overview, breakdown, handlers) {
	const host = $('homeView');
	if (!host) return;
	host.textContent = '';

	host.appendChild(heroSection(overview, handlers));
	host.appendChild(statsRow(overview));
	host.appendChild(levelProgress(breakdown, overview.level, handlers));
}

/** Üst blok: seviye, bugünün durumu, başlat düğmesi. */
function heroSection(o, handlers) {
	const hasLevel = !!o.level;

	const title = el('div', { class: 'heroTitle' }, [
		el('span', { text: hasLevel ? 'Seviyen: ' : 'Hoş geldin' }),
		hasLevel ? el('span', { class: 'cefr cefr--' + o.level, text: o.level }) : null
	]);

	const subtitle = el('div', { class: 'heroSubtitle' });
	const s = o.session || { total: 0, reviews: 0, fresh: 0, freshAvailable: 0 };
	if (!hasLevel) {
		subtitle.textContent = 'Nereden başlayacağını bilmiyorsan kısa bir testle seviyeni ölçelim.';
	} else if (s.total > 0) {
		// Tekrar ile yeni kelimeyi ayri soylemek, oturumun neye
		// benzeyecegini onceden gosteriyor.
		const parts = [];
		if (s.reviews) parts.push(`${s.reviews} tekrar`);
		if (s.fresh) parts.push(`${s.fresh} yeni kelime`);
		subtitle.textContent = 'Bugünkü oturumun: ' + parts.join(' + ') + '.';
	} else if (o.untouched > 0) {
		subtitle.textContent = `Bugünlük tekrar bitti. ${o.untouched} yeni kelime seni bekliyor.`;
	} else {
		subtitle.textContent = 'Bu seviyedeki her şeyi öğrendin. Bir üst seviyeye geçebilirsin.';
	}

	const actions = el('div', { class: 'heroActions' });

	const session = o.session || { total: o.due, reviews: 0, fresh: 0 };
	const startBtn = el('button', {
		class: 'primary heroStart',
		text: session.total > 0 ? `Çalışmaya başla (${session.total})` : 'Yeni kelimelerle çalış'
	});
	startBtn.onclick = () => handlers.onStart(session.total > 0 ? 'due' : 'new');
	actions.appendChild(startBtn);

	const placeBtn = el('button', {
		class: hasLevel ? 'ghost' : 'primary',
		text: hasLevel ? 'Seviyeni yeniden ölç' : '🎯 Seviyeni ölç'
	});
	placeBtn.onclick = () => handlers.onPlacement();
	actions.appendChild(placeBtn);

	const browseBtn = el('button', { class: 'ghost', text: 'Kelime havuzu' });
	browseBtn.onclick = () => handlers.onBrowse();
	actions.appendChild(browseBtn);

	return el('section', { class: 'panel hero' }, [title, subtitle, actions]);
}

/** Günlük hedef, seri ve genel ilerleme. */
function statsRow(o) {
	const goalPct = o.dailyGoal ? Math.min(100, Math.round((o.studiedToday / o.dailyGoal) * 100)) : 0;
	const s = o.session || { total: o.due, reviews: 0, fresh: 0, freshAvailable: 0 };

	// Ham "bekleyen kelime" sayısı 5000'i geçebiliyor ve yıldırıcı
	// görünüyor. Kartta bugünkü oturumun uzunluğu gösteriliyor;
	// havuzun tamamı alt satırda bilgi olarak kalıyor.
	const sessionNote = s.total > 0
		? (s.reviews ? `${s.reviews} tekrar + ${s.fresh} yeni` : `${s.fresh} yeni kelime`)
		: 'bugünlük bitti';

	return el('section', { class: 'statCards' }, [
		statCard('🔥', 'Seri', o.streak > 0 ? `${o.streak} gün` : 'Henüz yok',
			o.longestStreak > o.streak ? `En uzun: ${o.longestStreak} gün` : ''),
		statCard('📅', 'Bugün', `${o.studiedToday} / ${o.dailyGoal}`, `%${goalPct} tamamlandı`, goalPct),
		statCard('📚', 'Öğrenilen', `${o.learned} / ${o.total}`, `%${o.percent}`, o.percent),
		statCard('⏰', 'Bugünkü oturum', String(s.total), sessionNote)
	]);
}

function statCard(icon, label, value, note, percent) {
	const children = [
		el('div', { class: 'statIcon', text: icon }),
		el('div', { class: 'statLabel', text: label }),
		el('div', { class: 'statValue', text: value })
	];
	if (note) children.push(el('div', { class: 'statNote', text: note }));
	if (typeof percent === 'number') {
		children.push(el('div', { class: 'miniBar' }, [
			el('div', { class: 'miniBarFill' })
		]));
	}
	const card = el('div', { class: 'statCard' }, children);
	if (typeof percent === 'number') {
		card.querySelector('.miniBarFill').style.width = Math.min(100, percent) + '%';
	}
	return card;
}

/** Seviye seviye ilerleme çubukları. */
function levelProgress(breakdown, activeLevel, handlers) {
	const rows = el('div', { class: 'levelRows' });

	for (const level of CEFR_ORDER) {
		const b = breakdown[level];
		if (!b || !b.total) continue;

		const pct = Math.round((b.learned / b.total) * 100);
		const fill = el('div', { class: 'levelRowFill' });

		const row = el('button', {
			class: 'levelRow' + (level === activeLevel ? ' levelRow--active' : ''),
			title: `${level} seviyesini çalış`
		}, [
			el('span', { class: 'cefr cefr--' + level, text: level }),
			el('div', { class: 'levelRowBar' }, [fill]),
			el('span', { class: 'levelRowNum', text: `${b.learned}/${b.total}` }),
			el('span', { class: 'levelRowPct', text: `%${pct}` })
		]);
		fill.style.width = pct + '%';
		row.onclick = () => handlers.onPickLevel(level);
		rows.appendChild(row);
	}

	return el('section', { class: 'panel' }, [
		el('h2', { text: '📈 Seviye ilerlemen' }),
		el('div', { class: 'small', text: 'Bir seviyeye tıklayarak doğrudan onu çalışabilirsin.' }),
		rows
	]);
}
