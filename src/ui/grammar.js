/**
 * Dilbilgisi ekranı: ders listesi, ders ve quiz.
 *
 * Açıklama okunup geçilen bir ders öğretmiyor; bu yüzden her dersin
 * sonunda quiz var ve ders ancak quiz geçilince tamamlanmış sayılıyor.
 *
 * Yanlış cevapta doğrusu DEĞİL, önce NEDEN yanlış olduğu gösteriliyor.
 */
import { gradeQuiz, isLessonPassed, lessonSummaries } from '../core/grammar.js';
import { hasEnglishVoice, speak } from '../core/speech.js';
import { $, el } from './dom.js';

/** Ders listesi. */
export function renderGrammarList(lessons, premium, doneIds, handlers) {
	const host = $('grammarView');
	if (!host) return;
	host.textContent = '';

	const geri = el('button', { class: 'ghost backBtn', text: '← Öğren' });
	geri.onclick = handlers.onBack;
	host.appendChild(geri);

	const items = lessonSummaries(lessons, premium, doneIds);
	host.appendChild(el('div', { class: 'sectionHead' }, [
		el('h2', { text: '📐 Dilbilgisi' }),
		el('div', {
			class: 'small',
			text: items.length
				? `${items.length} ders — her dersin sonunda kısa bir quiz var.`
				: 'Dersler yüklenemedi.'
		})
	]));
	if (!items.length) return;

	const grid = el('div', { class: 'dlgGrid' });
	for (const l of items) {
		const kart = el('button', {
			class: 'dlgCard' + (l.locked ? ' dlgCard--locked' : ''),
			title: l.locked ? 'Abonelikle açılır' : l.title
		}, [
			el('span', { class: 'dlgIcon', text: l.done ? '✅' : l.icon }),
			el('div', { class: 'dlgMeta' }, [
				el('span', { class: 'dlgTitle', text: l.title }),
				el('span', { class: 'dlgSummary', text: l.summary })
			]),
			el('span', { class: 'cefr cefr--' + l.level, text: l.level }),
			el('span', { class: 'dlgLines', text: l.quizCount + ' soru' }),
			l.locked ? el('span', { class: 'dlgLock', text: '🔒' }) : null
		]);
		kart.onclick = () => (l.locked ? handlers.onLocked() : handlers.onOpen(l.id));
		grid.appendChild(kart);
	}
	host.appendChild(grid);
}

/** Tek ders: açıklama, kurallar, örnekler ve quize giriş. */
export function renderLesson(lesson, handlers) {
	const host = $('grammarView');
	if (!host || !lesson) return;
	host.textContent = '';

	const geri = el('button', { class: 'ghost', text: '← Dersler' });
	geri.onclick = handlers.onBackToList;
	host.appendChild(el('div', { class: 'dlgHead' }, [
		geri,
		el('span', { class: 'cefr cefr--' + lesson.level, text: lesson.level })
	]));

	host.appendChild(el('div', { class: 'sectionHead' }, [
		el('h2', { text: (lesson.icon || '📐') + ' ' + lesson.title }),
		el('div', { class: 'small', text: lesson.summary || '' })
	]));

	host.appendChild(el('div', { class: 'panel grammarExplain', text: lesson.explain }));

	if ((lesson.rules || []).length) {
		host.appendChild(el('div', { class: 'panel' }, [
			el('h2', { text: '📌 Kurallar' }),
			el('ul', { class: 'ruleList' }, lesson.rules.map((r) => el('li', { text: r })))
		]));
	}

	const ornekler = el('div', { class: 'panel' }, [el('h2', { text: '💬 Örnekler' })]);
	for (const e of lesson.examples || []) {
		const satir = el('div', { class: 'grammarExample' }, [
			el('div', { class: 'grammarEn', text: e.en }),
			el('div', { class: 'grammarTr', text: e.tr })
		]);
		if (hasEnglishVoice()) {
			const ses = el('button', { class: 'iconBtn', text: '🔊' });
			ses.setAttribute('aria-label', 'Örneği seslendir');
			ses.onclick = () => speak(e.en);
			satir.appendChild(ses);
		}
		ornekler.appendChild(satir);
	}
	host.appendChild(ornekler);

	const basla = el('button', { class: 'primary', text: '🎯 Quize başla' });
	basla.onclick = () => handlers.onStartQuiz(lesson.id);
	host.appendChild(basla);
}

/**
 * Quiz: soruları tek tek sorar, cevaptan sonra açıklamayı gösterir.
 *
 * Doğru cevabı hemen göstermek yerine önce NEDEN yanlış olduğunu
 * söylüyor; kural anlaşılmadan doğru şıkkı görmek ezber üretir.
 *
 * Quiz durumu (`run`) dışarıdan geliyor, closure'da tutulmuyor. Sebep:
 * herhangi bir depo yazımı `emit()` -> `render()` zincirini tetikliyor
 * ve bu fonksiyon baştan çağrılıyor; durum içeride olsaydı kullanıcı
 * quizin ortasında birinci soruya geri dönerdi.
 */
export function renderQuiz(lesson, handlers, run) {
	const host = $('grammarView');
	if (!host || !lesson || !run) return;

	const sorular = lesson.quiz || [];
	const cevaplar = run.answers;

	function ciz() {
		host.textContent = '';

		const cik = el('button', { class: 'ghost', text: '← Derse dön' });
		cik.onclick = () => handlers.onBackToLesson(lesson.id);
		host.appendChild(el('div', { class: 'dlgHead' }, [
			cik,
			el('span', { class: 'dlgProgress', text: `${run.index} / ${sorular.length}` }),
			el('span', { class: 'cefr cefr--' + lesson.level, text: lesson.level })
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
				if (!dogru) {
					secenekler.querySelectorAll('button')[q.answer].classList.add('exOption--ok');
				}

				geri.className = 'quizFeedback ' + (dogru ? 'ok' : 'bad');
				geri.textContent = (dogru ? '✓ Doğru. ' : '✗ ') + q.why;
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

	/**
	 * Puanlama render'dan ayrı: `onPassed` depoya yazıyor, depo `render()`
	 * çağırıyor. Bu çağrı çizimin ortasında olsaydı quiz kendi üstüne
	 * yeniden çizilirdi.
	 */
	function puanla() {
		if (!run.scored) {
			run.scored = true;
			const r = gradeQuiz(lesson, cevaplar);
			// Beceri grafigi GECILSIN GECILMESIN sayiyor; yalnizca
			// gecen denemeleri saymak basari oranini %100 gosterirdi.
			handlers.onResult?.(r);
			if (isLessonPassed(r)) handlers.onPassed(lesson.id);
		}
		ciz();
	}

	function sonuc() {
		const r = gradeQuiz(lesson, cevaplar);
		const gecti = isLessonPassed(r);

		const tekrar = el('button', { class: gecti ? 'ghost' : 'primary', text: 'Tekrar dene' });
		tekrar.onclick = () => {
			cevaplar.length = 0;
			run.index = 0;
			run.scored = false;
			ciz();
		};
		const bitir = el('button', { class: gecti ? 'primary' : 'ghost', text: 'Derslere dön' });
		bitir.onclick = handlers.onBackToList;

		// Yanlislarin hepsi aciklamalariyla tekrar gosteriliyor:
		// quiz bitince "neyi bilmiyordum" sorusu cevapsiz kalmamali.
		const yanlislar = r.details.filter((d) => !d.ok);
		const liste = yanlislar.length
			? el('div', { class: 'quizReview' }, [
				el('div', { class: 'small', text: 'Yanlış cevapladıkların:' }),
				...yanlislar.map((d) => el('div', { class: 'quizReviewItem' }, [
					el('div', { class: 'quizReviewQ', text: d.question }),
					el('div', { class: 'quizReviewA', text: '✓ ' + d.options[d.correct] }),
					el('div', { class: 'small', text: d.why })
				]))
			])
			: null;

		return el('div', { class: 'dlgFinish' }, [
			el('div', { class: 'dlgFinishIcon', text: gecti ? '🎉' : '💪' }),
			el('div', { class: 'dlgFinishTitle', text: `${r.correct} / ${r.total} doğru` }),
			el('div', {
				class: 'small',
				text: gecti ? 'Ders tamamlandı.' : 'Geçmek için en az %70 gerekiyor.'
			}),
			liste,
			el('div', { class: 'dlgFinishActions' }, [tekrar, bitir])
		]);
	}

	ciz();
}
