# Android'e taşıma ve Play Store rehberi

Bu belge, uygulamayı Capacitor ile Android projesine dönüştürüp Play
Store'a yüklenebilir **imzalı bir AAB** üretmek için gereken her adımı
içerir.

**Durum:** 0-3 arası adımlar tamamlandı. `android/` projesi oluşturuldu,
ikonlar ve açılış ekranı tüm yoğunluklar için üretildi, bildirim ikonu
eklendi, web varlıkları kopyalandı. **Başlangıç noktan 4. bölüm.**

Kalan her şey senin makinende yapılması gerekenler: Android Studio kurulumu
(JDK 17+ ve SDK'yı birlikte getirir), imzalama anahtarı ve Play Console.

---

## 0. Ön koşullar

| Gereksinim | Sürüm | Durum |
|---|---|---|
| **Node.js** | 22+ | ✅ v24.19.0 |
| **Java JDK** | **21** | ✅ Temurin 21 kuruldu |
| **Android SDK** | Platform 36 + Build Tools 35/36 | ✅ komut satırı araçlarıyla kuruldu |
| Android Studio | — | Kurulmadı; **derleme için gerekmiyor** |

**Java 21 şart.** Capacitor 8 eklentileri 21 hedefliyor; JDK 17 ile
derleme `Cannot find a Java installation ... languageVersion=21`
hatasıyla duruyor.

Android Studio yalnızca emülatör ve görsel hata ayıklama için
gerekli. APK/AAB üretmek için komut satırı yeterli:

```bash
npm run android:apk
```

### Android Studio (isteğe bağlı)

[developer.android.com/studio](https://developer.android.com/studio)
adresinden kur. İlk açılışta **SDK Manager**'dan şunları işaretle:

- Android SDK Platform 36
- Android SDK Build-Tools 36
- Android SDK Platform-Tools
- Android SDK Command-line Tools

Kurulum bitince Android Studio'yu bir kez açıp **File → Open** ile bu
projenin `android/` klasörünü seç. İlk Gradle eşitlemesi birkaç dakika
sürer ve eksik bileşenleri kendisi indirir.

---

## 1. Android projesini oluştur ✅ yapıldı

`android/` klasörü oluşturuldu ve git'e girdi. Tekrar çalıştırman
gerekmiyor; sıfırdan kurman gerekirse komut şu:

```bash
npm run android:add
```

> Paket adı `capacitor.config.json` içinde `com.gulezgin.kelimehavuzum`
> olarak ayarlı. **Play Store'a ilk yüklemeden sonra bu asla
> değiştirilemez.** Değiştireceksen şimdi yap.

---

## 2. Web build'ini Android'e kopyala

Her kod değişikliğinden sonra:

```bash
npm run android:sync
```

Bu, `CAP=1 vite build` ile servis çalışanı olmadan derler (yerel
WebView'de gereksiz) ve `npx cap sync android` ile `android/` içine
kopyalar.

---

## 3. İkon ve açılış ekranı ✅ yapıldı

74 varlık üretildi (tüm yoğunluklar, yatay/dikey, açık/koyu). Ayrıca
`res/drawable/ic_stat_notify.xml` eklendi: Android bildirim ikonunu
maske olarak çizdiği için uygulama ikonu orada kullanılamaz — beyaz bir
lekeye dönüşür. Bu dosya aynı kitap şeklinin tek renk siluetidir.

Kaynak görseller `assets/generated/` altında:

| Dosya | Kullanım |
|---|---|
| `icon-1024.png` | Uygulama ikonu |
| `icon-foreground-1024.png` | Adaptif ikon ön planı (şeffaf) |
| `splash-2732.png` | Açılış ekranı (açık) |
| `splash-2732-dark.png` | Açılış ekranı (koyu) |

Bunları Android'in beklediği tüm boyutlara dönüştürmek için:

```bash
npx @capacitor/assets generate --android --iconBackgroundColor "#0f1320" --splashBackgroundColor "#0f1320"
```

Tasarımı değiştirmek istersen `assets/icon.svg` dosyasını düzenle, sonra:

```bash
npm run build:icons
```

---

## 4. İmzalama anahtarı (keystore)

**Bu adımı ben yapamam — parola girmen gerekiyor.**

```bash
keytool -genkey -v -keystore kelime-havuzum.keystore -alias kelimehavuzum -keyalg RSA -keysize 2048 -validity 10000
```

Komut sırayla soracak: keystore parolası, ad-soyad, kurum, şehir, ülke
kodu (TR), sonra anahtar parolası.

### ⚠️ Bu dosyayı kaybetme

`kelime-havuzum.keystore` dosyası ve parolaları **uygulamanın kimliği**.
Kaybedersen aynı uygulamayı bir daha güncelleyemezsin — yeni bir uygulama
olarak, sıfır indirmeyle baştan başlaman gerekir.

- Dosyayı en az iki ayrı yerde yedekle (şifreli bulut + harici disk)
- Parolaları bir parola yöneticisinde sakla
- **Asla git'e ekleme** — `.gitignore` zaten `*.keystore` ve
  `keystore.properties` dosyalarını hariç tutuyor

> Google Play App Signing kullanırsan Google senin adına bir imzalama
> anahtarı tutar ve bu anahtar kaybolursa kurtarma mümkün olur. Yine de
> yükleme anahtarını (upload key) yedeklemen gerekir.

### Gradle'a tanıt

`android/keystore.properties` dosyası oluştur (git'e girmez):

```properties
storeFile=../../kelime-havuzum.keystore
storePassword=BURAYA_KEYSTORE_PAROLASI
keyAlias=kelimehavuzum
keyPassword=BURAYA_ANAHTAR_PAROLASI
```

Sonra `android/app/build.gradle` dosyasında `android { ... }` bloğunun
**içine** şunu ekle:

```gradle
    def keystorePropertiesFile = rootProject.file("keystore.properties")
    def keystoreProperties = new Properties()
    if (keystorePropertiesFile.exists()) {
        keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
    }

    signingConfigs {
        release {
            if (keystorePropertiesFile.exists()) {
                storeFile file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
            }
        }
    }

    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            shrinkResources true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
```

---

## 5. Sürüm numarası

`android/app/build.gradle` içinde `defaultConfig` bloğu:

```gradle
    versionCode 1        // her yüklemede +1, asla azalmaz
    versionName "1.5.0"  // kullanıcının gördüğü sürüm
```

`versionCode` Play Store'un sıralama için kullandığı tam sayı. Her yeni
yüklemede mutlaka artmalı.

---

## 6. APK / AAB üret

**Telefonda denemek için (imza gerektirmez):**

```bash
npm run android:apk
```

Çıktı: `android/app/build/outputs/apk/debug/app-debug.apk` (~5,3 MB).
Telefona kopyalayıp aç — "bilinmeyen kaynaklardan yükleme"ye izin
vermen gerekir. Bu yapıyla **satın alma test edilemez** (12. bölüm).

**Play Store için (imzalı):**

```bash
npm run android:build
```

Çıktı: `android/app/build/outputs/bundle/release/app-release.aab`.
Önce 4. bölümdeki keystore'u oluşturmuş olman gerekir.

Her iki komut da `scripts/android-gradle.mjs` üzerinden çalışıyor;
bu betik JAVA_HOME'u ve TEMP'i kendisi ayarlıyor (sebebi aşağıda,
"Sık karşılaşılan sorunlar").

---

## 7. Play Console

### Hesap

[play.google.com/console](https://play.google.com/console) — **tek
seferlik 25 USD** kayıt ücreti. Bireysel hesap açıyorsan kimlik
doğrulaması isteniyor ve birkaç gün sürebilir.

> 2023 sonrası kurallar: bireysel geliştirici hesaplarında, yayına
> almadan önce **12 test kullanıcısıyla 14 gün** kapalı test yapma
> zorunluluğu var. Bunu planlamana kat — uygulamayı bitirdiğin gün
> yayınlayamazsın.

### Uygulama oluştur

1. **Uygulama oluştur** → ad: *Kelime Havuzum*, dil: Türkçe,
   tür: Uygulama, ücretsiz
2. **Uygulama içeriği** bölümündeki her maddeyi doldur (aşağıda)
3. **Üretim → Yeni sürüm oluştur** → AAB'yi yükle

### Mağaza kaydı için gerekenler

| Öğe | Gereksinim |
|---|---|
| Uygulama simgesi | 512×512 PNG — `assets/generated/icon-1024.png` küçültülür |
| Öne çıkan grafik | 1024×500 PNG |
| Telefon ekran görüntüsü | En az 2, en fazla 8 — 16:9 veya 9:16 |
| Kısa açıklama | En fazla 80 karakter |
| Tam açıklama | En fazla 4000 karakter |

Hazır metinler `store-listing.md` dosyasında.

---

## 8. İçerik derecelendirmesi

Play Console → **Uygulama içeriği → İçerik derecelendirmesi**.
Anket doldurulur; bu uygulama için doğru cevaplar:

| Soru | Cevap |
|---|---|
| Kategori | Eğitim |
| Şiddet | Hayır |
| Cinsellik | Hayır |
| Küfür / kaba dil | Hayır |
| Kontrollü maddeler | Hayır |
| Kumar | Hayır |
| Kullanıcılar etkileşime girebiliyor mu | Hayır |
| Konum paylaşımı | Hayır |
| Kişisel bilgi paylaşımı | Hayır |
| Dijital satın alma | *Abonelik eklendiğinde* Evet |

Beklenen sonuç: **3+ / Herkes**.

> Kelime havuzunda `bitch`, `damn` gibi kelimeler **yok** — içerik
> paketi üretilirken küfür elendi. Sonradan eklersen bu cevabı gözden
> geçir.

---

## 9. Veri güvenliği formu

Play Console → **Uygulama içeriği → Veri güvenliği**. Bu uygulamanın
şu anki hâli için:

| Soru | Cevap |
|---|---|
| Kullanıcı verisi topluyor mu? | **Hayır** |
| Veri üçüncü taraflarla paylaşılıyor mu? | Hayır |
| Veriler aktarım sırasında şifreleniyor mu? | Yok sayılır (veri gönderilmiyor) |
| Kullanıcı verisinin silinmesini isteyebilir mi? | Evet — uygulama içinden |

Tüm veriler cihazda IndexedDB'de duruyor, hiçbir sunucuya gitmiyor.

> **Reklam veya analitik eklediğin gün bu form değişir.** AdMob
> eklersen: "Uygulama kimliği", "Reklam kimliği" ve genelde "Yaklaşık
> konum" toplandığını beyan etmen gerekir. Yanlış beyan uygulamanın
> kaldırılmasına yol açar.

---

## 10. Gizlilik politikası

Play Store **zorunlu tutuyor** — herkese açık bir URL olmalı.
`privacy-policy.md` dosyasında hazır bir metin var.

En kolay yayınlama yolu, GitHub Pages:

1. Depoyu GitHub'a gönder
2. Settings → Pages → Source: `main` dalı, `/docs` klasörü
3. `privacy-policy.md` dosyasını `docs/` altına kopyala
4. URL: `https://gulezgin.github.io/WordPool-TR-EN/privacy-policy`

Bu URL'yi Play Console'da **Mağaza kaydı → Gizlilik politikası**
alanına gir.

---

## 11. Yayın öncesi kontrol listesi

- [ ] Node 22 LTS kurulu, `npm install` tazelendi
- [ ] `npm test` — tüm testler geçiyor
- [ ] `npm run android:sync` çalıştırıldı
- [ ] Gerçek cihazda test edildi (emülatör yeterli değil)
- [ ] Geri tuşu doğru çalışıyor (diyalog kapanıyor, uygulamadan çıkmıyor)
- [ ] Çevrimdışı açılıyor (uçak modunda dene)
- [ ] `versionCode` artırıldı
- [ ] Keystore **iki ayrı yerde** yedeklendi
- [ ] Gizlilik politikası URL'si yayında
- [ ] İçerik derecelendirmesi ve veri güvenliği formları dolduruldu
- [ ] 12 test kullanıcısıyla 14 günlük kapalı test tamamlandı


---

## 12. Play Billing'i bağlama

`src/platform/billing.js` arayüz sözleşmesini ve akışı tanımlıyor ama
**gerçek bir satın alma eklentisine bağlı değil**. Sebep: satın alma akışı
yalnızca imzalı bir AAB ve Play Console'da tanımlı ürünlerle test
edilebiliyor. O güne kadar ekran "yakında" diyor ve satın alma denemiyor.

> **Önce 6. bölümü bitir.** Sade uygulamanın derlendiğini görmeden
> eklenti ekleme; derleme patlarsa hatanın kurulumdan mı yoksa eklentiden
> mi geldiğini ayırt edemezsin.

### 12.1 Eklentiyi kur

```bash
npm install @capacitor-community/in-app-purchases
npx cap sync android
```

`billing.js` eklentiye Capacitor'ın çalışma zamanı kaydından erişiyor
(`Capacitor.Plugins.InAppPurchases`), doğrudan `import` ile değil. Böylece
eklenti yokken derleme kırılmıyor ve kurulduğu anda **kod değişikliği
gerekmeden** devreye giriyor.

Kurduktan sonra eklentinin kayıt adını doğrula — farklıysa `billing.js`
içindeki `Capacitor.Plugins.InAppPurchases` satırını ona göre düzelt:

```js
// Uygulama cihazda çalışırken Chrome DevTools konsolunda:
Object.keys(Capacitor.Plugins)
```

### 12.2 Ürünleri Play Console'da tanımla

**Monetize → Products** altında aşağıdaki kimlikleri **birebir** oluştur.
Bunlar `src/core/entitlements.js` içindeki `PRODUCTS` ile eşleşmeli;
bir harf farkı satın almayı sessizce bozar:

| Kimlik | Tür | Önerilen fiyat |
|---|---|---|
| `premium_monthly` | Abonelik | ₺59 / ay |
| `premium_yearly` | Abonelik | ₺399 / yıl |
| `premium_lifetime` | Tek seferlik ürün | ₺899 |

Fiyatlar `billing.js` içindeki `PRICING` dizisinde de yer alıyor, ama
oradakiler yalnızca **eklenti yokken** gösterilen yer tutuculardır.
Eklenti bağlandığında gerçek fiyat Play'den, kullanıcının para
biriminde gelir. İkisini tutarlı tutmakta fayda var.

### 12.3 Test et

Satın alma **yalnızca Play üzerinden kurulmuş imzalı bir yapıda**
çalışır. `adb install` ile kurulan APK'da çalışmaz.

1. AAB'yi **Internal testing** kanalına yükle
2. **Setup → License testing** altına kendi Google hesabını ekle —
   böylece gerçek ücret ödemeden satın alma yapabilirsin
3. Test bağlantısından kur ve ödeme duvarını dene
4. **Geri yükleme yolunu da test et** — Play politikası bunu zorunlu
   tutuyor: cihaz değiştiren kullanıcı ödediğini geri alabilmeli

### 12.4 Sunucu taraflı doğrulama (sonraya bırakıldı)

Şu anki doğrulama cihazda yapılıyor: eklenti "satın alındı" derse abonelik
etkinleşiyor. Bu, kökü açılmış bir cihazda aşılabilir.

Kullanıcı sayısı anlamlı gelire ulaşınca **Play Developer API** ile sunucu
tarafı doğrulama ekle. Bugün için doğru karar değil: sunucu işletme
maliyeti, kaybı muhtemel gelirden yüksek.

---

## 13. Konuşma tanımayı bağlama (Android)

Rol yapma alıştırmasındaki **konuşma adımı** cihazın konuşma tanıyıcısını
kullanıyor. Tarayıcıda Web Speech API ile çalışıyor; Android WebView'de
o API yok, native eklenti gerekiyor.

```bash
npm install @capacitor-community/speech-recognition
npx cap sync android
```

Eklentiye Capacitor'ın çalışma zamanı kaydından erişiliyor
(`Capacitor.Plugins.SpeechRecognition`), doğrudan `import` ile değil —
aynı Play Billing'de olduğu gibi, statik import derlemeyi kırıyor.
Eklenti kurulduğunda kod değişikliği gerekmeden devreye giriyor.

**Eklenti kurulmazsa ne olur:** `isSupported()` false döner ve rol
yapmada konuşma adımı hiç verilmez; diğer üç mod (seçme, dizme, boşluk
doldurma) çalışmaya devam eder. Çalışmayan bir mikrofon düğmesi
gösterilmez.

### Mikrofon izni

Eklenti kendi manifest'inde `RECORD_AUDIO` iznini bildiriyor; ayrıca
eklemeye gerek yok. İzin ilk kullanımda isteniyor.

Play veri güvenliği formunda **ses kaydı** beyanı gerekmiyor: ses
cihazdan çıkmıyor, tanıma cihazın kendi motorunda yapılıyor ve kayıt
saklanmıyor. Cihazın tanıyıcısı Google'ın bulut motorunu kullanıyorsa
bu Google'ın kendi beyanı kapsamındadır; yine de gizlilik politikasında
konuşma tanımanın cihazın sistem servisine devredildiğini yazmak doğru
olur.

> **Ölçülen şey telaffuz puanı DEĞİL.** Uygulama, tanıyıcının duyduğu
> metni hedef cümleyle karşılaştırıyor. Fonem düzeyinde analiz
> (ör. "TH sesin zayıf") ücretli ve özel bir servis gerektiriyor;
> arayüz bu farkı gizlemiyor.

---

## Sık karşılaşılan sorunlar

**Gradle "Unable to establish loopback connection" diyor**
Bu makineye özgü ve tanısı zor bir sorun: Windows kullanıcı adı
ASCII dışı bir harf içerdiği için `TEMP` 8.3 kısa biçimde tutuluyor
(`MS9AC9~1` gibi). JDK 17+ selector borusu için AF_UNIX soketi
kullanıyor ve onu `TEMP` altında otomatik adlandırıyor; Windows'un
AF_UNIX `connect()` çağrısı kısa yolu bind edilen adla
eşleştiremiyor ve Gradle daemon hiç başlamıyor.

`npm run android:apk` / `android:build` bunu kendisi çözüyor. Elle
`gradlew` çalıştıracaksan önce:

```bash
export TEMP=/c/AndroidBuildTmp TMP=/c/AndroidBuildTmp
```

**Gradle "Your project path contains non-ASCII characters" diyor**
Aynı sebep, farklı nokta. `android/gradle.properties` içindeki
`android.overridePathCheck=true` bu denetimi kapatıyor — derleme
bu ayarla sorunsuz tamamlanıyor.

**Gradle "Cannot find a Java installation ... languageVersion=21" diyor**
JDK 21 kurulu değil ya da Gradle başka bir JDK seçmiş:

```bash
winget install EclipseAdoptium.Temurin.21.JDK
```

**Gradle "SDK location not found" diyor**
`android/local.properties` oluştur:
`sdk.dir=C\:\\Users\\<kullanıcı>\\AppData\\Local\\Android\\Sdk`

**Uygulama beyaz ekranda kalıyor**
`webDir` ile build çıktısı uyuşmuyor demektir. `npm run build`
çalıştığından ve `dist/index.html` oluştuğundan emin ol, sonra
`npx cap sync android`.

**Play Console targetSdkVersion uyarısı veriyor**
Proje şu an 36 hedefliyor (`android/variables.gradle`). Play'in alt
sınırı yükselirse buradan değiştirip `npx cap sync android` çalıştır.

**AAB imzasız görünüyor**
`keystore.properties` yolu yanlış olabilir. `storeFile` yolu
`android/` klasörüne göre göreli: kök dizindeki keystore için
`../../kelime-havuzum.keystore`.
