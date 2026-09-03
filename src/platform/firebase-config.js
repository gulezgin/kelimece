/**
 * Firebase yapılandırması.
 *
 * BOŞ BIRAKILDI — proje senin Google hesabınla, Firebase Console'dan
 * oluşturuluyor. Adımlar `FIREBASE.md` dosyasında.
 *
 * Buradaki değerler doldurulana kadar uygulama TAMAMEN yerel çalışır:
 * hesap ve bulut yedekleme görünmez, geri kalan her şey bugünkü gibi
 * işler. Firebase SDK'sı da yüklenmez (dinamik import), yani boş
 * yapılandırma paket boyutuna da yansımaz.
 *
 * Bu değerler GİZLİ DEĞİLDİR; istemci uygulamalarında açıkta bulunurlar
 * ve Google da böyle tasarlamıştır. Veriyi koruyan şey bu anahtarlar
 * değil, Firestore güvenlik kurallarıdır (FIREBASE.md bölüm 4).
 */
export const FIREBASE_CONFIG = {
	apiKey: '',
	authDomain: '',
	projectId: '',
	storageBucket: '',
	messagingSenderId: '',
	appId: ''
};

/** Yapılandırma dolduruldu mu? */
export function isConfigured() {
	return !!(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId);
}
