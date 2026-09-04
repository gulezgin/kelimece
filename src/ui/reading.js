/**
 * Okuma ekranı: parça listesi, okuyucu ve anlama soruları.
 *
 * Metindeki her kelime tıklanabilir — havuzda karşılığı olanlar altı
 * noktalı çizgiyle işaretli. Bilinmeyen kelimeye dokunup anlamı
 * görmek, sözlüğe gitmek için okumayı bırakmaktan iyi.
 */
import { gradeComprehension, isTextPassed, textSummaries } from '../core/reading.js';
import { hasEnglishVoice, speak } from '../core/speech.js';
import { $, el } from './dom.js';
import { appendTappableWords } from './tappable.js';

/** Parça listesi. */
export function renderReadingList(texts, premium, doneIds, handlers) {
	const host = $('readingView');
	if (!host) return;
	host.textContent = '';

	const geri = el('button', { class: 'ghost backBtn', text: '← Öğren' });
	geri.onclick = handlers.onBack;
	host.appendChild(geri);

	const items = textSummaries(texts, premium, doneIds);
	host.appendChild(el('div', { class: 'sectionHead' }, [
		el('h2', { text: '📖 Okuma' }),
		el('div', {
			class: 'small',
			text: items.length
				? `${items.length} parça — hikâyeler ve makaleler, seviyeye göre.`
				: 'Parçalar yüklenemedi.'
		})
	]));
	if (!items.length) return;

	const grid = el('div', { class: 'dlgGrid' });
	for (const t of items) {
		const kart = el('button', {
			class: 'dlgCard' + (t.locked ? ' dlgCard--locked' : ''),
			title: t.locked ? 'Abonelikle açılır' : t.title
		}, [
			el('span', { class: 'dlgIcon', text: t.done ? '✅' : t.icon }),
			el('div', { class: 'dlgMeta' }, [
				el('span', { class: 'dlgTitle', text: t.title }),
				el('span', { class: 'dlgSummary', text: t.kind + ' · ' + t.summary })
			]),
			el('span', { class: 'cefr cefr--' + t.level, text: t.level }),
			el('span', { class: 'dlgLines', text: `${t.words} kelime` }),
			t.locked ? el('span', { class: 'dlgLock', text: '🔒' }) : null
		]);
		kart.onclick = () => (t.locked ? handlers.onLocked() : handlers.onOpen(t.id));
		grid.appendChild(kart);
	}
	host.appendChild(grid);
}

/** Okuyucu: metin ve sonunda sorulara geçiş. */
export function renderText(text, handlers, wordIndex) {
	const host = $('readingView');
	if (!host || !text) return;
	host.textContent = '';

	const geri = el('button', { class: 'ghost', text: '← Parçalar' });
	geri.onclick = handlers.onBackToList;
	host.appendChild(el('div', { class: 'dlgHead' }, [
		geri,
		el('span', { class: 'cefr cefr--' + text.level, text: text.level })
	]));

	host.appendChild(el('div', { class: 'sectionHead' }, [
		el('h2', { text: (text.icon || '📖') + ' ' + text.title }),
		el('div', { class: 'small', text: text.summary || '' })
	]));

	const govde = el('article', { class: 'panel readingBody' });
	for (const p of text.paragraphs || []) {
		const par = el('p', { class: 'readingPara' });
		appendTappableWords(par, p, wordIndex, handlers.onWord);
		if (hasEnglishVoice()) {
			const ses = el('button', { class: 'iconBtn readingSpeak', text: '🔊' });
			ses.setAttribute('aria-label', 'Paragrafı seslendir');
			ses.onclick = () => speak(p);
			par.appendChild(ses);
		}
		govde.appendChild(par);
	}
	host.appendChild(govde);

	host.appendChild(el('div', {
		class: 'small readingHint',
		text: 'Altı çizili kelimelere dokunarak anlamlarına bakabilirsin.'
	}));

	const basla = el('button', { class: 'primary', text: '🎯 Soruları cevapla' });
	basla.onclick = () => handlers.onStartQuiz(text.id);
	host.appendChild(basla);
}

/**
 * Anlama soruları.
 *
 * Sorular metin GÖRÜNMEDEN soruluyor; metne bakarak cevaplamak
 * anlamayı değil arama becerisini ölçer. Yanlışta doğru cevap
 * gösteriliyor çünkü burada ölçülen kural bilgisi değil, metni
 * anlayıp anlamadığın — açıklanacak bir kural yok.
 *
 * Quiz durumu (`run`) dışarıdan geliyor; gerekçesi `grammar.js`
 * içindeki `renderQuiz` ile aynı.
 */
export function renderComprehension(text, handlers, run) {
	const host = $('readingView');
	if (!host || !text || !run) return;

	const sorular = text.questions || [];
	const cevaplar = run.answers;

	function ciz() {
		host.textContent = '';

		const cik = el('button', { class: 'ghost', text: '← Metne dön' });
		cik.onclick = () => handlers.onBackToText(text.id);
		host.appendChild(el('div', { class: 'dlgHead' }, [
			cik,
			el('span', { class: 'dlgProgress', text: `${run.index} / ${sorular.length}` }),
			el('span', { class: 'cefr cefr--' + text.level, text: text.level })
		]));

		if (run.index >= sorular.length) {
			host.appendChild(sonuc());
			return;
		}

		const q = sorular[run.index];
		const kutu = el('div', { class: 'panel quizBox' }, [
			el('div', { class: 'quizQuestion', text: q.q })
		]);
		const secenekler = el('div', { class: 'exerciseOptions' });
		const geri = el('div', { class: 'quizFeedback hidden' });

		q.options.forEach((metin, i) => {
			const btn = el('button', { class: 'exOption' }, [
				el('span', { class: 'exKey', text: String(i + 1) }),
				el('span', { text: metin })
			]);
			btn.onclick = () => {
				if (cevaplar[run.index] !== undefined) return;
				cevaplar[run.index] = i;
				const dogru = i === q.answer;

				for (const b of secenekler.querySelectorAll('button')) b.disabled = true;
				btn.classList.add(dogru ? 'exOption--ok' : 'exOption--bad');
				if (!dogru) secenekler.querySelectorAll('button')[q.answer].classList.add('exOption--ok');

				geri.className = 'quizFeedback ' + (dogru ? 'ok' : 'bad');
				geri.textContent = dogru ? '✓ Doğru' : '✗ Doğrusu: ' + q.options[q.answer];
				geri.classList.remove('hidden');

				const devam = el('button', { class: 'primary', text: 'Devam' });
				devam.onclick = () => {
					run.index++;
					if (run.index >= sorular.length) puanla();
					else ciz();
				};
				geri.appendChild(el('div', { class: 'quizNext' }, [devam]));
			};
			secenekler.appendChild(btn);
		});

		kutu.appendChild(secenekler);
		kutu.appendChild(geri);
		host.appendChild(kutu);
	}

	/** Puanlama render'dan ayrı; gerekçe `grammar.js` içinde. */
	function puanla() {
		if (!run.scored) {
			run.scored = true;
			if (isTextPassed(gradeComprehension(text, cevaplar))) handlers.onPassed(text.id);
		}
		ciz();
	}

	function sonuc() {
		const r = gradeComprehension(text, cevaplar);
		const gecti = isTextPassed(r);

		const tekrarOku = el('button', { class: 'ghost', text: 'Metni tekrar oku' });
		tekrarOku.onclick = () => handlers.onBackToText(text.id);
		const bitir = el('button', { class: 'primary', text: 'Parçalara dön' });
		bitir.onclick = handlers.onBackToList;

		return el('div', { class: 'dlgFinish' }, [
			el('div', { class: 'dlgFinishIcon', text: gecti ? '🎉' : '📖' }),
			el('div', { class: 'dlgFinishTitle', text: `${r.correct} / ${r.total} doğru` }),
			el('div', {
				class: 'small',
				text: gecti
					? 'Metni anladın.'
					: 'Metni bir kez daha okumak işe yarayabilir.'
			}),
			el('div', { class: 'dlgFinishActions' }, [tekrarOku, bitir])
		]);
	}

	ciz();
}
