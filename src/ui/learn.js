/**
 * "Öğren" ekranı: öğrenme modüllerinin toplandığı yer.
 *
 * Alt çubukta beş sekme var ve dilbilgisi, okuma, yazma her biri ayrı
 * sekme olamazdı. Bu ekran onları tek kapı altında topluyor; konular
 * da buraya taşındı çünkü o da bir öğrenme yolu, ayrı bir bölüm değil.
 */
import { $, el } from './dom.js';

/**
 * @param {object[]} modules {id, icon, title, note, ready}
 * @param {{onOpen: (id: string) => void}} handlers
 */
export function renderLearn(modules, handlers) {
	const host = $('learnView');
	if (!host) return;
	host.textContent = '';

	host.appendChild(el('div', { class: 'sectionHead' }, [
		el('h2', { text: '📘 Öğren' }),
		el('div', { class: 'small', text: 'Kelimenin dışındaki her şey burada.' })
	]));

	const grid = el('div', { class: 'learnGrid' });
	for (const m of modules) {
		const kart = el('button', {
			class: 'learnCard' + (m.ready ? '' : ' learnCard--soon'),
			title: m.ready ? m.title : 'Yakında'
		}, [
			el('span', { class: 'learnIcon', text: m.icon }),
			el('span', { class: 'learnTitle', text: m.title }),
			el('span', { class: 'learnNote', text: m.ready ? m.note : 'Yakında' })
		]);
		if (m.ready) kart.onclick = () => handlers.onOpen(m.id);
		else kart.disabled = true;
		grid.appendChild(kart);
	}
	host.appendChild(grid);
}
