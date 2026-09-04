/**
 * Küçük SVG grafikler.
 *
 * Kütüphane yok: iki grafik türü için 100 KB'lık bir paket eklemek,
 * uygulamanın tamamının 300 KB olduğu bir projede orantısız. SVG
 * elle kuruluyor ve `el()` gibi metin daima `textContent` ile yazılıyor.
 *
 * Grafikler eksen ve rakam gösteriyor. Rakamsız bir "trend çizgisi"
 * güzel görünüyor ama hiçbir şey söylemiyor; kullanıcı dün kaç XP
 * kazandığını okuyabilmeli.
 */

const NS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs = {}, text = null) {
	const node = document.createElementNS(NS, tag);
	for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
	if (text != null) node.textContent = text;
	return node;
}

/** Gün adının kısa Türkçe hâli. */
function dayLabel(iso) {
	const g = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
	const d = new Date(iso + 'T12:00:00');
	return Number.isNaN(d.getTime()) ? '' : g[d.getDay()];
}

/**
 * Ölçeğin tabanı.
 *
 * En yüksek güne göre ölçeklemek tek başına yanıltıcı: 6 XP kazanılan
 * bir hafta, çubuğu tepeye kadar doldurup dolu bir gün gibi gösteriyor.
 * Taban, bir oturumluk çalışmaya (yaklaşık beş doğru cevap) denk.
 */
export const CHART_FLOOR = 50;

/**
 * Günlük XP çubuk grafiği.
 *
 * SVG DEĞİL, DOM. İki SVG denemesi de bozuktu: `preserveAspectRatio`
 * kapalıyken yazılar yatay geriliyor, açıkken grafik genişliğe
 * ölçeklenince yazı boyutu da büyüyor (668 px'lik kutuda 11 px yazı
 * 26 px görünüyordu). Yükseklik yüzdeyle, yazı `rem` ile verilince
 * ikisi de olmuyor.
 */
export function xpBarChart(series, { height = 140 } = {}) {
	const veri = series || [];
	const kok = document.createElement('div');
	kok.className = 'xpChart';
	kok.style.height = height + 'px';
	kok.setAttribute('role', 'img');
	kok.setAttribute('aria-label', 'Günlük XP grafiği');
	if (!veri.length) return kok;

	const enBuyuk = Math.max(CHART_FLOOR, ...veri.map((d) => d.xp));

	for (const d of veri) {
		const sutun = document.createElement('div');
		sutun.className = 'xpCol';

		const deger = document.createElement('span');
		deger.className = 'xpValue';
		deger.textContent = d.xp ? String(d.xp) : '';

		const cubuk = document.createElement('div');
		// Sifir gunler de gorunsun diye ince bir iz: bos alan "veri yok"
		// ile "o gun calisilmadi" arasindaki farki gizliyor.
		cubuk.className = d.xp ? 'xpBar' : 'xpBar xpBar--empty';
		cubuk.style.height = d.xp ? Math.max(4, Math.round((d.xp / enBuyuk) * 100)) + '%' : '3px';

		const etiket = document.createElement('span');
		etiket.className = 'xpLabel';
		etiket.textContent = dayLabel(d.day);

		sutun.append(deger, cubuk, etiket);
		kok.appendChild(sutun);
	}

	return kok;
}

/**
 * Beceri başarı oranları — yatay çubuklar.
 *
 * Veri olmayan beceri "%0" değil "veri yok" diyor. Hiç denenmemiş bir
 * beceriyi sıfır başarı olarak göstermek kullanıcıya yanlış bir şey
 * söyler ve gereksiz yere cesaret kırar.
 */
export function skillBars(skills) {
	const kok = document.createElement('div');
	kok.className = 'skillBars';

	for (const s of skills || []) {
		const satir = document.createElement('div');
		satir.className = 'skillRow';

		const ad = document.createElement('span');
		ad.className = 'skillName';
		ad.textContent = s.icon + ' ' + s.name;

		const yol = document.createElement('div');
		yol.className = 'skillTrack';
		if (s.total > 0) {
			const dolu = document.createElement('div');
			dolu.className = 'skillFill';
			dolu.style.width = Math.max(2, Math.round((s.correct / s.total) * 100)) + '%';
			yol.appendChild(dolu);
		}

		const deger = document.createElement('span');
		deger.className = 'skillValue';
		deger.textContent = s.total > 0
			? `%${Math.round((s.correct / s.total) * 100)} · ${s.correct}/${s.total}`
			: 'veri yok';
		if (!s.total) deger.classList.add('skillValue--none');

		satir.append(ad, yol, deger);
		kok.appendChild(satir);
	}

	return kok;
}

/**
 * İlerleme halkası — seviye ya da haftalık hedef için.
 *
 * `stroke-dasharray` ile çiziliyor; yüzde 0'da bile halkanın izi
 * görünüyor ki bileşen "yüklenmedi" gibi durmasın.
 */
export function progressRing(percent, { size = 92, label = '', sub = '' } = {}) {
	const yuzde = Math.max(0, Math.min(100, Number(percent) || 0));
	const r = (size - 12) / 2;
	const cevre = 2 * Math.PI * r;
	const merkez = size / 2;

	const svg = svgEl('svg', {
		class: 'ring',
		viewBox: `0 0 ${size} ${size}`,
		width: size, height: size,
		role: 'img',
		'aria-label': `${label} yüzde ${yuzde}`
	});
	svg.appendChild(svgEl('circle', {
		cx: merkez, cy: merkez, r, class: 'ringTrack', fill: 'none', 'stroke-width': 8
	}));
	svg.appendChild(svgEl('circle', {
		cx: merkez, cy: merkez, r, class: 'ringFill', fill: 'none', 'stroke-width': 8,
		'stroke-linecap': 'round',
		'stroke-dasharray': `${(cevre * yuzde) / 100} ${cevre}`,
		transform: `rotate(-90 ${merkez} ${merkez})`
	}));
	if (label) {
		svg.appendChild(svgEl('text', {
			x: merkez, y: merkez + (sub ? -2 : 5),
			class: 'ringLabel', 'text-anchor': 'middle'
		}, label));
	}
	if (sub) {
		svg.appendChild(svgEl('text', {
			x: merkez, y: merkez + 14, class: 'ringSub', 'text-anchor': 'middle'
		}, sub));
	}
	return svg;
}
