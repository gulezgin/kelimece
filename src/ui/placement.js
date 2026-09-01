/**
 * Seviye belirleme testi arayüzü.
 *
 * Tam ekran, tek soru gösteren akış. Tekrar oturumundan ayrı tutuldu:
 * burada cevaplar ilerlemeye YAZILMAZ, sadece seviye ölçülür.
 */
import { createSession } from '../core/placement.js';
import { el } from './dom.js';

let overlayNode = null;

/**
 * Testi başlatır.
 *
 * @param {object[]} words CEFR seviyesi olan kelimeler
 * @param {{onFinish: (result: object|null) => void}} handlers
 * @returns {boolean} Test başlatılabildi mi
 */
export function startPlacement(words, { onFinish }) {
	const session = createSession(words);
	if (!session) {
		onFinish(null);
		return false;
	}

	const progressLabel = el('span', { class: 'small' });
	const bar = el('div', { class: 'placeBarFill' });
	const prompt = el('div', { class: 'placePrompt' });
	const optionsBox = el('div', { class: 'placeOptions' });
	const hint = el('div', { class: 'small placeHint', text: 'Doğru Türkçe karşılığı seç' });

	const exitBtn = el('button', { class: 'ghost', text: 'Vazgeç' });

	const card = el('div', { class: 'placeCard' }, [
		el('div', { class: 'placeHead' }, [
			el('div', { class: 'placeTitle', text: '🎯 Seviye belirleme' }),
			progressLabel
		]),
		el('div', { class: 'placeBar' }, [bar]),
		prompt,
		hint,
		optionsBox,
		el('div', { class: 'placeActions' }, [exitBtn])
	]);

	overlayNode = el('div', {
		class: 'placeOverlay',
		attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Seviye belirleme testi' }
	}, [card]);

	let current = null;
	let locked = false;

	function close(result) {
		document.removeEventListener('keydown', onKey, true);
		document.body.classList.remove('modalOpen');
		if (overlayNode) overlayNode.remove();
		overlayNode = null;
		onFinish(result);
	}

	function onKey(e) {
		if (e.key === 'Escape') {
			e.preventDefault();
			close(null);
			return;
		}
		// 1-4 tuşlarıyla cevap
		const n = Number(e.key);
		if (!locked && current && n >= 1 && n <= current.options.length) {
			e.preventDefault();
			pick(n - 1);
		}
	}

	function render() {
		current = session.nextQuestion();
		if (!current || session.done) {
			close(session.result);
			return;
		}

		const p = session.progress;
		progressLabel.textContent = `${p.asked + 1}. soru · ${p.level}`;
		bar.style.width = Math.min(100, ((p.asked + 1) / p.max) * 100) + '%';
		prompt.textContent = current.en;

		optionsBox.textContent = '';
		current.options.forEach((text, i) => {
			const btn = el('button', { class: 'placeOption' }, [
				el('span', { class: 'placeKey', text: String(i + 1) }),
				el('span', { text })
			]);
			btn.onclick = () => pick(i);
			optionsBox.appendChild(btn);
		});
		locked = false;
	}

	function pick(index) {
		if (locked || !current) return;
		locked = true;

		const correct = index === current.correctIndex;
		const buttons = [...optionsBox.querySelectorAll('.placeOption')];
		buttons[index].classList.add(correct ? 'placeOption--right' : 'placeOption--wrong');
		if (!correct) buttons[current.correctIndex].classList.add('placeOption--right');

		session.answer(correct);
		// Kısa geri bildirim sonra sonraki soru
		setTimeout(() => {
			if (session.done) close(session.result);
			else render();
		}, 550);
	}

	exitBtn.onclick = () => close(null);
	document.addEventListener('keydown', onKey, true);
	document.body.appendChild(overlayNode);
	document.body.classList.add('modalOpen');
	render();
	return true;
}
