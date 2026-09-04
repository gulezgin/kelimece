/**
 * Sınav modu arayüzü.
 *
 * Her ekranın başında sınırın yazılı olması bilinçli: bu mod puan
 * vermiyor ve bunu kullanıcıdan saklamak, sınava hazır olduğunu sanan
 * birinin sınav ücretini kaybetmesi demek.
 *
 * Yazma görevleri `ui/writing.js` ekranlarını kullanıyor; burada
 * yalnızca liste, biçim anlatımı, konuşma sayacı ve kelime setleri var.
 */

import { $, el } from './dom.js';
import { formatClock, speakingPhases } from '../core/exam.js';

/** Sınav seçimi. */
export function renderExamList(ozetler, handlers) {
	const host = $('examView');
	if (!host) return;
	host.textContent = '';

	const geri = el('button', { class: 'ghost', text: '← Öğren' });
	geri.onclick = handlers.onBack;
	host.appendChild(el('div', { class: 'dlgHead' }, [geri]));

	host.appendChild(el('div', { class: 'sectionIntro' }, [
		el('h2', { text: '🎓 Sınav modu' }),
		el('p', { class: 'small', text: 'IELTS ve TOEFL için biçim, gerçek görevler ve süreli konuşma pratiği.' })
	]));

	host.appendChild(el('div', { class: 'writeNote writeNote--limit', text:
		'Bu mod PUAN VERMİYOR. Bant ya da TOEFL puanı eğitimli '
		+ 'değerlendiricilerin kararı; cihazda taklit edilemez. Burada '
		+ 'bulacakların: sınav biçimi, gerçek görev formatları, süreli '
		+ 'konuşma pratiği ve sınava özgü kelimeler.' }));

	const izgara = el('div', { class: 'dlgGrid' });
	for (const e of ozetler) {
		const kart = el('button', { class: 'dlgCard' }, [
			el('span', { class: 'dlgIcon', text: e.icon }),
			el('span', { class: 'dlgTitle', text: e.name }),
			el('span', { class: 'dlgSummary', text: e.summary }),
			el('div', { class: 'dlgMeta' }, [
				el('span', { class: 'kpill', text: e.scale }),
				el('span', { class: 'dlgLines', text: `${e.writing} yazma · ${e.speaking} konuşma` })
			])
		]);
		kart.onclick = () => handlers.onOpenExam(e.id);
		izgara.appendChild(kart);
	}
	host.appendChild(izgara);
}

/** Bir sınavın ana ekranı: biçim, görevler, kelimeler. */
export function renderExam(content, kilitli, handlers) {
	const host = $('examView');
	if (!host || !content) return;
	host.textContent = '';
	const { exam, writing, speaking, vocabulary } = content;

	const geri = el('button', { class: 'ghost', text: '← Sınavlar' });
	geri.onclick = handlers.onBackToExams;
	host.appendChild(el('div', { class: 'dlgHead' }, [geri]));

	host.appendChild(el('div', { class: 'sectionIntro' }, [
		el('h2', { text: `${exam.icon} ${exam.name}` }),
		el('p', { class: 'small', text: `${exam.summary} · ${exam.scale}` })
	]));

	// --- Biçim ---
	const bicim = el('div', { class: 'examParts' });
	for (const p of exam.format || []) {
		bicim.appendChild(el('div', { class: 'examPart' }, [
			el('div', { class: 'examPartHead' }, [
				el('span', { class: 'examPartName', text: p.part }),
				el('span', { class: 'kpill', text: p.time })
			]),
			el('div', { class: 'small', text: p.detail })
		]));
	}
	host.appendChild(el('details', { class: 'panel writePanel', attrs: { open: '' } }, [
		el('summary', { text: '📋 Sınav biçimi' }),
		bicim
	]));

	// --- İpuçları ---
	const ipuclari = el('ul', { class: 'writeTeach' });
	for (const t of exam.tips || []) ipuclari.appendChild(el('li', { text: t }));
	host.appendChild(el('details', { class: 'panel writePanel' }, [
		el('summary', { text: '💡 Bilinmesi gerekenler' }),
		ipuclari
	]));

	// --- Yazma görevleri ---
	if (writing.length) {
		const liste = el('div', { class: 'dlgGrid' });
		for (const w of writing) {
			const acik = !kilitli.has(w.id);
			const kart = el('button', { class: 'dlgCard' + (acik ? '' : ' dlgCard--locked') }, [
				el('span', { class: 'dlgIcon', text: w.icon }),
				el('span', { class: 'dlgTitle', text: w.title }),
				el('span', { class: 'dlgSummary', text: w.summary }),
				el('div', { class: 'dlgMeta' }, [
					el('span', { class: 'cefr cefr--' + w.level, text: w.level }),
					el('span', { class: 'dlgLines', text: `${w.minWords}+ kelime` }),
					acik ? null : el('span', { class: 'lockBadge', text: '🔒' })
				].filter(Boolean))
			]);
			kart.onclick = () => (acik ? handlers.onOpenWriting(w.id) : handlers.onLocked());
			liste.appendChild(kart);
		}
		host.appendChild(el('section', { class: 'panel' }, [
			el('h3', { text: '✍️ Yazma görevleri' }), liste
		]));
	}

	// --- Konuşma görevleri ---
	if (speaking.length) {
		const liste = el('div', { class: 'dlgGrid' });
		for (const s of speaking) {
			const kart = el('button', { class: 'dlgCard' }, [
				el('span', { class: 'dlgIcon', text: s.icon }),
				el('span', { class: 'dlgTitle', text: s.title }),
				el('span', { class: 'dlgSummary', text: s.part }),
				el('div', { class: 'dlgMeta' }, [
					el('span', { class: 'kpill', text: formatClock(s.talkSeconds) }),
					el('span', { class: 'dlgLines', text: `${s.prepSeconds} sn hazırlık` })
				])
			]);
			kart.onclick = () => handlers.onOpenSpeaking(s.id);
			liste.appendChild(kart);
		}
		host.appendChild(el('section', { class: 'panel' }, [
			el('h3', { text: '🎙️ Konuşma görevleri' }), liste
		]));
	}

	// --- Kelime setleri ---
	if (vocabulary.length) {
		const liste = el('div', { class: 'dlgGrid' });
		for (const v of vocabulary) {
			const kart = el('button', { class: 'dlgCard' }, [
				el('span', { class: 'dlgIcon', text: v.icon }),
				el('span', { class: 'dlgTitle', text: v.title }),
				el('span', { class: 'dlgSummary', text: v.summary }),
				el('div', { class: 'dlgMeta' }, [
					el('span', { class: 'dlgLines', text: v.words.length + ' kelime' })
				])
			]);
			kart.onclick = () => handlers.onOpenVocab(v.id);
			liste.appendChild(kart);
		}
		host.appendChild(el('section', { class: 'panel' }, [
			el('h3', { text: '📚 Sınav kelimeleri' }), liste
		]));
	}
}

/** Kelime seti ekranı. */
export function renderVocabSet(set, handlers) {
	const host = $('examView');
	if (!host || !set) return;
	host.textContent = '';

	const geri = el('button', { class: 'ghost', text: '← Sınav' });
	geri.onclick = handlers.onBackToExam;
	host.appendChild(el('div', { class: 'dlgHead' }, [geri]));

	host.appendChild(el('div', { class: 'sectionIntro' }, [
		el('h2', { text: `${set.icon} ${set.title}` }),
		el('p', { class: 'small', text: set.summary })
	]));

	const ekle = el('button', { class: 'primary', text: '📋 Listeme ekle' });
	ekle.onclick = () => handlers.onAddToList(set.id);
	host.appendChild(el('div', { class: 'dlgFinishActions' }, [ekle]));

	const kutu = el('div', { class: 'panel' });
	for (const w of set.words) {
		const ses = el('button', { class: 'speakBtn speakBtn--sm', text: '🔊', title: 'Telaffuzu dinle' });
		ses.onclick = () => handlers.onSpeak(w.en);
		kutu.appendChild(el('div', { class: 'listRow' }, [
			el('div', { class: 'listRowText' }, [
				el('span', { class: 'antEn', text: w.en }),
				el('span', { class: 'antTr', text: w.tr })
			]),
			ses
		]));
	}
	host.appendChild(kutu);

	host.appendChild(el('div', { class: 'writeNote', text:
		'Bu kelimeler havuzda varsa listene eklenir. Havuzda olmayanlar '
		+ 'atlanır — liste kimlik tutuyor, tanım kopyalamıyor.' }));
}

/**
 * Konuşma görevi: sayaç ve kayıt.
 *
 * Durum (`run`) dışarıdan geliyor; sayaç `setInterval` ile ilerliyor
 * ve her saniye tüm ekranı yeniden çizmek kayıt düğmesinin
 * odağını kaybettirirdi. Bu yüzden yalnızca saat metni güncelleniyor.
 */
export function renderSpeakingTask(task, run, handlers) {
	const host = $('examView');
	if (!host || !task) return;
	host.textContent = '';

	const geri = el('button', { class: 'ghost', text: '← Sınav' });
	geri.onclick = handlers.onBackToExam;
	host.appendChild(el('div', { class: 'dlgHead' }, [
		geri,
		el('span', { class: 'kpill', text: task.part })
	]));

	host.appendChild(el('div', { class: 'sectionIntro' }, [
		el('h2', { text: `${task.icon} ${task.title}` })
	]));

	host.appendChild(el('div', { class: 'panel examCue' }, [
		el('div', { class: 'examCueText', text: task.cue }),
		el('ul', { class: 'writeTeach' }, (task.points || []).map((p) => el('li', { text: p })))
	]));

	// --- Sayaç ---
	const asamalar = speakingPhases(task);
	const aktif = asamalar[run.phase] || asamalar[asamalar.length - 1];
	const saat = el('div', { class: 'examClock', text: formatClock(run.left) });
	saat.id = 'examClock';
	const asamaAd = el('div', { class: 'small', text: aktif ? aktif.label : '' });

	const baslat = el('button', {
		class: run.running ? 'ghost' : 'primary',
		text: run.running ? '⏹ Durdur' : (run.started ? '▶ Devam' : '▶ Başlat')
	});
	baslat.onclick = () => (run.running ? handlers.onPause() : handlers.onStart());

	const sifirla = el('button', { class: 'ghost', text: '↺ Baştan' });
	sifirla.onclick = handlers.onReset;

	host.appendChild(el('div', { class: 'panel examTimer' }, [
		asamaAd, saat,
		el('div', { class: 'dlgFinishActions' }, [baslat, sifirla])
	]));

	// --- Kayıt ---
	if (handlers.recordSupported) {
		const kayit = el('button', {
			class: run.recording ? 'bad' : 'good',
			text: run.recording ? '⏺ Kaydı bitir' : '🎤 Kaydet'
		});
		kayit.onclick = () => (run.recording ? handlers.onStopRecord() : handlers.onStartRecord());

		const kutu = el('div', { class: 'panel' }, [
			el('h3', { text: '🎤 Kendini dinle' }),
			el('div', { class: 'small', text:
				'Kayıt yalnızca bu cihazda kalır; hiçbir yere gönderilmez. '
				+ 'Telaffuz puanı verilmiyor — kendi kaydını dinlemek, '
				+ 'konuşurken fark etmediğin duraksamaları duymanı sağlıyor.' }),
			el('div', { class: 'dlgFinishActions' }, [kayit])
		]);

		if (run.audioUrl) {
			const oynatici = document.createElement('audio');
			oynatici.controls = true;
			oynatici.src = run.audioUrl;
			oynatici.className = 'examAudio';
			kutu.appendChild(oynatici);
			kutu.appendChild(el('div', { class: 'small', text: `Kayıt süresi: ${formatClock(run.audioSeconds)}` }));
		}
		if (run.recordError) {
			kutu.appendChild(el('div', { class: 'writeNote', text: run.recordError }));
		}
		host.appendChild(kutu);
	}

	if ((task.hints || []).length) {
		const ipuclari = el('ul', { class: 'writeTeach' });
		for (const h of task.hints) ipuclari.appendChild(el('li', { text: h }));
		host.appendChild(el('details', { class: 'panel writePanel' }, [
			el('summary', { text: '💡 İpuçları' }), ipuclari
		]));
	}
}

/** Yalnızca saat metnini günceller — tüm ekranı çizmeden. */
export function updateClock(seconds) {
	const node = $('examClock');
	if (node) node.textContent = formatClock(seconds);
}
