/**
 * Yerel profil.
 *
 * DİKKAT — bu bir HESAP DEĞİL: uygulamanın sunucusu yok, bu bilgiler
 * yalnızca cihazda duruyor. Başka cihazdan giriş yapılamaz ve bu
 * bilgiler bir yedek görevi görmez. Adı "hesap" değil "profil"; arayüz
 * de bunu açıkça söylüyor, çünkü kullanıcının verisinin bulutta
 * durduğunu sanması telefonunu kaybettiğinde ilerlemesini kaybetmesi
 * demek.
 *
 * Gerçek hesap için sunucu, kimlik doğrulama ve gizlilik politikası
 * değişikliği gerekir — mağaza kaydındaki "veri cihazdan çıkmaz"
 * beyanı da güncellenmeli.
 *
 * Saf mantık: DOM'a ve depoya dokunmaz.
 */

/** Profil kurulmamışken kullanılan boş değer. */
export const NO_ACCOUNT = { name: '', email: '', createdAt: null };

/**
 * E-posta biçimi geçerli mi?
 *
 * Kasten gevşek: RFC'ye tam uyan bir kalıp okunamaz uzunlukta ve
 * gerçek hataları yakalamıyor. Burada amaç yazım hatasını yakalamak
 * ("ali@gmail" gibi), adresin var olduğunu kanıtlamak değil — bunu
 * doğrulayacak bir sunucu yok.
 */
export function isValidEmail(email) {
	const value = String(email || '').trim();
	if (!value) return false;
	if (/\s/.test(value)) return false;
	const parts = value.split('@');
	if (parts.length !== 2) return false;
	const [local, domain] = parts;
	if (!local || !domain) return false;
	if (!domain.includes('.')) return false;
	if (domain.startsWith('.') || domain.endsWith('.')) return false;
	return true;
}

/**
 * Girdiyi temizler ve doğrular.
 * @returns {{ok: true, account: object} | {ok: false, reason: string}}
 */
export function normalizeAccount({ name, email } = {}) {
	const cleanName = String(name || '').trim().replace(/\s+/g, ' ');
	const cleanEmail = String(email || '').trim().toLowerCase();

	if (!cleanName) return { ok: false, reason: 'name' };
	if (cleanName.length > 40) return { ok: false, reason: 'name-long' };
	if (!isValidEmail(cleanEmail)) return { ok: false, reason: 'email' };

	return { ok: true, account: { name: cleanName, email: cleanEmail } };
}

/** Profil kurulmuş mu? */
export function hasAccount(account) {
	return !!(account && String(account.name || '').trim());
}

/**
 * Avatarda gösterilecek baş harfler.
 * Tek kelimelik adda tek harf; iki kelimede ikisinin baş harfi.
 */
export function initials(account) {
	const name = String((account && account.name) || '').trim();
	if (!name) return '?';
	const words = name.split(/\s+/).filter(Boolean);
	if (words.length === 1) return words[0][0].toLocaleUpperCase('tr');
	return (words[0][0] + words[words.length - 1][0]).toLocaleUpperCase('tr');
}

/**
 * Cihaza özgü, değişmeyen bir görüntü kimliği üretir.
 *
 * Rastgele değil, oluşturulma tarihinden türetiliyor: aynı profil her
 * açılışta aynı numarayı göstermeli, yoksa kullanıcı numarasını
 * destek talebinde kullanamaz.
 */
export function localId(account) {
	const seed = String((account && account.createdAt) || '');
	if (!seed) return '00000000';
	let hash = 0;
	for (let i = 0; i < seed.length; i++) {
		hash = (hash * 31 + seed.charCodeAt(i)) % 100000000;
	}
	return String(hash).padStart(8, '0');
}
