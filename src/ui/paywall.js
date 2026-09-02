/**
 * Abonelik ekranı.
 *
 * İki ilke:
 *  - Ne kazanacağını SAYIYLA söyle. "Premium'a geç" değil,
 *    "3571 kelime daha açılır" — somut olan ikna eder.
 *  - Kapatmayı kolaylaştır. Kapatılamayan paywall mağaza puanını
 *    düşürür ve Play politikasına da aykırıdır.
 */
import { lockedSummary, PRODUCTS } from '../core/entitlements.js';
import { getProducts, getStatus } from '../platform/billing.js';
import { el } from './dom.js';

let overlayNode = null;

/**
 * @param {object[]} words Tüm havuz (kilitli sayısını hesaplamak için)
 * @param {object} premium
 * @param {{onPurchase: (productId: string) => Promise<void>, onRestore: () => Promise<void>}} handlers
 */
export async function showPaywall(words, premium, handlers) {
	close();

	const summary = lockedSummary(words, premium);
	const status = await getStatus();
	const products = await getProducts();

	const card = el('div', { class: 'paywallCard' });

	card.appendChild(el('div', { class: 'paywallHead' }, [
		el('div', { class: 'paywallTitle', text: '🔓 Tüm seviyelerin kilidini aç' }),
		el('div', {
			class: 'paywallLead',
			text: summary.locked
				? `${summary.locked} kelime daha seni bekliyor — B1'den C2'ye kadar.`
				: 'Tüm içerik zaten açık.'
		})
	]));

	// Ne kazanacağı: seviye seviye
	if (summary.locked) {
		const levels = el('div', { class: 'paywallLevels' });
		for (const [level, count] of Object.entries(summary.byLevel)) {
			levels.appendChild(el('div', { class: 'paywallLevel' }, [
				el('span', { class: 'cefr cefr--' + level, text: level }),
				el('span', { class: 'paywallLevelCount', text: `${count} kelime` })
			]));
		}
		card.appendChild(levels);
	}

	card.appendChild(el('ul', { class: 'paywallPerks' }, [
		el('li', { text: 'B1–C2 arası tüm kelimeler ve örnek cümleler' }),
		el('li', { text: 'Sınırsız çalışma, reklamsız' }),
		el('li', { text: 'Tek seferlik ödeme seçeneği de var' })
	]));

	// Fiyat seçenekleri
	const plans = el('div', { class: 'paywallPlans' });
	for (const product of products) {
		const btn = el('button', {
			class: 'planCard' + (product.id === PRODUCTS.YEARLY ? ' planCard--featured' : '')
		}, [
			product.badge ? el('span', { class: 'planBadge', text: product.badge }) : null,
			el('span', { class: 'planTitle', text: product.title }),
			el('span', { class: 'planPrice', text: product.price }),
			el('span', { class: 'planPeriod', text: product.period }),
			product.note ? el('span', { class: 'planNote', text: product.note }) : null
		]);
		btn.disabled = !status.available;
		btn.onclick = () => {
			close();
			handlers.onPurchase(product.id);
		};
		plans.appendChild(btn);
	}
	card.appendChild(plans);

	if (!status.available) {
		card.appendChild(el('div', {
			class: 'paywallNotice',
			text: status.reason || 'Satın alma şu an kullanılamıyor.'
		}));
	}

	// Alt eylemler
	const restoreBtn = el('button', { class: 'ghost', text: 'Satın alımları geri yükle' });
	restoreBtn.onclick = () => {
		close();
		handlers.onRestore();
	};
	const closeBtn = el('button', { class: 'ghost', text: 'Şimdi değil' });
	closeBtn.onclick = () => close();

	card.appendChild(el('div', { class: 'paywallActions' }, [restoreBtn, closeBtn]));
	card.appendChild(el('div', {
		class: 'paywallFine',
		text: 'Abonelik Google Play üzerinden yönetilir, istediğin zaman iptal edebilirsin. ' +
			'A1 ve A2 seviyeleri her zaman ücretsiz kalır.'
	}));

	overlayNode = el('div', {
		class: 'paywallOverlay',
		attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Abonelik' }
	}, [card]);

	overlayNode.addEventListener('click', (e) => {
		if (e.target === overlayNode) close();
	});
	document.addEventListener('keydown', onKey, true);
	document.body.appendChild(overlayNode);
	document.body.classList.add('modalOpen');
	closeBtn.focus();
}

function onKey(e) {
	if (e.key === 'Escape') {
		e.preventDefault();
		close();
	}
}

export function close() {
	document.removeEventListener('keydown', onKey, true);
	document.body.classList.remove('modalOpen');
	if (overlayNode) overlayNode.remove();
	overlayNode = null;
}
