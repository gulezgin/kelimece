/**
 * Zıt anlamlılar: liste ve tur.
 *
 * Liste ekranı önce geliyor. Sınamadan önce görmek gerekiyor — bilmediği
 * bir listeden sınav olan kullanıcı öğrenmiyor, yalnızca yanlış yapıyor.
 *
 * Tur durumu (`run`) `main.js`'ten geliyor; gerekçesi `grammar.js`
 * içindeki `renderQuiz` ile aynı.
 */

import { $, el } from './dom.js';
import { gradeRound } from '../core/antonyms.js';

/** Seviyelere ayrılmış çift listesi. */
export function renderAntonymList(gruplar, kilitliVar, handlers) {
	const host = $('antonymsView');
	if (!host) return;
	host.textContent = '';

	const geri = el('button', { class: 'ghost', text: '← Öğren' });
	geri.onclick = handlers.onBack;
	host.appendChild(el('div', { class: 'dlgHead' }, [geri]));

	host.appendChild(el('div', { class: 'sectionIntro' }, [
		el('h2', { text: '↔️ Zıt anlamlılar' }),
		el('p', { class: 'small', text: 'Önce listeye bak, sonra turu başlat.' })
	]));

	const basla = el('button', { class: 'primary', text: '🎯 10 soruluk tur başlat' });
	basla.onclick = handlers.onStartRound;
	host.appendChild(el('div', { class: 'dlgFinishActions' }, [basla]));

	for (const g of gruplar) {
		const kutu = el('div', { class: 'panel antGroup' }, [
			el('div', { class: 'antGroupHead' }, [
				el('span', { class: 'cefr cefr--' + g.level, text: g.level }),
				el('span', { class: 'small', text: g.pairs.length + ' çift' })
			])
		]);

		for (const p of g.pairs) {
			const satir = el('div', { class: 'antRow' + (p.unlocked ? '' : ' antRow--locked') }, [
				el('div', { class: 'antSide' }, [
					el('span', { class: 'antEn', text: p.unlocked ? p.a.en : '•••' }),
					el('span', { class: 'antTr', text: p.unlocked ? p.a.tr : '' })
				]),
				el('span', { class: 'antArrow', text: p.unlocked ? '↔' : '🔒' }),
				el('div', { class: 'antSide antSide--right' }, [
					el('span', { class: 'antEn', text: p.unlocked ? p.b.en : '•••' }),
					el('span', { class: 'antTr', text: p.unlocked ? p.b.tr : '' })
				])
			]);
			if (p.unlocked) {
				satir.onclick = () => handlers.onSpeak(p.a.en + ', ' + p.b.en);
				satir.classList.add('antRow--tappable');
			} else {
				satir.onclick = handlers.onLocked;
			}
			kutu.appendChild(satir);
		}
		host.appendChild(kutu);
	}

	if (kilitliVar) {
		host.appendChild(el('div', { class: 'writeNote', text:
			'B1 ve üstü çiftler abonelikle açılıyor.' }));
	}
}

/** Tur ekranı. */
export function renderAntonymRound(run, handlers) {
	const host = $('antonymsView');
	if (!host || !run) return;

	const sorular = run.questions || [];

	function ciz() {
		host.textContent = '';

		const cik = el('button', { class: 'ghost', text: '← Listeye dön' });
		cik.onclick = handlers.onBackToList;
		host.appendChild(el('div', { class: 'dlgHead' }, [
			cik,
			el('span', { class: 'dlgProgress', text: `${run.index} / ${sorular.length}` })
		]));

		if (run.index >= sorular.length) {
			host.appendChild(sonuc());
			return;
		}

		const q = sorular[run.index];
		const kutu = el('div', { class: 'panel quizBox' }, [
			el('div', { class: 'small', text: 'Zıttı hangisi?' }),
			el('div', { class: 'antPrompt' }, [
				el('span', { class: 'antPromptEn', text: q.prompt.en }),
				el('span', { class: 'antPromptTr', text: q.prompt.tr })
			]),
			el('span', { class: 'cefr cefr--' + q.level, text: q.level })
		]);

		const secenekler = el('div', { class: 'exerciseOptions' });
		const geri = el('div', { class: 'quizFeedback hidden' });

		q.options.forEach((o, i) => {
			const btn = el('button', { class: 'exOption' }, [
				el('span', { class: 'exKey', text: String(i + 1) }),
				el('span', { text: o.en })
			]);
			btn.onclick = () => {
				if (run.answers[run.index] !== undefined) return;
				run.answers[run.index] = i;
				const dogru = i === q.answerIndex;

				for (const b of secenekler.querySelectorAll('button')) b.disabled = true;
				btn.classList.add(dogru ? 'exOption--ok' : 'exOption--bad');
				if (!dogru) secenekler.querySelectorAll('button')[q.answerIndex].classList.add('exOption--ok');

				// Turkce karsilik yalnizca cevaptan SONRA gosteriliyor;
				// sikta gorunse soru anlam degil eslestirme sorusu olurdu.
				geri.className = 'quizFeedback ' + (dogru ? 'ok' : 'bad');
				geri.textContent = (dogru ? '✓ ' : '✗ ') + q.prompt.en + ' ↔ '
					+ q.answer.en + ' (' + q.answer.tr + ')';
				geri.classList.remove('hidden');

				handlers.onSpeak(q.prompt.en + ', ' + q.answer.en);

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

	/** Puanlama çizim dışında; gerekçe `grammar.js` içinde. */
	function puanla() {
		if (!run.scored) {
			run.scored = true;
			handlers.onFinished(gradeRound(sorular, run.answers));
		}
		ciz();
	}

	function sonuc() {
		const r = gradeRound(sorular, run.answers);
		const yanlislar = r.detay.filter((d) => !d.ok);

		const tekrar = el('button', { class: 'primary', text: 'Yeni tur' });
		tekrar.onclick = handlers.onStartRound;
		const bitir = el('button', { class: 'ghost', text: 'Listeye dön' });
		bitir.onclick = handlers.onBackToList;

		// Yanlislar aciklamasiyla tekrar gosteriliyor: tur bitince
		// "neyi bilmiyordum" sorusu cevapsiz kalmamali.
		const liste = yanlislar.length
			? el('div', { class: 'quizReview' }, [
				el('div', { class: 'small', text: 'Yanlış cevapladıkların:' }),
				...yanlislar.map((d) => el('div', { class: 'quizReviewItem' }, [
					el('div', { class: 'quizReviewQ', text: d.prompt.en + ' (' + d.prompt.tr + ')' }),
					el('div', { class: 'quizReviewA', text: '✓ ' + d.answer.en + ' — ' + d.answer.tr }),
					d.chosen ? el('div', { class: 'small', text: 'Senin cevabın: ' + d.chosen.en }) : null
				].filter(Boolean)))
			])
			: null;

		return el('div', { class: 'dlgFinish' }, [
			el('div', { class: 'dlgFinishIcon', text: r.score >= 70 ? '🎉' : '↔️' }),
			el('div', { class: 'dlgFinishTitle', text: `${r.correct} / ${r.total} doğru` }),
			liste,
			el('div', { class: 'dlgFinishActions' }, [bitir, tekrar])
		].filter(Boolean));
	}

	ciz();
}
