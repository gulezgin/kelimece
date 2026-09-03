/**
 * Bulut katmanı: kimlik doğrulama ve ilerleme eşitleme.
 *
 * Firebase SDK'sı DİNAMİK olarak yükleniyor ve yalnızca yapılandırma
 * doluysa. Sebebi iki türlü: yapılandırma yokken paket ~200 KB
 * şişmesin, ve proje kurulmadan da uygulama bugünkü gibi çalışsın.
 *
 * Tüm işlevler ağ hatasında `{ok:false, reason}` döner — throw etmez.
 * Bulut isteğe bağlı bir katman; kopması çalışmayı durdurmamalı.
 */
import { FIREBASE_CONFIG, isConfigured } from './firebase-config.js';

let sdk = null;
let loading = null;

/** Firebase'i bir kez kurar. Yapılandırma yoksa null döner. */
async function load() {
	if (!isConfigured()) return null;
	if (sdk) return sdk;
	if (loading) return loading;

	loading = (async () => {
		const [app, auth, store] = await Promise.all([
			import('firebase/app'),
			import('firebase/auth'),
			import('firebase/firestore')
		]);
		const instance = app.initializeApp(FIREBASE_CONFIG);
		sdk = {
			auth: auth.getAuth(instance),
			db: store.getFirestore(instance),
			a: auth,
			f: store
		};
		return sdk;
	})();

	try {
		return await loading;
	} catch {
		loading = null;
		return null;
	}
}

/** Bulut kullanılabilir mi? */
export async function isAvailable() {
	return !!(await load());
}

/** Oturum açmış kullanıcı; yoksa null. */
export async function currentUser() {
	const s = await load();
	if (!s) return null;
	// Firebase oturumu diskten geri yuklerken bir an null doner;
	// ilk durum bildirimini beklemek gerekiyor.
	if (s.auth.currentUser) return özet(s.auth.currentUser);
	return new Promise((resolve) => {
		const bitir = s.a.onAuthStateChanged(s.auth, (u) => {
			bitir();
			resolve(u ? özet(u) : null);
		});
	});
}

function özet(u) {
	return { uid: u.uid, email: u.email || '', name: u.displayName || '' };
}

/**
 * Hesap açar.
 * @returns {Promise<{ok: boolean, user?: object, reason?: string}>}
 */
export async function signUp(email, password, name) {
	const s = await load();
	if (!s) return { ok: false, reason: 'unavailable' };
	try {
		const cred = await s.a.createUserWithEmailAndPassword(s.auth, email, password);
		if (name) await s.a.updateProfile(cred.user, { displayName: name });
		return { ok: true, user: özet(cred.user) };
	} catch (e) {
		return { ok: false, reason: hataKodu(e) };
	}
}

/** Giriş yapar. */
export async function signIn(email, password) {
	const s = await load();
	if (!s) return { ok: false, reason: 'unavailable' };
	try {
		const cred = await s.a.signInWithEmailAndPassword(s.auth, email, password);
		return { ok: true, user: özet(cred.user) };
	} catch (e) {
		return { ok: false, reason: hataKodu(e) };
	}
}

/** Çıkış yapar. Yereldeki veri silinmez. */
export async function signOut() {
	const s = await load();
	if (!s) return { ok: false, reason: 'unavailable' };
	try {
		await s.a.signOut(s.auth);
		return { ok: true };
	} catch (e) {
		return { ok: false, reason: hataKodu(e) };
	}
}

/** Parola sıfırlama e-postası gönderir. */
export async function sendPasswordReset(email) {
	const s = await load();
	if (!s) return { ok: false, reason: 'unavailable' };
	try {
		await s.a.sendPasswordResetEmail(s.auth, email);
		return { ok: true };
	} catch (e) {
		return { ok: false, reason: hataKodu(e) };
	}
}

/** Firebase hata kodlarını sadeleştirir. */
function hataKodu(e) {
	const kod = (e && e.code) || '';
	if (kod.includes('email-already-in-use')) return 'email-in-use';
	if (kod.includes('invalid-email')) return 'invalid-email';
	if (kod.includes('weak-password')) return 'weak-password';
	if (kod.includes('user-not-found') || kod.includes('invalid-credential')) return 'bad-credentials';
	if (kod.includes('wrong-password')) return 'bad-credentials';
	if (kod.includes('too-many-requests')) return 'too-many';
	if (kod.includes('network')) return 'network';
	return 'error';
}

/**
 * Kullanıcının bulut verisini okur.
 *
 * Veri düzeni: users/{uid} belgesinde profil, altındaki `progress`
 * koleksiyonunda kelime başına bir belge. Kelime kayıtlarını ayrı
 * belgelerde tutmak, tek bir kaydı güncellerken bin kaydı yeniden
 * yazmayı önlüyor.
 */
export async function fetchAll() {
	const s = await load();
	if (!s) return { ok: false, reason: 'unavailable' };
	const u = s.auth.currentUser;
	if (!u) return { ok: false, reason: 'signed-out' };

	try {
		const kokRef = s.f.doc(s.db, 'users', u.uid);
		const [kok, ilerleme] = await Promise.all([
			s.f.getDoc(kokRef),
			s.f.getDocs(s.f.collection(s.db, 'users', u.uid, 'progress'))
		]);
		const kayitlar = [];
		ilerleme.forEach((d) => kayitlar.push(d.data()));
		return {
			ok: true,
			profile: kok.exists() ? (kok.data().profile || null) : null,
			progress: kayitlar
		};
	} catch (e) {
		return { ok: false, reason: hataKodu(e) };
	}
}

/**
 * Değişenleri buluta yazar.
 *
 * Firestore toplu yazmada 500 işlem sınırı koyuyor; liste parçalara
 * bölünüyor. Tek tek yazmak binlerce ağ gidiş dönüşü demek olurdu.
 */
export async function pushChanges(profile, records) {
	const s = await load();
	if (!s) return { ok: false, reason: 'unavailable' };
	const u = s.auth.currentUser;
	if (!u) return { ok: false, reason: 'signed-out' };

	const PARCA = 400;
	try {
		if (profile) {
			await s.f.setDoc(
				s.f.doc(s.db, 'users', u.uid),
				{ profile, updatedAt: new Date().toISOString() },
				{ merge: true }
			);
		}
		for (let i = 0; i < records.length; i += PARCA) {
			const toplu = s.f.writeBatch(s.db);
			for (const r of records.slice(i, i + PARCA)) {
				// Kelime kimliginde '/' olabilir; belge kimliginde
				// yasak, o yuzden degistiriliyor.
				const id = String(r.wordId).replace(/\//g, '__');
				toplu.set(s.f.doc(s.db, 'users', u.uid, 'progress', id), r);
			}
			await toplu.commit();
		}
		return { ok: true, yazilan: records.length };
	} catch (e) {
		return { ok: false, reason: hataKodu(e) };
	}
}

/**
 * Hesabı ve bulut verisini siler.
 *
 * Play, hesap açan uygulamalarda uygulama içi hesap silmeyi ZORUNLU
 * tutuyor. Yereldeki veri burada silinmiyor; onu kullanıcı ayrıca
 * seçiyor, çünkü buluttan çıkmak cihazdaki ilerlemeyi kaybetmek
 * anlamına gelmemeli.
 */
export async function deleteAccount() {
	const s = await load();
	if (!s) return { ok: false, reason: 'unavailable' };
	const u = s.auth.currentUser;
	if (!u) return { ok: false, reason: 'signed-out' };

	try {
		const ilerleme = await s.f.getDocs(s.f.collection(s.db, 'users', u.uid, 'progress'));
		const belgeler = [];
		ilerleme.forEach((d) => belgeler.push(d.ref));
		for (let i = 0; i < belgeler.length; i += 400) {
			const toplu = s.f.writeBatch(s.db);
			for (const ref of belgeler.slice(i, i + 400)) toplu.delete(ref);
			await toplu.commit();
		}
		await s.f.deleteDoc(s.f.doc(s.db, 'users', u.uid));
		await s.a.deleteUser(u);
		return { ok: true };
	} catch (e) {
		// Firebase uzun suredir acik oturumlarda silme icin yeniden
		// giris istiyor; kullaniciya bunu soyleyebilmek gerek.
		const kod = (e && e.code) || '';
		if (kod.includes('requires-recent-login')) return { ok: false, reason: 'reauth' };
		return { ok: false, reason: hataKodu(e) };
	}
}
