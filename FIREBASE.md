# Firebase kurulumu (hesap ve bulut yedekleme)

Uygulamanın istemci tarafı hazır. **Firebase projesini ben oluşturamam** —
senin Google hesabınla açılması gerekiyor. Aşağıdaki adımları
tamamlayıp `src/platform/firebase-config.js` dosyasını doldurduğunda
hesap ve eşitleme kendiliğinden devreye girer.

Doldurulana kadar uygulama **tamamen yerel** çalışır: Ayarlar'daki bulut
bölümü hiç görünmez, geri kalan her şey bugünkü gibi işler. Firebase
SDK'sı da pakete girmez (dinamik import), yani boş yapılandırma açılış
hızına yansımaz.

---

## 1. Proje oluştur

1. [console.firebase.google.com](https://console.firebase.google.com) →
   **Proje ekle**
2. Ad: `kelime-havuzum` (istediğini yazabilirsin)
3. Google Analytics: **kapatabilirsin** — uygulama analitik kullanmıyor
   ve açarsan veri güvenliği formunda ek beyan gerekir

## 2. Web uygulaması ekle

1. Proje ana sayfasında **`</>`** (Web) simgesine bas
2. Takma ad: `kelime-havuzum-web`
3. "Firebase Hosting" kutusunu **işaretleme** — gerekmiyor
4. Çıkan `firebaseConfig` nesnesindeki değerleri
   `src/platform/firebase-config.js` içine kopyala

> Bu değerler **gizli değildir**; istemci uygulamalarında açıkta
> bulunurlar ve Google da böyle tasarlamıştır. Veriyi koruyan şey bu
> anahtarlar değil, 4. bölümdeki güvenlik kurallarıdır.

## 3. Kimlik doğrulamayı aç

**Authentication → Sign-in method → E-posta/Şifre → Etkinleştir**

"E-posta bağlantısı (şifresiz)" seçeneğini açma; uygulama parolayla
çalışıyor.

## 4. Firestore ve güvenlik kuralları

**Firestore Database → Veritabanı oluştur → Production mode**

Sonra **Rules** sekmesine şunu yapıştır:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Her kullanıcı YALNIZCA kendi verisine erişir.
    // Bu kural olmadan herkes herkesin ilerlemesini okuyabilir.
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;

      match /progress/{wordId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

**Bu adımı atlama.** Production mode varsayılanı her şeyi reddeder
(uygulama çalışmaz); test mode ise 30 gün sonra her şeyi herkese açar.
Yukarıdaki kural doğru olanı yapar.

## 5. Yapılandırmayı doldur ve derle

`src/platform/firebase-config.js` dosyasını doldurduktan sonra:

```bash
npm run build
```

Derleme sonrası Firebase parçaları ayrı dosyalar olarak üretilir ve
yalnızca kullanıcı hesap bölümüne dokunduğunda indirilir.

---

## 6. Play Store yükümlülükleri

Hesap açan uygulamalarda bunlar **zorunlu**, isteğe bağlı değil.

### Hesap silme

Play, hesap açan uygulamalarda iki yol ister:

1. **Uygulama içinden** — ✅ hazır: Ayarlar → bulut bölümü → "Hesabı sil".
   Buluttaki tüm veriyi ve hesabı siler; cihazdaki ilerlemeye
   dokunmaz.
2. **Herkese açık bir web bağlantısı** — ❗ senin oluşturman gerekiyor.
   Uygulamayı kurmadan da hesap silme talebi yapılabilmeli. Play
   Console'da bu bağlantı ayrıca soruluyor.

En basit çözüm: gizlilik politikasını yayımladığın sayfaya bir bölüm
ekleyip talep için bir e-posta adresi vermek.

### Veri güvenliği formu

Şu anki beyan **"veri cihazdan çıkmaz"** ve Firebase eklendikten sonra
bu **doğru olmayacak**. Play Console → **Uygulama içeriği → Veri
güvenliği** bölümünde güncellenmesi gerekenler:

| Alan | Yeni durum |
|---|---|
| E-posta adresi | Toplanıyor, hesap yönetimi için |
| Ad | Toplanıyor, hesap yönetimi için |
| Uygulama içi etkinlik (ilerleme) | Toplanıyor, uygulama işlevi için |
| Veri aktarımı | Şifreli (HTTPS) |
| Silme talebi | Var (yukarıdaki iki yol) |

### Gizlilik politikası

`privacy-policy.md` dosyası "tüm veriler cihazında kalır" diyor.
Firebase'i yayına aldığında bu bölüm güncellenmeli: hangi verinin
toplandığı, nerede saklandığı (Google Cloud), ne kadar süreyle
tutulduğu ve nasıl silineceği yazılmalı.

---

## 7. Eşitleme nasıl çalışıyor

Bilmen gereken tek kritik nokta şu: birleştirme **"son yazan kazanır"
değil**.

İki cihazda çalışan bir kullanıcının ilerlemesi yanlış birleştirilirse,
aylarca biriktirilmiş tekrar takvimi sessizce bozulur ve kullanıcı bunu
ancak yanlış kelimeler karşısına çıkmaya başlayınca fark eder. Bu yüzden
kural tek yönlü bir gerçeğe dayanıyor: **çalışma geri alınamaz.**

Kelime bazında sırayla:

1. Daha çok çalışılmış kayıt kazanır (geçmiş girdisi sayısı)
2. Eşitse, son çalışma anı daha yeni olan kazanır
3. Hiç çalışılmamışsa "elle öğrenildi" işareti olan kazanır
4. Ayırt edilemiyorsa yerel kalır ve gereksiz yazma yapılmaz

Profil alanları ayrı kurallarla birleşiyor: seri sayaçları geri gitmez
(en büyük kazanır), seviye en son ölçüme göre gelir, günlük sayaç
yalnızca aynı güne aitse karşılaştırılır.

Bu mantık `src/core/sync.js` içinde, saf ve ağdan bağımsız;
`test/sync.test.js` altında 19 testle korunuyor.

### Ne eşitlenir, ne eşitlenmez

Yalnızca **ilerlemesi olan** kayıtlar gönderilir. Paket 5276 kelime
kuruyor ve hepsinin bir kaydı var; hepsini göndermek kullanıcı başına
~1 MB demek ve bilgi taşımıyor — karşı tarafta zaten aynısı var.

Kelime **tanımları** (anlam, örnek cümle, seviye) buluta gitmez; onlar
içerik paketine ait ve uygulamayla birlikte geliyor.

### Maliyet

Ölçülen değerler: ilerleme kaydı ~195 bayt. Aktif bir kullanıcının
2000-3000 çalışılmış kelimesi olsa ~500 KB eder. Firebase'in ücretsiz
katmanı (Spark) 1 GiB depolama ve günlük 50.000 okuma / 20.000 yazma
veriyor — yüzlerce kullanıcıya kadar ücretsiz katman yeter.
