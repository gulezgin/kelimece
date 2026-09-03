/**
 * Ayarlardaki bulut hesabı bölümü.
 *
 * Üç durum var ve üçü de farklı görünüyor:
 *   yapılandırılmamış → bölüm hiç görünmez (Firebase projesi yok)
 *   çıkış yapılmış    → giriş / kayıt düğmeleri
 *   giriş yapılmış    → e-posta, eşitle, çıkış, hesabı sil
 *
 * Yapılandırma yokken bölümü gizlemek bilinçli: çalışmayan bir
 * "Giriş yap" düğmesi göstermek, kullanıcıya verisinin yedeklendiğini
 * sandırır.
 */
import { $, el } from './dom.js';

/**
 * @param {{available: boolean, user: object|null, syncing: boolean,
 *   lastSync: string|null}} durum
 * @param {object} handlers
 */
export function renderCloudPanel(durum, handlers) {
	const host = $('cloudCard');
	if (!host) return;
	host.textContent = '';

	if (!durum.available) {
		host.classList.add('hidden');
		return;
	}
	host.classList.remove('hidden');

	if (!durum.user) {
		host.appendChild(el('div', { class: 'cloudBox' }, [
			el('div', { class: 'cloudTitle', text: '☁️ Bulut yedekleme' }),
			el('div', {
				class: 'small',
				text: 'Hesap açarsan ilerlemen buluta yedeklenir ve başka cihazdan devam edebilirsin.'
			}),
			el('div', { class: 'cloudActions' }, [
				düğme('primary', 'Giriş yap', handlers.onSignIn),
				düğme('ghost', 'Hesap aç', handlers.onSignUp)
			])
		]));
		return;
	}

	const bilgi = durum.lastSync
		? 'Son eşitleme: ' + zamanMetni(durum.lastSync)
		: 'Henüz eşitlenmedi.';

	host.appendChild(el('div', { class: 'cloudBox' }, [
		el('div', { class: 'cloudTitle', text: '☁️ ' + (durum.user.email || 'Hesap') }),
		el('div', { class: 'small', text: bilgi }),
		el('div', { class: 'cloudActions' }, [
			düğme('primary', durum.syncing ? 'Eşitleniyor…' : 'Şimdi eşitle',
				handlers.onSync, durum.syncing),
			düğme('ghost', 'Çıkış yap', handlers.onSignOut, durum.syncing)
		]),
		el('div', { class: 'cloudActions' }, [
			düğme('bad', 'Hesabı sil', handlers.onDelete, durum.syncing)
		])
	]));
}

function düğme(sinif, metin, onClick, disabled = false) {
	const b = el('button', { class: sinif, text: metin });
	b.disabled = !!disabled;
	b.onclick = onClick;
	return b;
}

/** "3 dakika önce" gibi kısa bir zaman metni. */
function zamanMetni(iso) {
	const fark = Date.now() - new Date(iso).getTime();
	if (!Number.isFinite(fark) || fark < 0) return 'az önce';
	const dk = Math.floor(fark / 60000);
	if (dk < 1) return 'az önce';
	if (dk < 60) return dk + ' dakika önce';
	const saat = Math.floor(dk / 60);
	if (saat < 24) return saat + ' saat önce';
	return Math.floor(saat / 24) + ' gün önce';
}
