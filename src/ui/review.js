/**
 * Tekrar (review) oturumu — tam ekran kart akışı.
 *
 * Oturum kendi kuyruğunu tutar; her cevaptan sonra store'a yazar ve
 * bir sonraki kelimeye geçer. Oturum sonunda kısa bir özet gösterir.
 */
import { formatInterval, previewIntervals } from '../core/scheduler.js';
import { hasEnglishVoice, speak, stop as stopSpeech } from '../core/speech.js';
import { MAX_LEVEL } from '../core/srs.js';
import { el } from './dom.js';

/** @type {{queue: string[], index: number, active: boolean, stats: object}|null} */
let session = null;
let overlayNode = null;
let refs = null;

/**
 * @param {object[]} queue Kelime nesneleri
 * @param {{
 *   getWord: (id: string) => object|undefined,
 *   onRate: (id: string, rating: 'again'|'hard'|'good'|'easy') => void,
 *   onFinish: (stats: {known: number, forgot: number, skipped: number, total: number}) => void
 * }} handlers
 */
export function startSession(queue, handlers) {
	session = {
		queue: queue.map((w) => w.id),
		index: 0,
		active: true,
		stats: { known: 0, forgot: 0, skipped: 0, total: queue.length, ratings: {} }
	};
	buildOverlay(handlers);
	showCurrent(handlers);
}

export function isActive() {
	return !!(session && session.active);
}

function buildOverlay(handlers) {
	if (overlayNode) overlayNode.remove();

	const progress = el('span', { attrs: { id: 'reviewProgress' }, text: '1/1' });
	const level = el('span', { class: 'kpill', attrs: { id: 'reviewLevel' }, text: 'Seviye 0' });
	const cefr = el('span', { class: 'cefr', attrs: { id: 'reviewCefr' } });
	const enNode = el('div', { class: 'en', attrs: { id: 'reviewEn' } });
	const speakBtn = el('button', {
		class: 'speakBtn',
		text: '🔊',
		title: 'Telaffuzu dinle (S)',
		attrs: { 'aria-label': 'Telaffuzu dinle' }
	});
	const enRow = el('div', { class: 'reviewEnRow' }, [enNode, hasEnglishVoice() ? speakBtn : null]);
	const trNode = el('div', { class: 'tr', attrs: { id: 'reviewTr' } });
	const exNode = el('div', { class: 'small', attrs: { id: 'reviewEx' } });
	const tagsNode = el('div', { class: 'tags', attrs: { id: 'reviewTags' } });

	const btnShow = el('button', { class: 'ghost', text: 'Anlamı Göster (Boşluk)' });

	// Dört seçenekli değerlendirme: her düğme bir sonraki tekrarın
	// ne zaman olacağını da gösterir, karar somutlaşsın diye.
	const rateButtons = {};
	const rateRow = el('div', { class: 'rateRow hidden' });
	const RATING_META = [
		{ key: 'again', label: 'Hiç', cls: 'rate--again', hint: '1' },
		{ key: 'hard', label: 'Zor', cls: 'rate--hard', hint: '2' },
		{ key: 'good', label: 'İyi', cls: 'rate--good', hint: '3' },
		{ key: 'easy', label: 'Kolay', cls: 'rate--easy', hint: '4' }
	];
	for (const meta of RATING_META) {
		const when = el('span', { class: 'rateWhen' });
		const btn = el('button', { class: 'rateBtn ' + meta.cls }, [
			el('span', { class: 'rateLabel', text: meta.label }),
			when,
			el('span', { class: 'rateKey', text: meta.hint })
		]);
		btn.dataset.rating = meta.key;
		rateButtons[meta.key] = { btn, when };
		rateRow.appendChild(btn);
	}

	const btnSkip = el('button', { class: 'ghost', text: 'Geç' });
	const btnExit = el('button', { class: 'ghost', text: 'Kapat (Esc)' });

	const card = el('div', { class: 'reviewCard' }, [
		el('div', { class: 'reviewMeta' }, [progress, cefr, level]),
		enRow,
		trNode,
		exNode,
		tagsNode,
		rateRow,
		el('div', { class: 'reviewActions' }, [btnShow, btnSkip, btnExit])
	]);

	overlayNode = el('div', {
		class: 'reviewOverlay',
		attrs: { id: 'reviewOverlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Tekrar oturumu' }
	}, [card]);

	refs = { progress, cefr, level, enNode, trNode, exNode, tagsNode, btnShow, rateRow, rateButtons, btnSkip, btnExit };

	speakBtn.onclick = (e) => {
		e.stopPropagation();
		speak(refs.enNode.textContent);
	};

	btnShow.onclick = reveal;
	for (const meta of RATING_META) {
		rateButtons[meta.key].btn.onclick = () => answer(meta.key, handlers);
	}
	btnSkip.onclick = () => {
		session.stats.skipped++;
		session.index++;
		showCurrent(handlers);
	};
	btnExit.onclick = () => endSession(handlers);

	document.addEventListener('keydown', onKey, true);
	document.body.appendChild(overlayNode);
	document.body.classList.add('modalOpen');
}

/**
 * Klavye kısayolları:
 *   Boşluk/Enter — anlamı göster, sonra "İyi"
 *   1-4          — Hiç / Zor / İyi / Kolay
 *   S            — telaffuzu dinle
 *   Esc          — kapat
 */
function onKey(e) {
	if (!isActive()) return;
	const hidden = refs.btnShow.style.display !== 'none';

	if (e.key === 'Escape') {
		e.preventDefault();
		refs.btnExit.click();
		return;
	}
	if (e.key === 's' || e.key === 'S') {
		e.preventDefault();
		speak(refs.enNode.textContent);
		return;
	}
	if (e.key === ' ' || e.key === 'Enter') {
		e.preventDefault();
		if (hidden) refs.btnShow.click();
		else refs.rateButtons.good.btn.click();
		return;
	}
	if (hidden) return;

	const byKey = { 1: 'again', 2: 'hard', 3: 'good', 4: 'easy' };
	if (byKey[e.key]) {
		e.preventDefault();
		refs.rateButtons[byKey[e.key]].btn.click();
	}
}

function reveal() {
	refs.trNode.style.display = '';
	refs.exNode.style.display = refs.exNode.textContent ? '' : 'none';
	refs.rateRow.classList.remove('hidden');
	refs.btnShow.style.display = 'none';
}

function answer(rating, handlers) {
	const id = session.queue[session.index];
	session.stats[rating === 'again' ? 'forgot' : 'known']++;
	session.stats.ratings[rating] = (session.stats.ratings[rating] || 0) + 1;
	session.index++;
	handlers.onRate(id, rating);
	showCurrent(handlers);
}

function showCurrent(handlers) {
	if (!isActive()) return;

	while (session.index < session.queue.length) {
		const w = handlers.getWord(session.queue[session.index]);
		if (!w) {
			session.index++;
			continue;
		}
		paint(w);
		return;
	}
	endSession(handlers);
}

function paint(w) {
	refs.progress.textContent = `${session.index + 1}/${session.queue.length}`;
	refs.level.textContent = w.level >= MAX_LEVEL ? 'Öğrenilmiş' : 'Seviye ' + w.level;
	refs.cefr.textContent = w.cefr || '';
	refs.cefr.className = 'cefr' + (w.cefr ? ' cefr--' + w.cefr : ' hidden');
	refs.enNode.textContent = w.en;
	refs.trNode.textContent = '— ' + w.tr;
	const extras = [];
	if (w.synonyms && w.synonyms.length) extras.push('Eş anlamlı: ' + w.synonyms.join(', '));
	if (w.example) extras.push('Örnek: ' + w.example);
	refs.exNode.textContent = extras.join('  ·  ');

	refs.tagsNode.textContent = '';
	for (const t of w.tags || []) refs.tagsNode.appendChild(el('span', { class: 'tag', text: t }));

	// Her seçeneğin bir sonraki tekrarı ne kadar öteleyeceğini göster
	const preview = previewIntervals(w);
	for (const [key, { when }] of Object.entries(refs.rateButtons)) {
		when.textContent = formatInterval(preview[key]);
	}

	refs.trNode.style.display = 'none';
	refs.exNode.style.display = 'none';
	refs.rateRow.classList.add('hidden');
	refs.btnShow.style.display = '';
	refs.btnShow.focus();
}

function endSession(handlers) {
	const stats = session ? session.stats : { known: 0, forgot: 0, skipped: 0, total: 0 };
	const answered = stats.known + stats.forgot;

	session = null;
	stopSpeech();
	document.removeEventListener('keydown', onKey, true);
	document.body.classList.remove('modalOpen');
	if (overlayNode) overlayNode.remove();
	overlayNode = null;
	refs = null;

	handlers.onFinish({ ...stats, answered });
}
