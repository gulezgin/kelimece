/**
 * Kelime listesi, kutular görünümü ve istatistik çubuğu.
 *
 * Bu modül durumu değiştirmez; olayları dışarıdan verilen geri çağrılara
 * (callbacks) iletir. Böylece render mantığı veri mantığından ayrı kalır.
 */
import { isDue } from '../core/time.js';
import { MAX_LEVEL } from '../core/srs.js';
import { $, el } from './dom.js';

/**
 * Arama ve filtreye göre kelimeleri süzer.
 * @param {object[]} words
 * @param {{query?: string, mode?: string}} filter
 */
export function filterWords(words, { query = '', mode = 'all' }) {
	let list = words;

	if (mode === 'due') list = list.filter((w) => w.level < MAX_LEVEL && isDue(w.nextReviewAt));
	else if (mode === 'new') list = list.filter((w) => isToday(w.createdAt));
	else if (mode === 'learned') list = list.filter((w) => w.level >= MAX_LEVEL);

	const q = query.trim().toLowerCase();
	if (q) {
		list = list.filter(
			(w) =>
				w.en.toLowerCase().includes(q) ||
				(w.tr || '').toLowerCase().includes(q) ||
				(w.tags || []).some((t) => t.toLowerCase().includes(q))
		);
	}
	return list;
}

function isToday(iso) {
	return new Date(iso).toDateString() === new Date().toDateString();
}

/**
 * Üst rozetler ve havuz sayaçları.
 * @param {{total: number, due: number, learned: number, addedToday: number}} stats
 * @param {number} visibleCount
 * @param {number} dailyGoal
 */
export function renderStats(stats, visibleCount, dailyGoal) {
	$('statTotal').textContent = 'Toplam: ' + stats.total;
	$('statDue').textContent = 'Bugün tekrar: ' + stats.due;
	$('statAdded').textContent = `Bugün eklendi: ${stats.addedToday} / ${dailyGoal}`;
	$('listInfo').textContent = visibleCount + ' sonuç';
	$('poolCountAll').textContent = String(stats.total);
	$('poolCountDue').textContent = String(stats.due);
	$('poolCountNew').textContent = String(stats.addedToday);
	$('poolCountLearned').textContent = String(stats.learned);
}

/**
 * Kart listesi.
 * @param {object[]} list
 * @param {{onKnown: Function, onForgot: Function, onLearn: Function, onDelete: Function, onTagClick: Function}} handlers
 */
export function renderList(list, handlers) {
	const container = $('list');
	container.textContent = '';

	if (!list.length) {
		container.appendChild(
			el('div', { class: 'small', text: 'Hiç sonuç yok. Filtreleri temizlemeyi veya yeni kelime eklemeyi deneyin.' })
		);
		return;
	}

	const frag = document.createDocumentFragment();
	for (const w of list) frag.appendChild(wordCard(w, handlers));
	container.appendChild(frag);
}

function wordCard(w, { onKnown, onForgot, onLearn, onDelete, onTagClick }) {
	const learned = w.level >= MAX_LEVEL;
	const due = isDue(w.nextReviewAt);

	const top = el('div', { class: 'top' }, [
		el('div', { class: 'en', text: w.en }),
		el('div', { class: 'tr', text: '— ' + w.tr }),
		el('div', { class: 'spacer' }),
		el('span', { class: 'kpill', text: 'Seviye ' + w.level }),
		el('span', {
			class: 'badge ' + (learned ? 'ok' : due ? 'warn' : ''),
			text: learned ? 'Öğrenilmiş' : due ? 'Tekrar zamanı' : 'Sırada değil'
		})
	]);

	const card = el('div', { class: 'item' }, [top]);

	if (w.tags.length) {
		const tags = el('div', { class: 'tags' });
		for (const t of w.tags) {
			const tag = el('span', { class: 'tag', text: t, title: 'Bu etikete göre filtrele' });
			tag.addEventListener('click', () => onTagClick(t));
			tags.appendChild(tag);
		}
		card.appendChild(tags);
	}

	if (w.example) card.appendChild(el('div', { class: 'small', text: 'Örnek: ' + w.example }));

	const knowBtn = el('button', { class: 'good', text: 'Biliyordum ✓' });
	knowBtn.onclick = () => onKnown(w.id);
	const failBtn = el('button', { class: 'bad', text: 'Unuttum ✗' });
	failBtn.onclick = () => onForgot(w.id);
	const learnBtn = el('button', { class: 'ghost', text: 'Öğrenilmişe al' });
	learnBtn.onclick = () => onLearn(w.id);
	const delBtn = el('button', { class: 'ghost', text: 'Sil' });
	delBtn.onclick = () => onDelete(w.id, w.en);

	const actions = el('div', { class: 'actions' }, [knowBtn, failBtn]);
	if (!learned) actions.appendChild(learnBtn);
	actions.appendChild(delBtn);
	card.appendChild(actions);

	return card;
}

/**
 * Kutular görünümü — kart listesiyle AYNI filtrelenmiş listeyi kullanır.
 * @param {object[]} list
 */
export function renderTiles(list) {
	const tiles = $('meanTiles');
	if (!tiles) return;
	tiles.textContent = '';

	const frag = document.createDocumentFragment();
	const sorted = list.slice().sort((a, b) => a.en.localeCompare(b.en, 'en', { sensitivity: 'base' }));
	for (const w of sorted) {
		frag.appendChild(
			el('div', { class: 'tile' }, [
				el('div', { class: 'en', text: w.en }),
				el('div', { class: 'tr', text: w.tr })
			])
		);
	}
	tiles.appendChild(frag);
}
