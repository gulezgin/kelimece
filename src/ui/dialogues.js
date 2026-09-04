/**
 * Diyalog ekranı: liste ve okuma görünümü.
 *
 * Okuma görünümünde Türkçe karşılıklar varsayılan olarak GİZLİ.
 * Sebep: yan yana duran çeviri okumayı tembelleştiriyor — göz
 * doğrudan Türkçeye kayıyor ve İngilizce cümle işlenmiyor. Dokununca
 * açılıyor, yani anlama çabası önce geliyor.
 */
import { dialogueSummaries } from '../core/dialogues.js';
import { hasEnglishVoice, speak } from '../core/speech.js';
import { $, el } from './dom.js';
import { appendTappableWords } from './tappable.js';

/**
 * Diyalog listesi.
 * @param {object[]} dialogues
 * @param {object} premium
 * @param {{onOpen: (id: string) => void, onLocked: () => void}} handlers
 */
export function renderDialogueList(dialogues, premium, handlers) {
	const host = $('dialoguesView');
	if (!host) return;
	host.textContent = '';

	const items = dialogueSummaries(dialogues, premium);

	host.appendChild(el('div', { class: 'sectionHead' }, [
		el('h2', { text: '💬 Günlük Konuşma' }),
		el('div', {
			class: 'small',
			text: items.length
				? `${items.length} diyalog — gerçek durumlarda kullanılan kalıplar.`
				: 'Diyaloglar yüklenemedi.'
		})
	]));

	if (!items.length) return;

	const grid = el('div', { class: 'dlgGrid' });
	for (const d of items) {
		const card = el('button', {
			class: 'dlgCard' + (d.locked ? ' dlgCard--locked' : ''),
			title: d.locked ? 'Abonelikle açılır' : d.title
		}, [
			el('span', { class: 'dlgIcon', text: d.icon }),
			el('div', { class: 'dlgMeta' }, [
				el('span', { class: 'dlgTitle', text: d.title }),
				el('span', { class: 'dlgSummary', text: d.summary })
			]),
			el('span', { class: 'cefr cefr--' + d.cefr, text: d.cefr }),
			el('span', { class: 'dlgLines', text: `${d.lineCount} satır` }),
			d.locked ? el('span', { class: 'dlgLock', text: '🔒' }) : null
		]);
		card.onclick = () => (d.locked ? handlers.onLocked() : handlers.onOpen(d.id));
		grid.appendChild(card);
	}
	host.appendChild(grid);
}

/**
 * Tek diyalogun okuma görünümü.
 * @param {object} dialogue
 * @param {{onBack: () => void, onWord: (word: object) => void}} handlers
 * @param {Map<string, object>} wordIndex Kelimeye dokunma için havuz dizini
 */
export function renderDialogue(dialogue, handlers, wordIndex) {
	const host = $('dialoguesView');
	if (!host || !dialogue) return;
	host.textContent = '';

	const back = el('button', { class: 'ghost', text: '← Diyaloglar' });
	back.onclick = handlers.onBack;

	host.appendChild(el('div', { class: 'dlgHead' }, [
		back,
		el('span', { class: 'cefr cefr--' + dialogue.cefr, text: dialogue.cefr })
	]));

	host.appendChild(el('div', { class: 'sectionHead' }, [
		el('h2', { text: (dialogue.icon || '💬') + ' ' + dialogue.title }),
		el('div', { class: 'small', text: dialogue.summary || '' })
	]));

	// Rol yapma: okumak konusmayi ogretmiyor, uretmek ogretiyor.
	const roleBtn = el('button', {
		class: 'primary dlgRoleBtn',
		text: '🎭 Bu diyalogu konus'
	});
	roleBtn.onclick = () => handlers.onPractice(dialogue.id);
	host.appendChild(roleBtn);

	const canSpeak = hasEnglishVoice();
	const list = el('div', { class: 'dlgLineList' });

	for (const line of dialogue.lines || []) {
		list.appendChild(lineRow(line, canSpeak, handlers, wordIndex));
	}
	host.appendChild(list);

	host.appendChild(el('div', {
		class: 'small dlgHint',
		text: 'Türkçesini görmek için satıra dokun. Altı çizili kelimelere dokunarak anlamlarına bakabilirsin.'
	}));
}

function lineRow(line, canSpeak, handlers, wordIndex) {
	const tr = el('div', { class: 'dlgTr hidden', text: line.tr || '' });

	const en = el('div', { class: 'dlgEn' });
	appendTappableWords(en, line.en || '', wordIndex, handlers.onWord);

	const row = el('div', { class: 'dlgLine dlgLine--' + (line.s === 'B' ? 'b' : 'a') }, [
		el('span', { class: 'dlgSpeaker', text: line.s || 'A' }),
		el('div', { class: 'dlgBody' }, [en, tr])
	]);

	if (canSpeak) {
		const btn = el('button', { class: 'iconBtn dlgSpeak', text: '🔊' });
		btn.setAttribute('aria-label', 'Satırı seslendir');
		btn.onclick = (e) => {
			e.stopPropagation();
			speak(line.en);
		};
		row.appendChild(btn);
	}

	// Satira dokunmak ceviriyi acip kapatiyor
	row.onclick = () => tr.classList.toggle('hidden');
	return row;
}
