/** Küçük DOM yardımcıları. */

/** @param {string} id */
export const $ = (id) => document.getElementById(id);

/**
 * Element oluşturur. Metin daima textContent ile yazılır (XSS'e kapalı).
 *
 * @param {string} tag
 * @param {{class?: string, text?: string, title?: string, attrs?: Record<string,string>}} [options]
 * @param {Array<Node>} [children]
 * @returns {HTMLElement}
 */
export function el(tag, options = {}, children = []) {
	const node = document.createElement(tag);
	if (options.class) node.className = options.class;
	if (options.text != null) node.textContent = options.text;
	if (options.title) node.title = options.title;
	for (const [k, v] of Object.entries(options.attrs || {})) node.setAttribute(k, v);
	for (const child of children) if (child) node.appendChild(child);
	return node;
}

/** fn'i çağrı yoğunluğuna göre geciktirir. */
export function debounce(fn, delay) {
	let timer;
	return function (...args) {
		clearTimeout(timer);
		timer = setTimeout(() => fn.apply(this, args), delay);
	};
}
