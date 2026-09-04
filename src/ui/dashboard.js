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

	host.appendChild(goalRing(overview));
	host.appendChild(heroSection(overview, handlers));
	if (overview.plan) host.appendChild(dailyPlan(overview.plan, handlers));
	host.appendChild(statsRow(overview));
	host.appendChild(levelProgress(breakdown, overview.level, handlers));
	host.appendChild(moreRow(handlers));
}

/**
 * Gunluk hedef halkasi: seri, ilerleme ve seviye tek bakista.
 *
 * Sayilar zaten alttaki kartlarda var; buradaki tekrar bilerek.
 * Uygulamayi acan kisinin ilk gordugu sey "bugun ne kadar yaptim"
 * olmali - listeler ve dugmeler degil.
 *
 * Halka SVG: CSS conic-gradient daha kisa olurdu ama yuzdeyi
 * yumusak gecisle degistiremiyor ve WebView'de kenarlari tirtikli
 * cikiyor.
 */
function goalRing(o) {
	const goal = Math.max(1, o.dailyGoal || 1);
	const done = Math.min(goal, o.studiedToday || 0);
	const pct = Math.round((done / goal) * 100);

	const R = 52;
	const C = 2 * Math.PI * R;
	const svgNS = 'http://www.w3.org/2000/svg';
	const svg = document.createElementNS(svgNS, 'svg');
	svg.setAttribute('viewBox', '0 0 128 128');
	svg.setAttribute('class', 'ringSvg');
	svg.setAttribute('aria-hidden', 'true');

	for (const [cls, len] of [['ringTrack', null], ['ringFill', (pct / 100) * C]]) {
		const c = document.createElementNS(svgNS, 'circle');
		c.setAttribute('cx', '64');
		c.setAttribute('cy', '64');
		c.setAttribute('r', String(R));
		c.setAttribute('class', cls);
		if (len !== null) {
			c.setAttribute('stroke-dasharray', `${len} ${C}`);
		}
		svg.appendChild(c);
	}

	const center = el('div', { class: 'ringCenter' }, [
		el('div', { class: 'ringValue', text: `${done}/${goal}` }),
		el('div', { class: 'ringLabel', text: 'bugün' })
	]);

	const streakText = o.streak > 0 ? `${o.streak} gün` : 'Seri yok';
	return el('section', { class: 'goalRing' }, [
		el('div', { class: 'ringChip ringChip--streak' }, [
			el('span', { class: 'ringChipIcon', text: '🔥' }),
			el('span', { text: streakText })
		]),
		el('div', { class: 'ringWrap' }, [svg, center]),
		el('div', { class: 'ringChip ringChip--level' }, [
			el('span', { text: o.level ? 'Seviye ' + o.level : 'Seviyesiz' })
		])
	]);
}

/** Ana ekranin altindaki ikincil girisler. */
function moreRow(handlers) {
	const statsBtn = el('button', { class: 'ghost', text: '📊 Detaylı istatistik' });
	statsBtn.onclick = () => handlers.onStats();
	return el('div', { class: 'homeMore' }, [statsBtn]);
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

	// Hedef sorulmadiysa plan uretilemiyor; kullaniciyi oraya cagir.
	if (!o.plan) {
		const planBtn = el('button', { class: 'ghost', text: '📋 Günlük planımı oluştur' });
		planBtn.onclick = () => handlers.onSetupPlan();
		actions.appendChild(planBtn);
	}

	const browseBtn = el('button', { class: 'ghost', text: 'Kelime havuzu' });
	browseBtn.onclick = () => handlers.onBrowse();
	actions.appendChild(browseBtn);

	return el('section', { class: 'panel hero' }, [title, subtitle, actions]);
}


/**
 * Bugünün görev listesi.
 *
 * Uygulamayı açan kişi "bugün ne yapayım?" diye düşünmemeli. Liste
 * kısa: hedefe ve ayrılan süreye göre üretiliyor, çünkü tamamlanamayan
 * bir plan motive etmez, suçluluk üretir.
 */
function dailyPlan(plan, handlers) {
	const bitti = plan.done >= plan.total && plan.total > 0;

	const baslik = el('div', { class: 'planHead' }, [
		el('div', { class: 'planTitle', text: bitti ? '✅ Bugünü tamamladın' : '📋 Bugünkü görevlerin' }),
		el('div', { class: 'planCount', text: `${plan.done} / ${plan.total}` })
	]);

	const liste = el('div', { class: 'planList' });
	for (const t of plan.tasks) {
		const satir = el('button', {
			class: 'planTask' + (t.done ? ' planTask--done' : ''),
			title: t.title
		}, [
			el('span', { class: 'planTaskIcon', text: t.done ? '✓' : t.icon }),
			el('span', { class: 'planTaskBody' }, [
				el('span', { class: 'planTaskTitle', text: t.title }),
				el('span', { class: 'planTaskNote', text: t.note })
			]),
			el('span', { class: 'planTaskMin', text: t.minutes + ' dk' })
		]);
		satir.onclick = () => handlers.onTask(t);
		liste.appendChild(satir);
	}

	const alt = el('button', { class: 'ghost planEdit', text: '⚙️ Hedefimi değiştir' });
	alt.onclick = () => handlers.onEditGoal();

	return el('section', { class: 'panel planPanel' }, [baslik, liste, alt]);
}

/** Günlük hedef, seri ve genel ilerleme. */
function statsRow(o) {
	const s = o.session || { total: o.due, reviews: 0, fresh: 0, freshAvailable: 0 };

	// Ham "bekleyen kelime" sayısı 5000'i geçebiliyor ve yıldırıcı
	// görünüyor. Kartta bugünkü oturumun uzunluğu gösteriliyor;
	// havuzun tamamı alt satırda bilgi olarak kalıyor.
	const sessionNote = s.total > 0
		? (s.reviews ? `${s.reviews} tekrar + ${s.fresh} yeni` : `${s.fresh} yeni kelime`)
		: 'bugünlük bitti';

	// Seri ve gunluk hedef YUKARIDAKI HALKADA. Burada tekrar etmek
	// ayni sayiyi iki kez gostermek oluyordu; ekranin ust yarisi
	// bilgi tasimadan doluyordu.
	return el('section', { class: 'statCards' }, [
		statCard('📚', 'Öğrenilen', `${o.learned} / ${o.total}`, `%${o.percent}`, o.percent),
		statCard('⏰', 'Bugünkü oturum', String(s.total), sessionNote),
		statCard('🎯', 'En uzun seri',
			o.longestStreak > 0 ? `${o.longestStreak} gün` : 'Henüz yok',
			o.streak > 0 && o.streak === o.longestStreak ? 'Şu an rekordasın' : '')
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
