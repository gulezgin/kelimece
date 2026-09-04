/**
 * Kişisel kelime listeleri: liste ekranı ve liste içeriği.
 *
 * "Listeye ekle" havuz kartından çağrılıyor. Kullanıcı kelime EKLEMİYOR,
 * var olan kelimeleri grupluyor — bu ayrım arayüz metinlerinde de
 * korunuyor ki kaldırılan kelime ekleme özelliği geri gelmiş gibi
 * görünmesin.
 */

import { $, el } from './dom.js';

/** Listeler ekranı. */
export function renderLists(ozetler, handlers) {
	const host = $('listsView');
	if (!host) return;
	host.textContent = '';

	const geri = el('button', { class: 'ghost', text: '← Öğren' });
	geri.onclick = handlers.onBack;
	host.appendChild(el('div', { class: 'dlgHead' }, [geri]));

	host.appendChild(el('div', { class: 'sectionIntro' }, [
		el('h2', { text: '📋 Listelerim' }),
		el('p', { class: 'small', text: 'Havuzdaki kelimeleri kendi listelerinde topla ve yalnızca onları çalış.' })
	]));

	const yeni = el('button', { class: 'primary', text: '➕ Yeni liste' });
	yeni.onclick = handlers.onCreate;
	host.appendChild(el('div', { class: 'dlgFinishActions' }, [yeni]));

	if (!ozetler.length) {
		host.appendChild(el('div', { class: 'writeNote', text:
			'Henüz listen yok. Havuzdaki bir kelimenin "📋" düğmesine basarak '
			+ 'ilk listeni kurabilirsin.' }));
		return;
	}

	for (const l of ozetler) {
		const ac = el('button', { class: 'listCardMain' }, [
			el('span', { class: 'listName', text: l.name }),
			el('span', { class: 'small', text: l.count + ' kelime'
				+ (l.levels.length ? ' · ' + l.levels.join(', ') : '') })
		]);
		ac.onclick = () => handlers.onOpen(l.id);

		const calis = el('button', { class: 'good listCardBtn', text: 'Çalış', title: 'Bu listeyi çalış' });
		calis.disabled = l.count === 0;
		calis.onclick = () => handlers.onStudy(l.id);

		const menu = el('button', { class: 'ghost listCardBtn', text: '⋯', title: 'Yeniden adlandır veya sil' });
		menu.onclick = () => handlers.onManage(l.id);

		host.appendChild(el('div', { class: 'panel listCard' }, [ac, calis, menu]));
	}
}

/** Bir listenin içi. */
export function renderListDetail(list, kelimeler, handlers) {
	const host = $('listsView');
	if (!host || !list) return;
	host.textContent = '';

	const geri = el('button', { class: 'ghost', text: '← Listeler' });
	geri.onclick = handlers.onBackToLists;
	host.appendChild(el('div', { class: 'dlgHead' }, [geri]));

	host.appendChild(el('div', { class: 'sectionIntro' }, [
		el('h2', { text: '📋 ' + list.name }),
		el('p', { class: 'small', text: kelimeler.length + ' kelime' })
	]));

	if (!kelimeler.length) {
		host.appendChild(el('div', { class: 'writeNote', text:
			'Bu liste boş. Havuzdan bir kelimenin "📋" düğmesine basıp bu listeyi seç.' }));
		return;
	}

	const calis = el('button', { class: 'primary', text: '🎯 Bu listeyi çalış' });
	calis.onclick = () => handlers.onStudy(list.id);
	host.appendChild(el('div', { class: 'dlgFinishActions' }, [calis]));

	const kutu = el('div', { class: 'panel' });
	for (const w of kelimeler) {
		const cikar = el('button', { class: 'ghost listRowBtn', text: '✕', title: 'Listeden çıkar' });
		cikar.onclick = () => handlers.onToggle(list.id, w.id);

		const ses = el('button', { class: 'speakBtn speakBtn--sm', text: '🔊', title: 'Telaffuzu dinle' });
		ses.onclick = () => handlers.onSpeak(w.en);

		kutu.appendChild(el('div', { class: 'listRow' }, [
			el('div', { class: 'listRowText' }, [
				el('span', { class: 'antEn', text: w.en }),
				el('span', { class: 'antTr', text: w.tr })
			]),
			w.cefr ? el('span', { class: 'cefr cefr--' + w.cefr, text: w.cefr }) : null,
			ses,
			cikar
		].filter(Boolean)));
	}
	host.appendChild(kutu);
}
