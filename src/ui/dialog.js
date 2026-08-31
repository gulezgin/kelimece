/**
 * Uygulama içi diyaloglar — tarayıcının alert/confirm'ünün yerine geçer.
 *
 * Neden: alert/confirm mobil WebView'de (Capacitor) sayfanın kendisini
 * dondurur, "localhost diyor ki:" gibi başlıklarla görünür ve uygulamayı
 * web sitesi gibi gösterir. Bunlar söz veren (promise) ve klavyeyle
 * kapatılabilen diyaloglar.
 */
import { el } from './dom.js';

let openDialog = null;

function buildOverlay({ title, message, buttons }) {
	const overlay = el('div', { class: 'dialogOverlay', attrs: { role: 'presentation' } });
	const box = el('div', {
		class: 'dialogBox',
		attrs: { role: 'alertdialog', 'aria-modal': 'true', 'aria-label': title || 'Bildirim' }
	});

	if (title) box.appendChild(el('div', { class: 'dialogTitle', text: title }));

	// Mesajdaki satır sonlarını koru, ama HTML olarak yorumlama.
	const body = el('div', { class: 'dialogMessage' });
	String(message).split('\n').forEach((line, i) => {
		if (i > 0) body.appendChild(document.createElement('br'));
		body.appendChild(document.createTextNode(line));
	});
	box.appendChild(body);

	const actions = el('div', { class: 'dialogActions' });
	for (const b of buttons) actions.appendChild(b);
	box.appendChild(actions);

	overlay.appendChild(box);
	return overlay;
}

function present(overlay, resolve, defaultValue) {
	// Aynı anda tek diyalog
	if (openDialog) openDialog.close(defaultValue);

	const previouslyFocused = document.activeElement;

	const close = (value) => {
		document.removeEventListener('keydown', onKey, true);
		overlay.remove();
		openDialog = null;
		if (previouslyFocused && previouslyFocused.focus) previouslyFocused.focus();
		resolve(value);
	};

	const onKey = (e) => {
		if (e.key === 'Escape') {
			e.preventDefault();
			close(defaultValue);
		}
		if (e.key === 'Tab') trapFocus(e, overlay);
	};

	overlay.addEventListener('click', (e) => {
		if (e.target === overlay) close(defaultValue);
	});
	document.addEventListener('keydown', onKey, true);
	document.body.appendChild(overlay);

	openDialog = { close };
	const first = overlay.querySelector('button');
	if (first) first.focus();

	return close;
}

/** Odağı diyalog içinde tutar. */
function trapFocus(e, container) {
	const focusable = container.querySelectorAll('button, [href], input, select, textarea');
	if (!focusable.length) return;
	const first = focusable[0];
	const last = focusable[focusable.length - 1];
	if (e.shiftKey && document.activeElement === first) {
		e.preventDefault();
		last.focus();
	} else if (!e.shiftKey && document.activeElement === last) {
		e.preventDefault();
		first.focus();
	}
}

/**
 * Bilgilendirme. alert() yerine.
 * @returns {Promise<void>}
 */
export function alertDialog(message, { title = '' } = {}) {
	return new Promise((resolve) => {
		const okBtn = el('button', { class: 'primary', text: 'Tamam' });
		const overlay = buildOverlay({ title, message, buttons: [okBtn] });
		const close = present(overlay, resolve, undefined);
		okBtn.onclick = () => close(undefined);
	});
}

/**
 * Onay sorusu. confirm() yerine.
 * @returns {Promise<boolean>}
 */
export function confirmDialog(message, {
	title = '',
	confirmText = 'Evet',
	cancelText = 'Vazgeç',
	danger = false
} = {}) {
	return new Promise((resolve) => {
		const cancelBtn = el('button', { class: 'ghost', text: cancelText });
		const confirmBtn = el('button', { class: danger ? 'bad' : 'primary', text: confirmText });
		const overlay = buildOverlay({ title, message, buttons: [cancelBtn, confirmBtn] });
		const close = present(overlay, resolve, false);
		cancelBtn.onclick = () => close(false);
		confirmBtn.onclick = () => close(true);
		// Yıkıcı işlemlerde varsayılan odak "Vazgeç"te olsun
		(danger ? cancelBtn : confirmBtn).focus();
	});
}

/**
 * İkiden fazla seçenekli diyalog. Her seçenek bir açıklama satırı taşır.
 *
 * @param {string} message
 * @param {{title?: string, options: Array<{value: string, label: string, description?: string, danger?: boolean}>, cancelText?: string}} config
 * @returns {Promise<string|null>} Seçilen değer, vazgeçilirse null
 */
export function choiceDialog(message, { title = '', options = [], cancelText = 'Vazgeç' } = {}) {
	return new Promise((resolve) => {
		const overlay = buildOverlay({ title, message, buttons: [] });
		const box = overlay.querySelector('.dialogBox');
		const actions = overlay.querySelector('.dialogActions');

		// Seçenekler dikey liste hâlinde; her biri kendi açıklamasıyla
		const list = el('div', { class: 'choiceList' });
		const choices = [];
		for (const opt of options) {
			const btn = el('button', { class: 'choice' + (opt.danger ? ' choice--danger' : '') }, [
				el('div', { class: 'choiceLabel', text: opt.label }),
				opt.description ? el('div', { class: 'choiceDesc', text: opt.description }) : null
			]);
			list.appendChild(btn);
			choices.push({ btn, value: opt.value });
		}
		box.insertBefore(list, actions);

		const cancelBtn = el('button', { class: 'ghost', text: cancelText });
		actions.appendChild(cancelBtn);

		const close = present(overlay, resolve, null);
		for (const c of choices) c.btn.onclick = () => close(c.value);
		cancelBtn.onclick = () => close(null);
	});
}

/**
 * Akışı kesmeyen kısa bildirim. Başarılı işlemler için.
 * @param {string} message
 * @param {'ok'|'warn'|'bad'} [type]
 */
export function toast(message, type = 'ok') {
	let host = document.getElementById('toastHost');
	if (!host) {
		host = el('div', { class: 'toastHost', attrs: { id: 'toastHost', 'aria-live': 'polite' } });
		document.body.appendChild(host);
	}
	const node = el('div', { class: 'toast toast--' + type, text: message });
	host.appendChild(node);
	setTimeout(() => node.classList.add('toast--out'), 2600);
	setTimeout(() => node.remove(), 3000);
}
