/**
 * İstatistik ekranı.
 *
 * Grafikler saf SVG ile çiziliyor — 2500 kelimelik veri için grafik
 * kütüphanesi eklemek paket boyutunu iki katına çıkarırdı.
 */
import {
	dailyActivity,
	estimatedVocabulary,
	hardestWords,
	maturityBreakdown,
	recallRate,
	studyHistory,
	upcomingLoad
} from '../core/stats.js';
import { $, el } from './dom.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** SVG elemanı oluşturur (el() HTML ad alanı kullanıyor). */
function svg(tag, attrs = {}) {
	const node = document.createElementNS(SVG_NS, tag);
	for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
	return node;
}

/**
 * @param {object[]} words Kapsamdaki kelimeler
 * @param {object} profile store.state.profile
 */
export function renderStatsView(words, profile) {
	const host = $('statsView');
	if (!host) return;
	host.textContent = '';

	if (!words.length) {
		host.appendChild(el('section', { class: 'panel' }, [
			el('div', { class: 'small', text: 'Henüz gösterilecek veri yok.' })
		]));
		return;
	}

	host.appendChild(summaryCards(words, profile));
	host.appendChild(activityChart(words));
	host.appendChild(maturitySection(words));
	host.appendChild(upcomingSection(words));

	const hard = hardestWords(words, { limit: 8 });
	if (hard.length) host.appendChild(hardestSection(hard));
}

/** Üst özet: hatırlama oranı, tahmini hazine, çalışılan gün. */
function summaryCards(words, profile) {
	const all = recallRate(words);
	const recent = recallRate(words, { sinceDays: 30 });
	const history = studyHistory(words);
	const vocab = estimatedVocabulary(words);

	return el('section', { class: 'statCards' }, [
		bigCard('🎯', 'Hatırlama oranı', all.total ? `%${Math.round(all.rate * 100)}` : '—',
			all.total ? `${all.correct} / ${all.total} cevap` : 'Henüz cevap yok'),
		bigCard('📈', 'Son 30 gün', recent.total ? `%${Math.round(recent.rate * 100)}` : '—',
			recent.total ? `${recent.total} cevap` : 'Bu ay çalışılmadı'),
		bigCard('🧠', 'Tahmini hazine', `~${vocab}`, 'kelime'),
		bigCard('📆', 'Çalışılan gün', String(history.activeDays),
			history.longestStreak ? `En uzun seri: ${history.longestStreak} gün` : '')
	]);
}

function bigCard(icon, label, value, note) {
	return el('div', { class: 'statCard' }, [
		el('div', { class: 'statIcon', text: icon }),
		el('div', { class: 'statLabel', text: label }),
		el('div', { class: 'statValue', text: value }),
		note ? el('div', { class: 'statNote', text: note }) : null
	]);
}

/** Son 30 günün günlük cevap sayısı - sütun grafiği. */
function activityChart(words) {
	const rows = dailyActivity(words, { days: 30 });
	const max = Math.max(1, ...rows.map((r) => r.total));
	const width = 100;
	const height = 40;
	const gap = 0.6;
	const barWidth = width / rows.length - gap;

	const chart = svg('svg', {
		viewBox: `0 0 ${width} ${height}`,
		class: 'chart',
		preserveAspectRatio: 'none',
		role: 'img',
		'aria-label': 'Son 30 günün günlük cevap sayısı'
	});

	rows.forEach((row, i) => {
		const h = row.total ? Math.max(1.2, (row.total / max) * (height - 2)) : 0.6;
		const x = i * (barWidth + gap);
		const bar = svg('rect', {
			x: x.toFixed(2),
			y: (height - h).toFixed(2),
			width: barWidth.toFixed(2),
			height: h.toFixed(2),
			rx: 0.6,
			class: row.total ? 'chartBar' : 'chartBar chartBar--empty'
		});
		bar.appendChild(svg('title', {})).textContent =
			`${row.date.toLocaleDateString('tr-TR')}: ${row.total} cevap` +
			(row.total ? ` (%${Math.round(row.accuracy * 100)} doğru)` : '');
		chart.appendChild(bar);
	});

	const total = rows.reduce((s, r) => s + r.total, 0);
	const activeDays = rows.filter((r) => r.total > 0).length;

	return el('section', { class: 'panel' }, [
		el('h2', { text: '📊 Son 30 gün' }),
		el('div', { class: 'small', text: `${total} cevap · ${activeDays} gün çalışıldı` }),
		el('div', { class: 'chartWrap' }, [chart])
	]);
}

/** Öğrenme aşamaları - yığılmış çubuk. */
function maturitySection(words) {
	const b = maturityBreakdown(words);
	const stages = [
		{ key: 'learned', label: 'Öğrenilmiş', color: 'stage--learned', count: b.learned },
		{ key: 'maturing', label: 'Pekişiyor', color: 'stage--maturing', count: b.maturing },
		{ key: 'young', label: 'Genç', color: 'stage--young', count: b.young },
		{ key: 'learning', label: 'Öğreniliyor', color: 'stage--learning', count: b.learning },
		{ key: 'untouched', label: 'Başlanmamış', color: 'stage--untouched', count: b.untouched }
	];

	const bar = el('div', { class: 'stageBar' });
	for (const s of stages) {
		if (!s.count) continue;
		const seg = el('div', { class: 'stageSeg ' + s.color, title: `${s.label}: ${s.count}` });
		seg.style.flexGrow = String(s.count);
		bar.appendChild(seg);
	}

	const legend = el('div', { class: 'stageLegend' });
	for (const s of stages) {
		legend.appendChild(el('div', { class: 'stageItem' }, [
			el('span', { class: 'stageDot ' + s.color }),
			el('span', { class: 'stageName', text: s.label }),
			el('span', { class: 'stageCount', text: String(s.count) })
		]));
	}

	return el('section', { class: 'panel' }, [
		el('h2', { text: '🌱 Öğrenme aşamaları' }),
		el('div', { class: 'small', text: `Toplam ${b.total} kelime` }),
		bar,
		legend
	]);
}

/** Önümüzdeki 14 günün tekrar yükü. */
function upcomingSection(words) {
	const load = upcomingLoad(words, { days: 14 });
	const max = Math.max(1, load.overdue, ...load.days.map((d) => d.count));

	const rows = el('div', { class: 'loadRows' });

	if (load.overdue) {
		rows.appendChild(loadRow('Gecikmiş', load.overdue, max, true));
	}
	load.days.forEach((d, i) => {
		const label = i === 0 ? 'Bugün' : i === 1 ? 'Yarın'
			: d.date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
		rows.appendChild(loadRow(label, d.count, max, false));
	});

	return el('section', { class: 'panel' }, [
		el('h2', { text: '⏳ Önündeki 14 gün' }),
		el('div', { class: 'small', text: 'Hangi gün kaç kelimenin tekrar sırası geleceği.' }),
		rows
	]);
}

function loadRow(label, count, max, overdue) {
	const fill = el('div', { class: 'loadFill' + (overdue ? ' loadFill--overdue' : '') });
	fill.style.width = (count / max) * 100 + '%';
	return el('div', { class: 'loadRow' }, [
		el('span', { class: 'loadLabel', text: label }),
		el('div', { class: 'loadTrack' }, [fill]),
		el('span', { class: 'loadCount', text: String(count) })
	]);
}

/** En çok zorlanılan kelimeler. */
function hardestSection(hard) {
	const list = el('div', { class: 'hardList' });
	for (const h of hard) {
		list.appendChild(el('div', { class: 'hardItem' }, [
			el('span', { class: 'hardEn', text: h.word.en }),
			el('span', { class: 'hardTr', text: h.word.tr }),
			el('span', { class: 'hardLapses', text: `${h.lapses}× unutuldu` })
		]));
	}

	return el('section', { class: 'panel' }, [
		el('h2', { text: '🔥 En çok zorlandıkların' }),
		el('div', { class: 'small', text: 'Bunlara ekstra zaman ayırmak işe yarar.' }),
		list
	]);
}
