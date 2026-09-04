/**
 * Acil İngilizce arayüzü.
 *
 * Tasarım kararı: her cümlenin YANINDA bir "göster" düğmesi var.
 * Acil durumda en işe yarayan şey konuşmak değil, telefonu karşıdaki
 * kişiye uzatmak — telaffuzun anlaşılmaması riskini tamamen ortadan
 * kaldırıyor. Gösterim ekranı büyük yazıyla ve Türkçesiyle birlikte
 * açılıyor ki kullanıcı ne gösterdiğini bilsin.
 */

import { $, el } from './dom.js';

/** Bir cümle satırı: oku, seslendir, göster. */
function phraseRow(p, handlers, { dim = false } = {}) {
	const ses = el('button', { class: 'speakBtn speakBtn--sm', text: '🔊', title: 'Seslendir' });
	ses.onclick = () => handlers.onSpeak(p.en);

	const goster = el('button', { class: 'ghost emShowBtn', text: '👁', title: 'Karşındakine göster' });
	goster.onclick = () => handlers.onShow(p);

	return el('div', { class: 'emRow' + (dim ? ' emRow--hear' : '') }, [
		el('div', { class: 'emText' }, [
			el('span', { class: 'emEn', text: p.en }),
			el('span', { class: 'emTr', text: p.tr })
		]),
		ses,
		goster
	]);
}

/** Ana ekran: arama, acil cümleler, durumlar. */
export function renderEmergency(pack, sorgu, sonuclar, handlers) {
	const host = $('emergencyView');
	if (!host || !pack) return;
	host.textContent = '';

	const geri = el('button', { class: 'ghost', text: '← Öğren' });
	geri.onclick = handlers.onBack;
	host.appendChild(el('div', { class: 'dlgHead' }, [geri]));

	host.appendChild(el('div', { class: 'sectionIntro' }, [
		el('h2', { text: '🆘 Acil İngilizce' }),
		el('p', { class: 'small', text: 'İnternet gerekmez, tamamı ücretsiz. Cümleyi seslendirebilir ya da karşındakine gösterebilirsin.' })
	]));

	const arama = el('input', {
		class: 'input emSearch',
		attrs: { type: 'search', placeholder: 'Ara: çalındı, ağrı, bagaj...', autocomplete: 'off' }
	});
	arama.value = sorgu || '';
	arama.addEventListener('input', () => handlers.onSearch(arama.value));
	host.appendChild(el('div', { class: 'panel' }, [arama]));

	if (sorgu && sorgu.trim()) {
		const kutu = el('div', { class: 'panel' }, [
			el('div', { class: 'small', text: sonuclar.length
				? `${sonuclar.length} sonuç`
				: 'Sonuç yok. Başka bir kelime dene.' })
		]);
		for (const p of sonuclar) {
			const satir = phraseRow(p, handlers, { dim: p.direction === 'hear' });
			satir.appendChild(el('span', { class: 'emSource', text: p.direction === 'hear'
				? p.source + ' · duyabileceğin'
				: p.source }));
			kutu.appendChild(satir);
		}
		host.appendChild(kutu);
		// Arama sirasinda liste gosterilmiyor: iki liste arasinda
		// kaydirmak panik anında zaman kaybettiriyor.
		return;
	}

	// --- En kritik cümleler ---
	const kritik = el('div', { class: 'panel emCritical' }, [
		el('h3', { text: '⚠️ Her durumda işe yarar' })
	]);
	for (const p of pack.critical || []) kritik.appendChild(phraseRow(p, handlers));
	host.appendChild(kritik);

	// --- Durumlar ---
	const izgara = el('div', { class: 'dlgGrid' });
	for (const s of handlers.summaries || []) {
		const kart = el('button', { class: 'dlgCard' }, [
			el('span', { class: 'dlgIcon', text: s.icon }),
			el('span', { class: 'dlgTitle', text: s.title }),
			el('span', { class: 'dlgSummary', text: s.summary }),
			el('div', { class: 'dlgMeta' }, [
				el('span', { class: 'dlgLines', text: s.count + ' cümle' })
			])
		]);
		kart.onclick = () => handlers.onOpen(s.id);
		izgara.appendChild(kart);
	}
	host.appendChild(izgara);
}

/** Bir durumun cümleleri. */
export function renderSituation(situation, handlers) {
	const host = $('emergencyView');
	if (!host || !situation) return;
	host.textContent = '';

	const geri = el('button', { class: 'ghost', text: '← Acil İngilizce' });
	geri.onclick = handlers.onBackToList;
	host.appendChild(el('div', { class: 'dlgHead' }, [geri]));

	host.appendChild(el('div', { class: 'sectionIntro' }, [
		el('h2', { text: `${situation.icon} ${situation.title}` }),
		el('p', { class: 'small', text: situation.summary })
	]));

	const soyle = el('div', { class: 'panel' }, [el('h3', { text: '🗣️ Sen söyle' })]);
	for (const p of situation.say || []) soyle.appendChild(phraseRow(p, handlers));
	host.appendChild(soyle);

	if ((situation.hear || []).length) {
		const duy = el('div', { class: 'panel' }, [
			el('h3', { text: '👂 Duyabileceklerin' }),
			el('div', { class: 'small', text:
				'Asıl panik, karşıdakinin cevabını anlamamaktan çıkıyor. '
				+ 'Bu cümleleri önceden okumak işe yarıyor.' })
		]);
		for (const p of situation.hear) duy.appendChild(phraseRow(p, handlers, { dim: true }));
		host.appendChild(duy);
	}
}

/**
 * Gösterim ekranı: cümleyi büyük yazıyla karşıdakine göster.
 *
 * Ayrı bir katman olarak açılıyor, alttaki sekme çubuğunun da üstünde:
 * telefonu birine uzatırken yanlışlıkla başka bir sekmeye basılmasın.
 */
export function renderShowOverlay(phrase, onClose) {
	const eski = document.getElementById('emShowOverlay');
	if (eski) eski.remove();
	if (!phrase) return;

	const kapat = el('button', { class: 'ghost', text: 'Kapat' });
	const kok = el('div', { class: 'emOverlay' }, [
		el('div', { class: 'emOverlayBox' }, [
			el('div', { class: 'emOverlayEn', text: phrase.en }),
			el('div', { class: 'emOverlayTr', text: phrase.tr }),
			kapat
		])
	]);
	kok.id = 'emShowOverlay';
	kapat.onclick = () => { kok.remove(); onClose?.(); };
	// Arka plana dokunmak da kapatiyor; telefonu geri alan kullanici
	// kucuk bir dugmeyi aramamali.
	kok.onclick = (e) => { if (e.target === kok) { kok.remove(); onClose?.(); } };
	document.body.appendChild(kok);
}
