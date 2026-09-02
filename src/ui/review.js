/**
 * Tekrar (review) oturumu — tam ekran kart akışı.
 *
 * Oturum kendi kuyruğunu tutar; her cevaptan sonra store'a yazar ve
 * bir sonraki kelimeye geçer. Oturum sonunda kısa bir özet gösterir.
 */
import { buildExercise, checkAnswer, isNearMiss, TYPES } from '../core/exercise.js';
import { formatInterval, previewIntervals } from '../core/scheduler.js';
import { hasEnglishVoice, speak, stop as stopSpeech } from '../core/speech.js';
import { MAX_LEVEL } from '../core/srs.js';
import { el } from './dom.js';

/** @type {{queue: string[], index: number, active: boolean, stats: object}|null} */
let session = null;
let overlayNode = null;
let refs = null;

/**
 * @param {object[]} queue Kelime nesneleri
 * @param {{
 *   getWord: (id: string) => object|undefined,
 *   onRate: (id: string, rating: 'again'|'hard'|'good'|'easy') => void,
 *   onFinish: (stats: {known: number, forgot: number, skipped: number, total: number}) => void
 * }} handlers
 */
export function startSession(queue, handlers) {
	session = {
		queue: queue.map((w) => w.id),
		index: 0,
		active: true,
		// Yaniltici secenekler bu havuzdan uretiliyor
		pool: handlers.pool || queue,
		exercise: null,
		answered: false,
		stats: { known: 0, forgot: 0, skipped: 0, total: queue.length, ratings: {}, byType: {} }
	};
	sessionHandlers = handlers;
	pendingRating = null;
	buildOverlay(handlers);
	showCurrent(handlers);
}

export function isActive() {
	return !!(session && session.active);
}

function buildOverlay(handlers) {
	if (overlayNode) overlayNode.remove();

	const progress = el('span', { attrs: { id: 'reviewProgress' }, text: '1/1' });
	const level = el('span', { class: 'kpill', attrs: { id: 'reviewLevel' }, text: 'Seviye 0' });
	const cefr = el('span', { class: 'cefr', attrs: { id: 'reviewCefr' } });
	const enNode = el('div', { class: 'en', attrs: { id: 'reviewEn' } });
	const speakBtn = el('button', {
		class: 'speakBtn',
		text: '🔊',
		title: 'Telaffuzu dinle (S)',
		attrs: { 'aria-label': 'Telaffuzu dinle' }
	});
	const enRow = el('div', { class: 'reviewEnRow' }, [enNode, hasEnglishVoice() ? speakBtn : null]);
	const trNode = el('div', { class: 'tr', attrs: { id: 'reviewTr' } });
	const exNode = el('div', { class: 'exampleBox', attrs: { id: 'reviewEx' } });
	const exEn = el('div', { class: 'exampleEn' });
	const exTr = el('div', { class: 'exampleTr' });
	const exExtra = el('div', { class: 'small' });
	exNode.appendChild(exEn);
	exNode.appendChild(exTr);
	exNode.appendChild(exExtra);
	const tagsNode = el('div', { class: 'tags', attrs: { id: 'reviewTags' } });

	// Alistirma alani: tipe gore coktan secmeli, yazma ya da bosluk doldurma
	const exerciseBox = el('div', { class: 'exerciseBox' });
	const instruction = el('div', { class: 'exerciseHint' });
	const clozeBox = el('div', { class: 'clozeSentence hidden' });
	const optionsBox = el('div', { class: 'exerciseOptions hidden' });
	const typeRow = el('div', { class: 'typeRow hidden' });
	const typeInput = el('input', {
		class: 'input typeInput',
		attrs: { type: 'text', autocomplete: 'off', autocapitalize: 'off',
			autocorrect: 'off', spellcheck: 'false', placeholder: 'İngilizcesini yaz…' }
	});
	const typeSubmit = el('button', { class: 'primary typeSubmit', text: 'Kontrol et' });
	typeRow.appendChild(typeInput);
	typeRow.appendChild(typeSubmit);
	const feedback = el('div', { class: 'exerciseFeedback hidden' });
	exerciseBox.appendChild(instruction);
	exerciseBox.appendChild(clozeBox);
	exerciseBox.appendChild(optionsBox);
	exerciseBox.appendChild(typeRow);
	exerciseBox.appendChild(feedback);

	const btnShow = el('button', { class: 'ghost', text: 'Anlamı Göster (Boşluk)' });

	// Dört seçenekli değerlendirme: her düğme bir sonraki tekrarın
	// ne zaman olacağını da gösterir, karar somutlaşsın diye.
	const rateButtons = {};
	const rateRow = el('div', { class: 'rateRow hidden' });
	const RATING_META = [
		{ key: 'again', label: 'Hiç', cls: 'rate--again', hint: '1' },
		{ key: 'hard', label: 'Zor', cls: 'rate--hard', hint: '2' },
		{ key: 'good', label: 'İyi', cls: 'rate--good', hint: '3' },
		{ key: 'easy', label: 'Kolay', cls: 'rate--easy', hint: '4' }
	];
	for (const meta of RATING_META) {
		const when = el('span', { class: 'rateWhen' });
		const btn = el('button', { class: 'rateBtn ' + meta.cls }, [
			el('span', { class: 'rateLabel', text: meta.label }),
			when,
			el('span', { class: 'rateKey', text: meta.hint })
		]);
		btn.dataset.rating = meta.key;
		rateButtons[meta.key] = { btn, when };
		rateRow.appendChild(btn);
	}

	const btnSkip = el('button', { class: 'ghost', text: 'Geç' });
	const btnExit = el('button', { class: 'ghost', text: 'Kapat (Esc)' });

	const card = el('div', { class: 'reviewCard' }, [
		el('div', { class: 'reviewMeta' }, [progress, cefr, level]),
		enRow,
		trNode,
		exerciseBox,
		exNode,
		tagsNode,
		rateRow,
		el('div', { class: 'reviewActions' }, [btnShow, btnSkip, btnExit])
	]);

	overlayNode = el('div', {
		class: 'reviewOverlay',
		attrs: { id: 'reviewOverlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Tekrar oturumu' }
	}, [card]);

	refs = {
		enRow, speakBtn,
		progress, cefr, level, enNode, trNode, exNode, exEn, exTr, exExtra,
		tagsNode, btnShow, rateRow, rateButtons, btnSkip, btnExit,
		exerciseBox, instruction, clozeBox, optionsBox, typeRow, typeInput,
		typeSubmit, feedback
	};

	typeSubmit.onclick = () => submitTyped(handlers);
	typeInput.onkeydown = (e) => {
		if (e.key === 'Enter') {
			e.preventDefault();
			e.stopPropagation();
			submitTyped(handlers);
		}
	};

	speakBtn.onclick = (e) => {
		e.stopPropagation();
		speak(refs.enNode.textContent);
	};

	btnShow.onclick = reveal;
	for (const meta of RATING_META) {
		rateButtons[meta.key].btn.onclick = () => answer(meta.key, handlers);
	}
	btnSkip.onclick = () => {
		session.stats.skipped++;
		session.index++;
		showCurrent(handlers);
	};
	btnExit.onclick = () => endSession(handlers);

	document.addEventListener('keydown', onKey, true);
	document.body.appendChild(overlayNode);
	document.body.classList.add('modalOpen');
}

/**
 * Klavye kısayolları:
 *   Boşluk/Enter — anlamı göster, sonra "İyi"
 *   1-4          — Hiç / Zor / İyi / Kolay
 *   S            — telaffuzu dinle
 *   Esc          — kapat
 */
function onKey(e) {
	if (!isActive()) return;

	if (e.key === 'Escape') {
		e.preventDefault();
		refs.btnExit.click();
		return;
	}
	// Yaziyorken kisayollar devre disi - harfler girdiye gitmeli
	if (e.target === refs.typeInput && e.key !== 'Enter') return;

	if (e.key === 's' || e.key === 'S') {
		e.preventDefault();
		speak(refs.enNode.textContent);
		return;
	}
	if (onExerciseKey(e)) return;

	const hidden = refs.btnShow.style.display !== 'none';
	if (e.key === ' ' || e.key === 'Enter') {
		e.preventDefault();
		if (hidden) refs.btnShow.click();
		else refs.rateButtons.good.btn.click();
		return;
	}
	if (hidden) return;

	const byKey = { 1: 'again', 2: 'hard', 3: 'good', 4: 'easy' };
	if (byKey[e.key]) {
		e.preventDefault();
		refs.rateButtons[byKey[e.key]].btn.click();
	}
}

/** Alistirma modunda klavye: rakamlarla sik secimi, Enter ile devam. */
function onExerciseKey(e) {
	if (!isActive() || !session.exercise) return false;
	const ex = session.exercise;
	if (ex.type === TYPES.RECALL) return false;

	if (session.answered) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			continueAfterAnswer();
			return true;
		}
		return true;
	}

	if (ex.options) {
		const n = Number(e.key);
		if (n >= 1 && n <= ex.options.length) {
			e.preventDefault();
			submitChoice(n - 1);
			return true;
		}
	}
	return true;
}

function reveal() {
	refs.trNode.style.display = '';
	refs.exNode.style.display = '';
	refs.rateRow.classList.remove('hidden');
	refs.btnShow.style.display = 'none';
}

/** Coktan secmeli cevabi isler. */
function submitChoice(index) {
	if (!isActive() || session.answered) return;
	const ex = session.exercise;
	const result = checkAnswer(ex, index);

	const buttons = [...refs.optionsBox.querySelectorAll('.exOption')];
	buttons.forEach((b) => (b.disabled = true));
	buttons[index].classList.add(result.correct ? 'exOption--right' : 'exOption--wrong');
	if (!result.correct) buttons[ex.correctIndex].classList.add('exOption--right');

	finishExercise(result);
}

/** Yazilan cevabi isler. */
function submitTyped(handlers) {
	if (!isActive() || session.answered) return;
	const ex = session.exercise;
	const value = refs.typeInput.value;
	if (!value.trim()) return;

	const result = checkAnswer(ex, value);
	refs.typeInput.disabled = true;
	refs.typeSubmit.disabled = true;
	refs.typeInput.classList.toggle('typeInput--right', result.correct);
	refs.typeInput.classList.toggle('typeInput--wrong', !result.correct);

	// Tek harf hatasi ozel geri bildirim alir: kelimeyi biliyor,
	// yazimda takilmis.
	finishExercise(result, !result.correct && isNearMiss(ex, value));
}

/**
 * Cevap sonrasi geri bildirim gosterir ve devam etmeyi bekler.
 * Dogruda kisa, yanlista uzun sure - yanlisi gormek icin zaman gerekiyor.
 */
function finishExercise(result, nearMiss) {
	session.answered = true;
	const ex = session.exercise;

	// Anlam ve ornek cumle her durumda acilir: ogrenme ani burasi
	refs.trNode.textContent = '— ' + ex.word.tr;
	refs.trNode.style.display = '';
	refs.exNode.style.display = '';

	refs.feedback.classList.remove('hidden');
	refs.feedback.className = 'exerciseFeedback ' + (result.correct ? 'ok' : 'bad');
	if (result.correct) {
		refs.feedback.textContent = '✓ Doğru';
	} else if (nearMiss) {
		refs.feedback.textContent = '✗ Az kaldı — doğrusu: ' + result.expected;
	} else {
		refs.feedback.textContent = '✗ Doğrusu: ' + result.expected;
	}

	// Ingilizce kelimeyi goster: Turkce sorulmussa ya da ses sorusunda
	// gizlenmisse henuz gorunmuyordu.
	if (ex.promptLang === 'tr' || ex.audioPrompt) {
		refs.enNode.textContent = ex.word.en;
		refs.enNode.classList.remove('en--audio');
	}

	session.stats.byType[ex.type] = session.stats.byType[ex.type] || { asked: 0, correct: 0 };
	session.stats.byType[ex.type].asked++;
	if (result.correct) session.stats.byType[ex.type].correct++;

	pendingRating = result.rating;
	// Devam: Enter ya da bosluk
	refs.btnShow.style.display = '';
	refs.btnShow.textContent = 'Devam (Enter)';
	refs.btnShow.onclick = continueAfterAnswer;
	refs.btnShow.focus();
}

/** Geri bildirimden sonra siradaki alistirmaya gecer. */
let pendingRating = null;
let sessionHandlers = null;

function continueAfterAnswer() {
	if (!pendingRating || !sessionHandlers) return;
	const rating = pendingRating;
	pendingRating = null;
	refs.btnShow.textContent = 'Anlamı Göster (Boşluk)';
	refs.btnShow.onclick = reveal;
	answer(rating, sessionHandlers);
}

function answer(rating, handlers) {
	const id = session.queue[session.index];
	session.stats[rating === 'again' ? 'forgot' : 'known']++;
	session.stats.ratings[rating] = (session.stats.ratings[rating] || 0) + 1;
	session.index++;
	handlers.onRate(id, rating);
	showCurrent(handlers);
}

function showCurrent(handlers) {
	if (!isActive()) return;

	while (session.index < session.queue.length) {
		const w = handlers.getWord(session.queue[session.index]);
		if (!w) {
			session.index++;
			continue;
		}
		paint(w);
		return;
	}
	endSession(handlers);
}

function paint(w) {
	refs.progress.textContent = `${session.index + 1}/${session.queue.length}`;
	refs.level.textContent = w.level >= MAX_LEVEL ? 'Öğrenilmiş' : 'Seviye ' + w.level;
	refs.cefr.textContent = w.cefr || '';
	refs.cefr.className = 'cefr' + (w.cefr ? ' cefr--' + w.cefr : ' hidden');
	refs.enNode.textContent = w.en;
	refs.trNode.textContent = '— ' + w.tr;
	// Örnek cümle: İngilizcesi öne çıkar, Türkçesi altında soluk durur.
	// Cümleyi bağlamıyla görmek, kelimeyi tek başına ezberlemekten
	// çok daha iyi transfer sağlıyor.
	refs.exEn.textContent = w.example || '';
	refs.exTr.textContent = w.exampleTr || '';
	refs.exEn.classList.toggle('hidden', !w.example);
	refs.exTr.classList.toggle('hidden', !w.exampleTr);

	const extras = [];
	if (w.synonyms && w.synonyms.length) extras.push('Eş anlamlı: ' + w.synonyms.join(', '));
	refs.exExtra.textContent = extras.join('  ·  ');
	refs.exExtra.classList.toggle('hidden', !extras.length);
	refs.exNode.classList.toggle('hidden', !w.example && !extras.length);

	refs.tagsNode.textContent = '';
	for (const t of w.tags || []) refs.tagsNode.appendChild(el('span', { class: 'tag', text: t }));

	// Her seçeneğin bir sonraki tekrarı ne kadar öteleyeceğini göster
	const preview = previewIntervals(w);
	for (const [key, { when }] of Object.entries(refs.rateButtons)) {
		when.textContent = formatInterval(preview[key]);
	}

	// Alistirma tipini kelimenin olgunluguna gore sec ve kur.
	// Dinleme yalnizca cihazda Ingilizce ses varsa verilebilir; core
	// modulu platformu bilmedigi icin karar burada aktariliyor.
	const exercise = buildExercise(w, session.pool, {
		allowListen: hasEnglishVoice()
	});
	session.exercise = exercise;
	session.answered = false;

	setupExercise(exercise);
}

/**
 * Alistirma tipine gore karti duzenler.
 *
 * RECALL disinda cevap gercekten denetlenir: kullanici kendini
 * degerlendirmez, sistem dogru/yanlis der.
 */
function setupExercise(ex) {
	const isRecall = ex.type === TYPES.RECALL;

	// Ortak sifirlama
	refs.trNode.style.display = 'none';
	refs.exNode.style.display = 'none';
	refs.rateRow.classList.add('hidden');
	refs.feedback.classList.add('hidden');
	refs.feedback.textContent = '';
	refs.optionsBox.classList.add('hidden');
	refs.optionsBox.textContent = '';
	refs.typeRow.classList.add('hidden');
	refs.clozeBox.classList.add('hidden');
	refs.typeInput.value = '';
	refs.typeInput.disabled = false;
	refs.typeSubmit.disabled = false;
	refs.exerciseBox.classList.toggle('hidden', isRecall);
	refs.btnShow.style.display = isRecall ? '' : 'none';
	refs.instruction.textContent = ex.instruction || '';

	if (isRecall) {
		// Klasik kart: Ingilizce ustte, anlam gizli
		refs.enNode.textContent = ex.word.en;
		refs.enRow.classList.remove('hidden');
		refs.btnShow.focus();
		return;
	}

	// Soru metni: hangi yonde sordugumuza gore.
	// Dinlemede yazili hal GIZLENIR - gorulurse soru dinleme olmaktan
	// cikar, okuma olur.
	refs.enNode.textContent = ex.audioPrompt ? '🔈 ⋯' : ex.prompt;
	refs.enNode.classList.toggle('en--audio', !!ex.audioPrompt);
	refs.enRow.classList.remove('hidden');
	// Turkce sorularda telaffuz dugmesi anlamsiz
	if (refs.speakBtn) refs.speakBtn.classList.toggle('hidden', ex.promptLang !== 'en');

	if (ex.audioPrompt) {
		// Otomatik bir kez calinir; tekrar dinlemek icin dugme duruyor.
		// Beklemeden calmak, kullaniciyi once dugme aramaya zorlamiyor.
		speak(ex.prompt);
	}

	if (ex.type === TYPES.CLOZE) {
		// Bosluk doldurma: soru Turkce anlam, altinda bosluklu cumle
		refs.clozeBox.textContent = '';
		refs.clozeBox.appendChild(document.createTextNode(ex.sentence.before));
		refs.clozeBox.appendChild(el('span', { class: 'clozeBlank', text: '_'.repeat(Math.max(4, ex.sentence.blank.length)) }));
		refs.clozeBox.appendChild(document.createTextNode(ex.sentence.after));
		refs.clozeBox.classList.remove('hidden');
	}

	if (ex.options) {
		const frag = document.createDocumentFragment();
		ex.options.forEach((text, i) => {
			const btn = el('button', { class: 'exOption' }, [
				el('span', { class: 'exKey', text: String(i + 1) }),
				el('span', { text })
			]);
			btn.onclick = () => submitChoice(i);
			frag.appendChild(btn);
		});
		refs.optionsBox.appendChild(frag);
		refs.optionsBox.classList.remove('hidden');
	} else {
		refs.typeRow.classList.remove('hidden');
		refs.typeInput.focus();
	}
}

function endSession(handlers) {
	const stats = session ? session.stats : { known: 0, forgot: 0, skipped: 0, total: 0 };
	const answered = stats.known + stats.forgot;

	session = null;
	stopSpeech();
	document.removeEventListener('keydown', onKey, true);
	document.body.classList.remove('modalOpen');
	if (overlayNode) overlayNode.remove();
	overlayNode = null;
	refs = null;

	handlers.onFinish({ ...stats, answered });
}
