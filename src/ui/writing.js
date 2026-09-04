/**
 * Yazma ve e-posta alıştırmaları.
 *
 * Tek dosya iki bölüme hizmet ediyor (Yazma ve E-posta); akış aynı,
 * yalnızca içerik dosyası ve başlık değişiyor. `host` kimliği dışarıdan
 * geliyor.
 *
 * Kullanıcıya verilen geri bildirimin sınırı arayüzde açıkça yazıyor:
 * kontrol uzunluğa, istenen ögelere ve kalıplaşmış hatalara bakar,
 * anlamı değerlendirmez. Bunu gizleyip bir puan göstermek, öğrenciye
 * yazdığı metnin iyi olduğunu düşündürür.
 */

import { checkWriting } from '../core/writing.js';
import { $, el } from './dom.js';

/** Görev listesi. */
export function renderTaskList(hostId, baslik, altBaslik, ozetler, handlers) {
	const host = $(hostId);
	if (!host) return;
	host.textContent = '';

	const geri = el('button', { class: 'ghost', text: '← Öğren' });
	geri.onclick = handlers.onBack;
	host.appendChild(el('div', { class: 'dlgHead' }, [geri]));

	host.appendChild(el('div', { class: 'sectionIntro' }, [
		el('h2', { text: baslik }),
		el('p', { class: 'small', text: altBaslik })
	]));

	const izgara = el('div', { class: 'dlgGrid' });
	for (const t of ozetler) {
		const kart = el('button', { class: 'dlgCard' + (t.unlocked ? '' : ' dlgCard--locked') }, [
			el('span', { class: 'dlgIcon', text: t.done ? '✅' : t.icon }),
			el('span', { class: 'dlgTitle', text: t.title }),
			el('span', { class: 'dlgSummary', text: t.summary }),
			el('div', { class: 'dlgMeta' }, [
				el('span', { class: 'cefr cefr--' + t.level, text: t.level }),
				el('span', { class: 'dlgLines', text: `${t.minWords}+ kelime` }),
				t.unlocked ? null : el('span', { class: 'lockBadge', text: '🔒' })
			].filter(Boolean))
		]);
		kart.onclick = () => (t.unlocked ? handlers.onOpen(t.id) : handlers.onLocked());
		izgara.appendChild(kart);
	}
	host.appendChild(izgara);
}

/**
 * Görev ekranı: yönerge, öğretim notu, kalıplar ve yazma alanı.
 *
 * Örnek cevap yazmadan ÖNCE gösterilmiyor. Görmek kopyalamayı davet
 * ediyor ve alıştırma üretim değil taklit alıştırmasına dönüşüyor.
 */
export function renderTask(hostId, task, taslak, handlers) {
	const host = $(hostId);
	if (!host || !task) return;
	host.textContent = '';

	const geri = el('button', { class: 'ghost', text: '← Görevler' });
	geri.onclick = handlers.onBackToList;
	host.appendChild(el('div', { class: 'dlgHead' }, [
		geri,
		el('span', { class: 'cefr cefr--' + task.level, text: task.level })
	]));

	host.appendChild(el('div', { class: 'sectionIntro' }, [
		el('h2', { text: `${task.icon} ${task.title}` }),
		el('p', { class: 'writePrompt', text: task.prompt })
	]));

	if (task.teach) {
		const noktalar = el('ul', { class: 'writeTeach' });
		for (const p of task.teach.points || []) noktalar.appendChild(el('li', { text: p }));
		host.appendChild(el('details', { class: 'panel writePanel', attrs: { open: '' } }, [
			el('summary', { text: '💡 ' + task.teach.title }),
			noktalar
		]));
	}

	if ((task.phrases || []).length) {
		const liste = el('div', { class: 'writePhrases' });
		for (const f of task.phrases) {
			liste.appendChild(el('div', { class: 'writePhrase' }, [
				el('span', { class: 'writePhraseEn', text: f.en }),
				el('span', { class: 'writePhraseTr', text: f.tr })
			]));
		}
		host.appendChild(el('details', { class: 'panel writePanel' }, [
			el('summary', { text: '🧩 İşine yarayacak kalıplar' }),
			liste
		]));
	}

	const alan = el('textarea', {
		class: 'writeArea',
		attrs: { rows: '10', placeholder: 'Cevabını buraya İngilizce yaz...' }
	});
	alan.value = taslak || '';

	const sayac = el('div', { class: 'writeCounter small' });
	const gunle = () => {
		const n = alan.value.trim().split(/\s+/).filter(Boolean).length;
		const az = n < (task.minWords || 0);
		const cok = task.maxWords && n > task.maxWords;
		sayac.textContent = `${n} kelime — hedef ${task.minWords}`
			+ (task.maxWords ? `–${task.maxWords}` : '+');
		sayac.className = 'writeCounter small' + (az || cok ? ' writeCounter--off' : ' writeCounter--ok');
	};
	// `input` her tusta kaydediyor; taslak kaybi bu ekranda en can
	// sikici hata, kullanici 150 kelime yazip sekme degistirebiliyor.
	alan.addEventListener('input', () => { gunle(); handlers.onDraft(task.id, alan.value); });
	gunle();

	host.appendChild(el('div', { class: 'panel' }, [alan, sayac]));

	const kontrol = el('button', { class: 'primary', text: '🔍 Kontrol et' });
	kontrol.onclick = () => handlers.onCheck(task.id, alan.value);
	host.appendChild(el('div', { class: 'dlgFinishActions' }, [kontrol]));
}

/** Kontrol sonucu ve örnek cevap. */
export function renderCheck(hostId, task, metin, handlers) {
	const host = $(hostId);
	if (!host || !task) return;
	host.textContent = '';

	const r = checkWriting(task, metin);

	const geri = el('button', { class: 'ghost', text: '← Yazmaya dön' });
	geri.onclick = () => handlers.onBackToTask(task.id);
	host.appendChild(el('div', { class: 'dlgHead' }, [
		geri,
		el('span', { class: 'cefr cefr--' + task.level, text: task.level })
	]));

	host.appendChild(el('div', { class: 'panel writeStats' }, [
		el('div', { class: 'writeStat' }, [
			el('span', { class: 'writeStatNum', text: String(r.words) }),
			el('span', { class: 'small', text: 'kelime' })
		]),
		el('div', { class: 'writeStat' }, [
			el('span', { class: 'writeStatNum', text: String(r.sentences) }),
			el('span', { class: 'small', text: 'cümle' })
		]),
		el('div', { class: 'writeStat' }, [
			el('span', { class: 'writeStatNum', text: String(r.avgSentence) }),
			el('span', { class: 'small', text: 'ort. uzunluk' })
		])
	]));

	if (r.avgSentence > 25) {
		host.appendChild(el('div', { class: 'writeNote' , text:
			'Cümlelerin ortalama ' + r.avgSentence + ' kelime. Uzun cümle '
			+ 'yanlış yapma ihtimalini artırıyor; birkaçını ikiye bölmeyi dene.' }));
	}

	const uzunlukSatiri = el('div', { class: 'checkItem ' + (r.lengthOk ? 'ok' : 'bad') }, [
		el('span', { text: r.lengthOk ? '✓' : '✗' }),
		el('span', {
			text: r.lengthOk
				? 'Uzunluk uygun'
				: r.words < r.min
					? `Çok kısa — en az ${r.min} kelime gerekiyor`
					: `Çok uzun — en fazla ${r.max} kelime`
		})
	]);

	const liste = el('div', { class: 'panel checkList' }, [
		el('div', { class: 'small', text: 'İstenen ögeler' }),
		uzunlukSatiri,
		...r.required.map((c) => el('div', { class: 'checkItem ' + (c.ok ? 'ok' : 'bad') }, [
			el('span', { text: c.ok ? '✓' : '✗' }),
			el('span', { text: c.label })
		]))
	]);
	host.appendChild(liste);

	if (r.mistakes.length) {
		const hatalar = el('div', { class: 'panel checkList' }, [
			el('div', { class: 'small', text: 'Sık yapılan hatalar' })
		]);
		for (const h of r.mistakes) {
			hatalar.appendChild(el('div', { class: 'mistakeItem' }, [
				el('div', { class: 'mistakeTop' }, [
					el('code', { class: 'mistakeBad', text: h.ornek || '—' }),
					h.dogru ? el('span', { class: 'mistakeArrow', text: '→' }) : null,
					h.dogru ? el('code', { class: 'mistakeGood', text: h.dogru }) : null,
					h.adet > 1 ? el('span', { class: 'mistakeCount', text: `×${h.adet}` }) : null
				].filter(Boolean)),
				el('div', { class: 'small', text: h.not })
			]));
		}
		host.appendChild(hatalar);
	} else if (r.words > 0) {
		host.appendChild(el('div', { class: 'writeNote', text: '🎯 Bilinen kalıp hatalarından hiçbiri yok.' }));
	}

	// Ornek cevap ancak burada aciliyor. Sinir aciklikla soyleniyor:
	// bu kontrol anlami olcmuyor, karsilastirmayi kullanici yapiyor.
	host.appendChild(el('div', { class: 'writeNote writeNote--limit', text:
		'Bu kontrol yazım kurallarına ve istenen ögelere bakar; '
		+ 'anlamı ve üslubu değerlendiremez. Kendi cevabını örnekle '
		+ 'karşılaştırmak en iyi geri bildirim.' }));

	const ornek = el('div', { class: 'writeModel' });
	for (const par of String(task.model || '').split(/\n+/).filter(Boolean)) {
		ornek.appendChild(el('p', { class: 'writeModelPara', text: par }));
	}
	host.appendChild(el('details', { class: 'panel writePanel' }, [
		el('summary', { text: '📄 Örnek cevabı göster' }),
		ornek
	]));

	const tamam = el('button', {
		class: r.ready ? 'primary' : 'ghost',
		text: r.ready ? '✅ Tamamlandı say' : 'Eksikleri tamamla'
	});
	tamam.disabled = !r.ready;
	tamam.onclick = () => handlers.onDone(task.id);

	const duzelt = el('button', { class: 'ghost', text: 'Düzeltmeye dön' });
	duzelt.onclick = () => handlers.onBackToTask(task.id);

	host.appendChild(el('div', { class: 'dlgFinishActions' }, [duzelt, tamam]));
}
