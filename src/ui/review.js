/**
 * Tekrar (review) oturumu — tam ekran kart akışı.
 *
 * Oturum kendi kuyruğunu tutar; her cevaptan sonra store'a yazar ve
 * bir sonraki kelimeye geçer. Oturum sonunda kısa bir özet gösterir.
 */
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
 *   onAnswer: (id: string, known: boolean) => void,
 *   onFinish: (stats: {known: number, forgot: number, skipped: number, total: number}) => void
 * }} handlers
 */
export function startSession(queue, handlers) {
	session = {
		queue: queue.map((w) => w.id),
		index: 0,
		active: true,
		stats: { known: 0, forgot: 0, skipped: 0, total: queue.length }
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
	const enNode = el('div', { class: 'en', attrs: { id: 'reviewEn' } });
	const trNode = el('div', { class: 'tr', attrs: { id: 'reviewTr' } });
	const exNode = el('div', { class: 'small', attrs: { id: 'reviewEx' } });
	const tagsNode = el('div', { class: 'tags', attrs: { id: 'reviewTags' } });

	const btnShow = el('button', { class: 'ghost', text: 'Anlamı Göster (Boşluk)' });
	const btnKnown = el('button', { class: 'good', text: 'Biliyordum ✓' });
	const btnForgot = el('button', { class: 'bad', text: 'Unuttum ✗' });
	const btnSkip = el('button', { class: 'ghost', text: 'Geç' });
	const btnExit = el('button', { class: 'ghost', text: 'Kapat (Esc)' });

	const card = el('div', { class: 'reviewCard' }, [
		el('div', { class: 'reviewMeta' }, [progress, level]),
		enNode,
		trNode,
		exNode,
		tagsNode,
		el('div', { class: 'reviewActions' }, [btnShow, btnKnown, btnForgot, btnSkip, btnExit])
	]);

	overlayNode = el('div', {
		class: 'reviewOverlay',
		attrs: { id: 'reviewOverlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Tekrar oturumu' }
	}, [card]);

	refs = { progress, level, enNode, trNode, exNode, tagsNode, btnShow, btnKnown, btnForgot, btnSkip, btnExit };

	btnShow.onclick = reveal;
	btnKnown.onclick = () => answer(true, handlers);
	btnForgot.onclick = () => answer(false, handlers);
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

/** Klavye kısayolları: Boşluk = göster, 1/← = unuttum, 2/→ = biliyordum. */
function onKey(e) {
	if (!isActive()) return;
	const hidden = refs.btnShow.style.display !== 'none';

	if (e.key === 'Escape') {
		e.preventDefault();
		refs.btnExit.click();
	} else if (e.key === ' ' || e.key === 'Enter') {
		e.preventDefault();
		if (hidden) refs.btnShow.click();
		else refs.btnKnown.click();
	} else if (!hidden && (e.key === '1' || e.key === 'ArrowLeft')) {
		e.preventDefault();
		refs.btnForgot.click();
	} else if (!hidden && (e.key === '2' || e.key === 'ArrowRight')) {
		e.preventDefault();
		refs.btnKnown.click();
	}
}

function reveal() {
	refs.trNode.style.display = '';
	refs.exNode.style.display = refs.exNode.textContent ? '' : 'none';
	refs.btnKnown.style.display = '';
	refs.btnForgot.style.display = '';
	refs.btnShow.style.display = 'none';
}

function answer(known, handlers) {
	const id = session.queue[session.index];
	session.stats[known ? 'known' : 'forgot']++;
	session.index++;
	handlers.onAnswer(id, known);
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
	refs.enNode.textContent = w.en;
	refs.trNode.textContent = '— ' + w.tr;
	refs.exNode.textContent = w.example ? 'Örnek: ' + w.example : '';

	refs.tagsNode.textContent = '';
	for (const t of w.tags || []) refs.tagsNode.appendChild(el('span', { class: 'tag', text: t }));

	refs.trNode.style.display = 'none';
	refs.exNode.style.display = 'none';
	refs.btnKnown.style.display = 'none';
	refs.btnForgot.style.display = 'none';
	refs.btnShow.style.display = '';
	refs.btnShow.focus();
}

function endSession(handlers) {
	const stats = session ? session.stats : { known: 0, forgot: 0, skipped: 0, total: 0 };
	const answered = stats.known + stats.forgot;

	session = null;
	document.removeEventListener('keydown', onKey, true);
	document.body.classList.remove('modalOpen');
	if (overlayNode) overlayNode.remove();
	overlayNode = null;
	refs = null;

	handlers.onFinish({ ...stats, answered });
}
