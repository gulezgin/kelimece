# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proje

Kelime Havuzum — Türkçe konuşanlar için aralıklı tekrar (SRS) ile A1–C2
İngilizce kelime öğrenme uygulaması. Çerçevesiz vanilla JS (ES modülleri),
Vite ile paketleniyor, PWA olarak yayımlanıyor ve Capacitor ile Android'e
sarmalanıyor. Tüm veri cihazda kalır; sunucu yok.

Kod yorumları, arayüz metinleri ve commit mesajları **Türkçe**. Girinti
**sekme**. Yorumlar "ne" değil **"neden"** anlatır — bir kararın gerekçesi
ya da bir tuzağın açıklaması yoksa yorum yazma.

## Komutlar

```bash
npm run dev            # Vite geliştirme sunucusu (localhost:5173)
npm run build          # dist/ altına PWA build
npm test               # Tüm testler (vitest)
npm run test:watch     # İzleme modunda
```

Tek dosya / tek test:

```bash
npx vitest run test/srs.test.js
npx vitest run -t "süresi dolmuş abonelik pasif"
```

Android (ayrıntılar `ANDROID.md`):

```bash
npm run android:apk    # İmzasız debug APK — telefonda denemek için
npm run android:build  # İmzalı AAB (önce keystore gerekir)
npm run android:sync   # Yalnızca web varlıklarını native projeye kopyala
```

`android:apk` ve `android:build`, `scripts/android-gradle.mjs` üzerinden
çalışır; bu betik JAVA_HOME'u (Java 21 şart) ve TEMP'i kendisi ayarlar.
Sebebi Windows'a özgü ve şaşırtıcı: ASCII dışı kullanıcı adında TEMP 8.3
kısa biçimde tutuluyor, JDK 17+ ise selector borusu için AF_UNIX soketini
orada oluşturuyor ve `connect()` kısa yolu eşleştiremiyor — Gradle daemon
hiç başlamıyor. `gradlew` doğrudan çağrılırsa bu hataya düşülür.

## Mimarinin dayandığı ayrım: içerik ↔ ilerleme

Projenin en önemli kararı: **tanım ile ilerleme ayrı saklanır.**

- `words` deposu → tanımlar (en, tr, örnek cümle, CEFR, sözcük türü, konu)
- `progress` deposu → kullanıcıya ait olan her şey (seviye, sonraki tekrar
  tarihi, geçmiş, ease, interval)
- Bağ, kararlı kimlik: `core:abandon`

Bu ayrım sayesinde içerik paketi güncellenince (yeni kelime, düzeltilmiş
anlam, yeni örnek cümle) kullanıcının ilerlemesi **yerinde kalır**. Bu
sözleşmeyi bozan bir değişiklik — kimliği hesaplama biçimini değiştirmek,
ilerlemeyi tanımın içine gömmek — sessizce herkesin ilerlemesini siler.
`src/data/migrate.js` ve `test/migrate.test.js` bu davranışı koruyor.

## Katmanlar

| Klasör | Sorumluluk | Kural |
|---|---|---|
| `src/core/` | Saf mantık: SRS, alıştırma üretimi, seviye testi, istatistik, erişim hakları, konular, diyaloglar | DOM'a ve depoya **dokunmaz**; testlerin çoğu buraya bakar |
| `src/data/` | IndexedDB sarmalayıcı (`idb.js`), göç (`migrate.js`), uygulama durumu (`store.js`) | Tek yazma noktası; abonelikle `emit()` |
| `src/ui/` | Çizim ve olaylar | Durumu değiştirmez, geri çağrılara iletir |
| `src/platform/` | Capacitor: bildirim, durum çubuğu, satın alma | Tarayıcıda sessizce hiçbir şey yapmaz |
| `src/main.js` | Tek bağlayıcı: bölüm yönetimi, render, handler nesneleri | Katmanlar arası tüm bağlantılar burada |

`store.js` gözlemlenebilir tek gerçek kaynak: `subscribe(render)` ile
`main.js` kendini bağlar, her yazma işlemi `emit()` çağırır.

## Açılış sırası (`store.init`)

Sıra önemli ve değiştirilmemeli:

1. İçerik paketi indirilir — göç sırasında kararlı kimlik eşleştirmesi için
   tanımlara ihtiyaç var
2. Göç çalışır (1.0 biçimindeki tek depodan iki depolu yapıya)
3. Paket sürümü yeniyse kurulur (tanımlar tazelenir, ilerleme korunur)
4. Bellek yüklenir, tek seferlik onarım geçişi
5. Profil okunur — iç içe nesneler (`reminder`, `premium`) **yüzeysel
   birleştirmede kaybolur**, ayrıca birleştirilir

## İçerik üretim hattı

`public/content/core-v1.json` (5276 kelime) elle düzenlenmez — üretilir.
Kaynaklar `data/` altında, ham veriler `data/sources/` altında (bz2
Tatoeba dökümleri, sıklık listesi; bu yüzden bazı adımlar Python).

```bash
npm run extract:oxford   # Oxford PDF'leri -> data/oxford-lists.json
npm run build:examples   # Tatoeba -> data/examples.json  (yavaş, ~675k cümle)
npm run infer:pos        # sözcük türü + konu -> data/pos-map.json
npm run build:content    # hepsini birleştirip paketi üretir
```

`build:content` en sonda çalışır ve şu girdileri harmanlar: 1.0 yedeği,
`additions-*.json`, `cefr-levels.json`, `examples.json`, `pos-map.json`,
`oxford-lists.json`, `en_50k.txt`.

**İki tuzak:**

1. **Anlam alanı üç ayrı yoldan doluyor** (1.0 yedeği, ek dosyaları, Oxford)
   ve aralarında birleştirme adımları var. Bu yüzden `FIXES.trByWord`
   düzeltmeleri ve `stripEnglishForms` temizliği **en sondaki tek geçişte**
   uygulanır. Erken uygulamak işe yaramaz — sonraki birleştirme eski değeri
   geri getirir. Yeni bir düzeltme türü eklerken aynı yere ekle.
2. **`PACK_VERSION` yükseltilmezse mevcut kurulumlar değişikliği almaz.**
   İçeriği her değiştirdiğinde sürümü artır ve dosyadaki sürüm geçmişi
   yorumuna bir satır ekle.

Kaliteyi denetlemek için:

```bash
python scripts/audit-content.py   # audit-report.txt üretir (git'te yok)
```

Tarama **isabet odaklı** tasarlandı: ilk sürüm "Türkçe derlemde olmayan her
sözcüğü" işaretliyor ve 1373 bulgunun çoğu yanlış alarm çıkıyordu, çünkü
Tatoeba doğal cümlelerden oluşuyor ve sözlük anlamlarındaki mastar biçimleri
("sanmak") doğal metinde neredeyse hiç geçmiyor. Yeni denetim eklerken aynı
ölçüyü koru: 50 gerçek hata, 1400 şüpheliden iyidir.

## Para: erişim hakları

`src/core/entitlements.js` kilit kararının **tek** yeri. A1+A2 ücretsiz,
B1–C2 abonelikle. Kullanıcının kendi eklediği kelime (`source === 'user'`)
seviyesi ne olursa olsun asla kilitlenmez. Aynı kural diyaloglara da
uygulanır (`src/core/dialogues.js`).

`src/platform/billing.js` arayüz sözleşmesini tanımlar ama **gerçek Play
Billing eklentisine bağlı değil** — imzalı AAB ve Play Console ürünleri
olmadan test edilemiyor. Eklentiye `Capacitor.Plugins.InAppPurchases`
üzerinden, çalışma zamanında erişilir; statik `import` derlemeyi kırar.
Bağlama adımları `ANDROID.md` bölüm 12'de.

## Build biçimleri

Aynı kaynak iki hedefe çıkar:

- **PWA** (`npm run build`): servis çalışanı üretilir
- **Capacitor** (`npm run build:capacitor`): `CAP=1` ile servis çalışanı
  **üretilmez** — varlıklar zaten cihazda ve eski bir önbellek güncellemeleri
  gizleyebiliyor

`vite.config.js` içinde `base: './'`; hem GitHub Pages alt dizininde hem de
Capacitor'ın WebView'ünde aynı build çalışsın diye.

## Testler

`test/` altında, `vitest`. Ağırlık `src/core/` üzerinde çünkü orası saf.
Test adları Türkçe cümle. İki dosya kaynak veriyi de doğruluyor:
`content-pack.test.js` üretilen paketi, `dialogues.test.js` diyalog
dosyasını (her satırda çeviri var mı, kimlikler benzersiz mi, ücretsiz
seviyede en az bir diyalog var mı) denetler.

## Bilinmesi gereken diğer noktalar

- **Sıklık sırası müfredatı belirler.** Yeni kelimeler alfabetik değil
  `freqRank` sırasına göre tanıtılır ve oturum başına `dailyGoal` kadarı
  girer (`src/core/srs.js`, `buildReviewQueue`).
- **Mobil yerleşimde `1fr` değil `minmax(0, 1fr)`.** `1fr` aslında
  `minmax(auto, 1fr)` demek ve sütun içeriğin min-content genişliğinin
  altına inemiyor; bu havuz sayfasını 375px ekranda 1484px'e çıkarmıştı.
- **Örnek cümle seçiminde tireli bileşik tek belirteçtir**
  (`scripts/build-examples.py`, `WHOLE_TOKEN_RE`). Aksi halde `old` için
  örnek "ten-year-old" içinden eşleşiyor ve boşluk doldurma alıştırması
  kelimeyi cümlede bulamıyor.
- **Bildirimler inexact alarm kullanır** (`isExactNotification: false`).
  Play, `SCHEDULE_EXACT_ALARM` iznini yalnızca alarm/takvim uygulamalarına
  açıyor; ayrıca izin yokken API 31+ kullanıcının yüzüne sistem ayar ekranı
  açıyor. Günlük çalışma hatırlatması için dakika hassasiyeti gerekmiyor.
- **Giriş ekranı `index.html` gövdesinin en başında, satır içi.** JS paketi
  yüklenmeden boyanabilsin ve yerel açılış ekranıyla arasında geçiş
  görünmesin diye. `main.js` veri hazır olunca kaldırır.

## Bulut eşitleme (Firebase)

İstemci tarafı hazır ama **yapılandırma boş**:
`src/platform/firebase-config.js`. Doldurulana kadar uygulama tamamen
yerel çalışır, Ayarlar'daki bulut bölümü görünmez ve Firebase SDK'sı
pakete girmez (dinamik import; Rollup boş yapılandırmayı statik olarak
çözüp import'u eliyor). Kurulum adımları `FIREBASE.md`.

**Birleştirme "son yazan kazanır" DEĞİL.** İki cihazda çalışan bir
kullanıcının ilerlemesi yanlış birleştirilirse tekrar takvimi sessizce
bozulur ve bu ancak geri dönüşü olmayan bir noktada fark edilir. Kural
tek yönlü bir gerçeğe dayanıyor: çalışma geri alınamaz — daha çok
çalışılmış kayıt kazanır, ne zaman yazıldığından bağımsız olarak.
`src/core/sync.js` saf ve ağdan bağımsız; değiştirmeden önce
`test/sync.test.js`'i oku.

Yalnızca **ilerlemesi olan** kayıtlar gönderilir (`isWorthSyncing`).
Paket 5276 kayıt kuruyor; hepsini göndermek kullanıcı başına ~1 MB
demek ve bilgi taşımıyor.

## Yerel profil vs hesap

İki ayrı şey ve karıştırılmamalı:

- `src/core/account.js` — **yerel profil** (ad, e-posta). Cihazda durur,
  sunucuya gitmez, yedek görevi görmez.
- `src/platform/cloud.js` — **gerçek hesap** (Firebase). Yapılandırma
  varsa çalışır.

Arayüz yerel profilin yedek olmadığını açıkça yazıyor; bunu gizlemek
kullanıcının verisinin bulutta durduğunu sanmasına yol açar.

## İlgili belgeler

- `FIREBASE.md` — Firebase kurulumu, güvenlik kuralları, Play yükümlülükleri
- `ANDROID.md` — Android projesi, imzalama, Play Console, sorun giderme
- `store-listing.md`, `privacy-policy.md` — mağaza yayını için hazır metinler
- `README.md` — kullanıcıya dönük tanıtım (bazı bölümleri 1.0 dönemine ait
  ve güncel değil; mimari için bu dosyaya güven)
