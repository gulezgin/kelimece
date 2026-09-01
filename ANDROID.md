# Android'e taşıma ve Play Store rehberi

Bu belge, uygulamayı Capacitor ile Android projesine dönüştürüp Play
Store'a yüklenebilir **imzalı bir AAB** üretmek için gereken her adımı
içerir.

Kodun Capacitor tarafı hazır: yapılandırma, ikonlar, açılış ekranı
kaynakları ve yerel entegrasyon (durum çubuğu, geri tuşu) yazıldı.
Kalan adımlar makinende çalıştırman gerekenler.

---

## 0. Ön koşullar

| Gereksinim | Sürüm | Not |
|---|---|---|
| **Node.js** | **22 LTS** | Capacitor 8 CLI en az 22 istiyor. Şu an 20.13 kurulu — **önce bunu yükselt** |
| Java JDK | 21 | Android Studio ile birlikte gelir |
| Android Studio | Güncel sürüm | SDK ve emülatör için |
| Android SDK | Platform 35 + Build Tools 35 | Play Store yeni uygulamalarda API 35 istiyor |

### Node yükseltme (Windows)

```bash
winget install OpenJS.NodeJS.LTS
```

Sonra yeni bir terminal aç ve doğrula:

```bash
node -v
```

`v22.x.x` görmelisin. Ardından bağımlılıkları tazele:

```bash
npm install
```

### Android Studio

[developer.android.com/studio](https://developer.android.com/studio)
adresinden kur. İlk açılışta **SDK Manager**'dan şunları işaretle:

- Android SDK Platform 35
- Android SDK Build-Tools 35
- Android SDK Platform-Tools
- Android SDK Command-line Tools

---

## 1. Android projesini oluştur

```bash
npm run android:add
```

Bu komut `npx cap add android` çalıştırır ve kök dizinde `android/`
klasörünü oluşturur. **Bu klasör git'e girer** — içinde imzalama
ayarları ve yerel özelleştirmeler olacak.

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

## 3. İkon ve açılış ekranı

Kaynak görseller `assets/generated/` altında hazır:

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

## 6. AAB üret

```bash
npm run android:build
```

Çıktı:

```
android/app/build/outputs/bundle/release/app-release.aab
```

Yüklemeden önce yerel olarak test etmek istersen:

```bash
npm run android:open
```

Android Studio açılır; oradan emülatörde veya bağlı cihazda
çalıştırabilirsin.

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

## Sık karşılaşılan sorunlar

**`npx cap add android` "requires NodeJS >=22" diyor**
Node'u yükselt (bkz. bölüm 0). `nvm` kullanıyorsan `nvm use 22`.

**Gradle "SDK location not found" diyor**
`android/local.properties` oluştur:
`sdk.dir=C\:\\Users\\<kullanıcı>\\AppData\\Local\\Android\\Sdk`

**Uygulama beyaz ekranda kalıyor**
`webDir` ile build çıktısı uyuşmuyor demektir. `npm run build`
çalıştığından ve `dist/index.html` oluştuğundan emin ol, sonra
`npx cap sync android`.

**Play Console "targetSdkVersion 35 olmalı" diyor**
`android/variables.gradle` içinde `targetSdkVersion` ve
`compileSdkVersion` değerlerini 35 yap, sonra `npx cap sync android`.

**AAB imzasız görünüyor**
`keystore.properties` yolu yanlış olabilir. `storeFile` yolu
`android/` klasörüne göre göreli: kök dizindeki keystore için
`../../kelime-havuzum.keystore`.
