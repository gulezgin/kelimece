/**
 * Metindeki kelimeleri havuzla eşleştirip tıklanabilir yapar.
 *
 * Hem diyaloglarda hem okuma parçalarında kullanılıyor. Ortak yere
 * çıkarılmasının sebebi kod tekrarından çok davranış tutarlılığı:
 * kelimeye dokunmanın iki ekranda farklı çalışması kullanıcıyı
 * şaşırtır.
 *
 * Noktalama ve boşluklar olduğu gibi korunuyor — yalnızca sözcükler
 * ayrıştırılıyor, yoksa cümlenin biçimi bozulur.
 */
import { el } from './dom.js';

/**
 * @param {HTMLElement} host
 * @param {string} text
 * @param {Map<string, object>} wordIndex Küçük harf kelime → havuz kaydı
 * @param {(word: object) => void} onWord
 */
export function appendTappableWords(host, text, wordIndex, onWord) {
	const parts = String(text || '').split(/([A-Za-z']+)/);
	for (const part of parts) {
		if (!part) continue;
		const key = part.toLowerCase().replace(/^'+|'+$/g, '');
		const word = /^[A-Za-z']+$/.test(part) && wordIndex ? wordIndex.get(key) : null;
		if (!word) {
			host.appendChild(document.createTextNode(part));
			continue;
		}
		const span = el('span', { class: 'tapWord', text: part, title: word.tr });
		span.onclick = (e) => {
			e.stopPropagation();
			onWord(word);
		};
		host.appendChild(span);
	}
}
