/**
 * Diyalog rol yapma ekranı.
 *
 * A konuşur, kullanıcı B'nin repliğini üretir. Doğru cevap verilene
 * kadar ilerlenmiyor: diyalog bir sohbet, atlanan replik boşluk
 * bırakır. Yanlışta cevap gösterilmiyor, tekrar deneniyor — üçüncü
 * denemeden sonra gösteriliyor, çünkü takılıp kalmak öğretmiyor.
 */
import {
	buildStep,
	checkBlank,
	checkChoice,
	checkOrder,
	MODES,
	practiceSteps
} from '../core/dialoguePractice.js';
import { hasEnglishVoice, speak } from '../core/speech.js';
import { $, el } from './dom.js';

/** Cevap gösterilmeden önceki deneme hakkı. */
const MAX_TRIES = 3;

let state = null;

/**
 * @param {object} dialogue
 * @param {object[]} allDialogues Yanıltıcı havuzu
 * @param {{onExit: () => void, onDone: (sonuc: object) => void}} handlers
 */
export function startPractice(dialogue, allDialogues, handlers) {
	const steps = practiceSteps(dialogue);
	state = {
		dialogue,
		allDialogues,
		handlers,
		steps,
		stepIndex: 0,
		lineIndex: 0,
		tries: 0,
		correct: 0,
		revealed: 0,
		picked: []
	};
	draw();
}

/** Alıştırma ekranı kapatılırken çağrılır. */
export function stopPractice() {
	state = null;
}

function currentStep() {
	return state.steps[state.stepIndex] || null;
}

/** Sıradaki kullanıcı repliğine kadar olan satırlar. */
function visibleLines() {
	const step = currentStep();
	const limit = step ? step.index : (state.dialogue.lines || []).length;
	return (state.dialogue.lines || []).slice(0, limit);
}

function draw() {
	const host = $('dialoguesView');
	if (!host || !state) return;
	host.textContent = '';

	const cikis = el('button', { class: 'ghost', text: '← Çık' });
	cikis.onclick = () => state.handlers.onExit();
	host.appendChild(el('div', { class: 'dlgHead' }, [
		cikis,
		el('span', { class: 'dlgProgress', text: `${state.stepIndex} / ${state.steps.length}` }),
		el('span', { class: 'cefr cefr--' + state.dialogue.cefr, text: state.dialogue.cefr })
	]));

	// Simdiye kadarki konusma
	const dokum = el('div', { class: 'dlgLineList' });
	for (const line of visibleLines()) {
		dokum.appendChild(transcriptRow(line));
	}
	host.appendChild(dokum);

	const step = currentStep();
	if (!step) {
		host.appendChild(finishBox());
		return;
	}

	// A'nin son repligi sesli okunur: sira kullaniciya geldiginde
	// neye cevap verdigini duymus olmali.
	const lines = state.dialogue.lines || [];
	const onceki = lines[step.index - 1];
	if (onceki && onceki.s === 'A' && hasEnglishVoice()) speak(onceki.en);

	host.appendChild(exerciseBox(step));
}

function transcriptRow(line) {
	const row = el('div', { class: 'dlgLine dlgLine--' + (line.s === 'B' ? 'b' : 'a') }, [
		el('span', { class: 'dlgSpeaker', text: line.s }),
		el('div', { class: 'dlgBody' }, [
			el('div', { class: 'dlgEn', text: line.en }),
			el('div', { class: 'dlgTr', text: line.tr || '' })
		])
	]);
	if (hasEnglishVoice()) {
		const btn = el('button', { class: 'iconBtn dlgSpeak', text: '🔊' });
		btn.setAttribute('aria-label', 'Satırı seslendir');
		btn.onclick = () => speak(line.en);
		row.appendChild(btn);
	}
	return row;
}

function finishBox() {
	const toplam = state.steps.length;
	const oran = toplam ? Math.round((state.correct / toplam) * 100) : 0;
	const tekrar = el('button', { class: 'primary', text: 'Tekrar dene' });
	tekrar.onclick = () => startPractice(state.dialogue, state.allDialogues, state.handlers);
	const bitir = el('button', { class: 'ghost', text: 'Diyaloglara dön' });
	bitir.onclick = () => state.handlers.onExit();

	return el('div', { class: 'dlgFinish' }, [
		el('div', { class: 'dlgFinishIcon', text: oran >= 80 ? '🎉' : '💪' }),
		el('div', { class: 'dlgFinishTitle', text: 'Diyalog tamamlandı' }),
		el('div', {
			class: 'small',
			text: `${toplam} replikten ${state.correct} tanesini ilk denemede bildin (%${oran}).` +
				(state.revealed ? `  ${state.revealed} tanesinde cevap gösterildi.` : '')
		}),
		el('div', { class: 'dlgFinishActions' }, [tekrar, bitir])
	]);
}

/** Sıradaki replik için alıştırma kutusu. */
function exerciseBox(step) {
	const ex = buildStep(state.dialogue, step, { allDialogues: state.allDialogues });
	state.exercise = ex;

	const box = el('div', { class: 'dlgExercise' }, [
		el('div', { class: 'dlgExerciseHint', text: ex.instruction }),
		// Turkce karsilik ipucu: ne SOYLEYECEGINI biliyor, nasil
		// soyleyecegini bilmiyor. Cevirisiz sorulsa tahmin oyunu olurdu.
		el('div', { class: 'dlgExerciseTr', text: ex.tr || '' })
	]);

	if (ex.mode === MODES.CHOICE) box.appendChild(choiceUi(ex));
	else if (ex.mode === MODES.ORDER) box.appendChild(orderUi(ex));
	else box.appendChild(blankUi(ex));

	const geri = el('div', { class: 'dlgFeedback hidden' });
	box.appendChild(geri);
	state.feedbackNode = geri;
	return box;
}

function choiceUi(ex) {
	const wrap = el('div', { class: 'exerciseOptions' });
	ex.options.forEach((text, i) => {
		const btn = el('button', { class: 'exOption' }, [
			el('span', { class: 'exKey', text: String(i + 1) }),
			el('span', { text })
		]);
		btn.onclick = () => judge(checkChoice(ex, i), ex);
		wrap.appendChild(btn);
	});
	return wrap;
}

function orderUi(ex) {
	const secilen = el('div', { class: 'orderSlot' });
	const havuz = el('div', { class: 'orderBank' });
	state.picked = [];

	function ciz() {
		secilen.textContent = '';
		havuz.textContent = '';
		state.picked.forEach((w, i) => {
			const b = el('button', { class: 'orderChip orderChip--picked', text: w });
			b.onclick = () => {
				state.picked.splice(i, 1);
				ciz();
			};
			secilen.appendChild(b);
		});
		// Havuzda kalanlar: secilenler cikarilmis kopyalar.
		// Ayni kelime cumlede iki kez gecebiliyor, o yuzden sayarak.
		const kalan = ex.tokens.slice();
		for (const w of state.picked) {
			const i = kalan.indexOf(w);
			if (i >= 0) kalan.splice(i, 1);
		}
		for (const w of kalan) {
			const b = el('button', { class: 'orderChip', text: w });
			b.onclick = () => {
				state.picked.push(w);
				ciz();
			};
			havuz.appendChild(b);
		}
		onayla.disabled = state.picked.length !== ex.words.length;
	}

	const onayla = el('button', { class: 'primary', text: 'Kontrol et' });
	onayla.onclick = () => judge(checkOrder(ex, state.picked), ex);

	const wrap = el('div', { class: 'orderUi' }, [secilen, havuz, onayla]);
	ciz();
	return wrap;
}

function blankUi(ex) {
	const input = el('input', {
		class: 'input blankInput',
		attrs: { type: 'text', autocomplete: 'off', autocapitalize: 'off',
			autocorrect: 'off', spellcheck: 'false', placeholder: '…' }
	});
	const cumle = el('div', { class: 'blankSentence' }, [
		document.createTextNode(ex.sentence.before),
		input,
		document.createTextNode(ex.sentence.after)
	]);
	const onayla = el('button', { class: 'primary', text: 'Kontrol et' });
	onayla.onclick = () => judge(checkBlank(ex, input.value), ex);
	input.addEventListener('keydown', (e) => {
		if (e.key === 'Enter') onayla.click();
	});
	setTimeout(() => input.focus(), 50);
	return el('div', { class: 'blankUi' }, [cumle, onayla]);
}

/**
 * Cevabı değerlendirir.
 *
 * Doğruysa replik konuşmaya ekleniyor ve sesli okunuyor: kullanıcı
 * kendi ürettiği cümlenin nasıl söylendiğini duyuyor.
 */
function judge(dogru, ex) {
	if (dogru) {
		if (state.tries === 0) state.correct++;
		if (hasEnglishVoice()) speak(ex.answer);
		state.tries = 0;
		state.stepIndex++;
		draw();
		return;
	}

	state.tries++;
	const kalan = MAX_TRIES - state.tries;
	const node = state.feedbackNode;
	if (!node) return;
	node.classList.remove('hidden');

	if (kalan > 0) {
		node.className = 'dlgFeedback bad';
		node.textContent = `Olmadı, tekrar dene. (${kalan} hakkın kaldı)`;
		return;
	}

	// Takilip kalmak ogretmiyor: cevabi goster ve devam et.
	node.className = 'dlgFeedback';
	node.textContent = 'Doğrusu: ' + ex.answer;
	state.revealed++;
	state.tries = 0;
	if (hasEnglishVoice()) speak(ex.answer);

	const devam = el('button', { class: 'primary', text: 'Devam' });
	devam.onclick = () => {
		state.stepIndex++;
		draw();
	};
	node.appendChild(el('div', { class: 'dlgFeedbackAction' }, [devam]));
}
