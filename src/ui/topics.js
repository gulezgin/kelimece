/**
 * Konu ekranı: kelimelere alan alan giriş.
 *
 * Sıklık sırası "hangi kelime daha çok işine yarar" sorusunu cevaplıyor;
 * bu ekran "bugün canım ne çalışmak istiyor" sorusunu. İkisi aynı havuza
 * bakar, sadece kapı farklı.
 */
import { TOPIC_ICONS, topicProgress, topicSummaries } from '../core/topics.js';
import { $, el } from './dom.js';

/**
 * @param {object[]} words
 * @param {object} premium
 * @param {{onStudy: (topic: string) => void, onBrowse: (topic: string) => void}} handlers
 */
export function renderTopics(words, premium, handlers) {
	const host = $('topicsView');
	if (!host) return;
	host.textContent = '';

	const { topics, untopiced } = topicSummaries(words, premium);

	host.appendChild(el('div', { class: 'sectionHead' }, [
		el('h2', { text: '🗂️ Konular' }),
		el('div', {
			class: 'small',
			text: topics.length
				? `${topics.length} konu — bir konuya dokun, o alandaki kelimeleri çalış.`
				: 'Bu havuzda konu etiketli kelime yok.'
		})
	]));

	if (!topics.length) return;

	const grid = el('div', { class: 'topicGrid' });
	for (const t of topics) grid.appendChild(topicCard(t, handlers));
	host.appendChild(grid);

	if (untopiced > 0) {
		// Sayiyi gizlemek yerine soylemek dogru: kullanici havuzun
		// tamaminin burada olmadigini bilmeli.
		host.appendChild(el('div', {
			class: 'small topicFootnote',
			text: `${untopiced} kelime bir konuya girmiyor (genel ve soyut kelimeler). ` +
				'Onlara Havuz ekranından ulaşabilirsin.'
		}));
	}
}

function topicCard(t, handlers) {
	const pct = topicProgress(t);
	const fullyLocked = t.total > 0 && t.locked === t.total;

	const meta = [];
	if (t.due) meta.push(`${t.due} tekrar`);
	if (t.locked) meta.push(`${t.locked} kilitli`);

	const card = el('button', {
		class: 'topicCard' + (fullyLocked ? ' topicCard--locked' : ''),
		title: fullyLocked ? 'Abonelikle açılır' : `${t.topic} konusunu çalış`
	}, [
		el('span', { class: 'topicIcon', text: t.icon }),
		el('span', { class: 'topicName', text: t.topic }),
		el('span', { class: 'topicCount', text: `${t.learned} / ${t.total} kelime` }),
		el('span', { class: 'topicBar' }, [
			el('span', { class: 'topicBarFill', attrs: { style: `width:${pct}%` } })
		]),
		meta.length ? el('span', { class: 'topicMeta', text: meta.join(' · ') }) : null,
		t.locked ? el('span', { class: 'topicLock', text: '🔒' }) : null
	]);

	card.onclick = () => handlers.onStudy(t.topic);
	// Sag tik / uzun basma: calismak yerine listeye bak
	card.oncontextmenu = (e) => {
		e.preventDefault();
		handlers.onBrowse(t.topic);
	};
	return card;
}

/**
 * Havuz ekranındaki etkin konu süzgecini gösterir.
 *
 * Görünmez bir süzgeç en sinir bozucu hatadır: kullanıcı 5000 kelimelik
 * havuzda 60 kelime görüp arızalı sanır. Rozet hem sebebi söyler hem de
 * çıkış yolunu verir.
 *
 * @param {string|null} topic
 * @param {number} count Süzgeçten geçen kelime sayısı
 * @param {Function} onClear
 */
export function renderTopicChip(topic, count, onClear) {
	const host = $('topicChipRow');
	if (!host) return;
	host.textContent = '';
	host.classList.toggle('hidden', !topic);
	if (!topic) return;

	const clear = el('button', { class: 'ghost topicChipClear', text: '×' });
	clear.setAttribute('aria-label', 'Konu süzgecini kaldır');
	clear.onclick = onClear;

	host.appendChild(el('span', { class: 'topicChip' }, [
		el('span', { text: (TOPIC_ICONS[topic] || '📗') + ' ' + topic }),
		el('span', { class: 'topicChipCount', text: String(count) }),
		clear
	]));
}
