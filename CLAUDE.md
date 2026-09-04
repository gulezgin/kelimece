# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proje

Kelime Havuzum — Türkçe konuşanlar için A1–C2 İngilizce öğrenme
uygulaması. Çekirdeği aralıklı tekrar (SRS) ile kelime; üstüne
dilbilgisi, okuma, yazma, e-posta, rol yapmalı diyalog, zıt anlamlılar,
kişisel listeler, IELTS/TOEFL modu ve acil İngilizce eklendi.

Çerçevesiz vanilla JS (ES modülleri), Vite ile paketleniyor, PWA olarak
yayımlanıyor ve Capacitor ile Android'e sarmalanıyor. Veri cihazda
kalır; Firebase yapılandırılırsa isteğe bağlı bulut yedeği açılıyor.

**Ölçek:** ~5300 kelime, 27 test dosyası / 639 test, `src/` altında
~60 modül, alt çubukta 5 sekme ve 16 bölüm.

Kod yorumları, arayüz metinleri ve commit mesajları **Türkçe**. Girinti
**sekme**. Yorumlar "ne" değil **"neden"** anlatır — bir kararın gerekçesi
ya da bir tuzağın açıklaması yoksa yorum yazma.

## Komutlar

```bash
npm run dev            # Vite geliştirme sunucusu (localhost:5173)
npm run build          # dist/ altına PWA build
npm test               # Tüm testler (vitest)
npm run test:watch     # İzleme modunda
npm run check:ids      # $('id') <-> index.html çapraz denetimi
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
| `src/core/` | Saf mantık: SRS, alıştırma üretimi, seviye testi, istatistik, erişim hakları, konular, diyaloglar, dilbilgisi, okuma, yazma, zıt anlamlılar, listeler, XP, rozetler, haftalık hedef, sınav, acil | DOM'a ve depoya **dokunmaz**; testlerin çoğu buraya bakar |
| `src/data/` | IndexedDB sarmalayıcı (`idb.js`), göç (`migrate.js`), uygulama durumu (`store.js`) | Tek yazma noktası; abonelikle `emit()` |
| `src/ui/` | Çizim ve olaylar | Durumu değiştirmez, geri çağrılara iletir |
| `src/platform/` | Capacitor ve tarayıcı API'leri: bildirim, durum çubuğu, satın alma, konuşma tanıma, ses kaydı, bulut | Desteklenmeyen ortamda sessizce hiçbir şey yapmaz |
| `src/main.js` | Tek bağlayıcı: bölüm yönetimi, render, handler nesneleri | Katmanlar arası tüm bağlantılar burada |

`store.js` gözlemlenebilir tek gerçek kaynak: `subscribe(render)` ile
`main.js` kendini bağlar, her yazma işlemi `emit()` çağırır.

### Bölüm haritası

Alt çubukta **beş sekme** var ama **on altı bölüm**. "Öğren" sekmesi bir
hub: altındaki her şey `navLearn`'ü yakılı bırakıyor. Sekme sayısını
artırmak 375 px ekranda alt çubuğu okunmaz yapıyor.

| Sekme | Bölüm (`activeSection`) | View kimliği | Çizen |
|---|---|---|---|
| Ana | `home` | `homeView` | `ui/dashboard.js` |
| Ana | `stats` | `statsView` | `ui/statsView.js` + `ui/progress.js` |
| Öğren | `learn` | `learnView` | `ui/learn.js` |
| Öğren | `topics` | `topicsView` | `ui/topics.js` |
| Öğren | `grammar` | `grammarView` | `ui/grammar.js` |
| Öğren | `reading` | `readingView` | `ui/reading.js` |
| Öğren | `writing` | `writingView` | `ui/writing.js` |
| Öğren | `email` | `emailView` | `ui/writing.js` (aynı motor) |
| Öğren | `antonyms` | `antonymsView` | `ui/antonyms.js` |
| Öğren | `lists` | `listsView` | `ui/lists.js` |
| Öğren | `exam` | `examView` | `ui/exam.js` |
| Öğren | `examWriting` | `examWritingView` | `ui/writing.js` (aynı motor) |
| Öğren | `emergency` | `emergencyView` | `ui/emergency.js` |
| Diyalog | `dialogues` | `dialoguesView` | `ui/dialogues.js`, `ui/dialoguePractice.js` |
| Havuz | `pool` | `poolView` | `ui/wordList.js` |
| Ayarlar | `settings` | `settingsView` | `index.html` (statik) + `ui/cloudPanel.js` |

Yeni bölüm eklerken **dört yer** güncelleniyor ve biri unutulursa ekran
sessizce boş kalıyor: `index.html`'de `<main id="...View">`,
`showSection`'daki `sections` dizisi, `render()` içindeki dal ve
`learnModules()`.

**Her değişiklikten sonra kimlik denetimini çalıştır:**

```bash
npm run check:ids
```

`$('id')` ile aranan ama `index.html`'de olmayan bir kimlik,
`null.addEventListener` ile açılışın **tamamını** kırıyor — ve bu hata
hem build'i hem testleri geçiyor (test ortamında DOM yok, sözdizimi
geçerli). İki kez oldu; bu yüzden `scripts/check-ids.mjs` var.
Çalışma zamanında üretilen elemanlar betikteki `RUNTIME_IDS` içinde
muaf tutuluyor.

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

## İçerik dosyaları

`public/content/` altındaki her dosya bağımsız indiriliyor ve
**kelime paketinden ayrı**. Sebep mimari: pakete alan eklemek
`PACK_VERSION` yükseltmeyi ve 5276 kaydın yeniden kurulmasını
gerektirir. Bu dosyalar ilerlemeyle ilgisi olmayan salt içerik.

| Dosya | İçerik | Kullanan |
|---|---|---|
| `core-v1.json` | 5276 kelime — **üretilir, elle düzenlenmez** | `data/store.js` |
| `dialogues.json` | Rol yapma diyalogları, A1–C2 × 10 | `core/dialogues.js` |
| `grammar.json` | 12 ders, 36 quiz sorusu | `core/grammar.js` |
| `reading.json` | 10 parça (hikâye + makale), 30 soru | `core/reading.js` |
| `writing.json` | 8 yazma görevi | `core/writing.js` |
| `email.json` | 6 e-posta görevi | `core/writing.js` (aynı motor) |
| `antonyms.json` | 68 zıt anlamlı çift | `core/antonyms.js` |
| `exam.json` | IELTS/TOEFL biçim, görev, kelime | `core/exam.js` |
| `emergency.json` | 6 acil durum, cümleler | `core/emergency.js` |

Yeni içerik dosyası eklerken **dört şey** gerekiyor: dosyanın kendisi,
`core/` altında saf bir okuyucu, `main.js`'te `BASE_URL + 'content/...'`
sabiti ve içeriği doğrulayan bir test.

**İçerik testleri kaynak veriyi de denetliyor** ve bu bilinçli: bir
alıştırma dosyasındaki hata testte değil kullanıcıda ortaya çıkar.
Yakalananlar arasında IELTS örnek cevaplarının kelime sınırının altında
kalması ve okuma sorularının şık dizisi dışına taşan cevap indeksi var.

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
Test adları Türkçe cümle. **Dokuz dosya kaynak veriyi de doğruluyor**:
`content-pack`, `dialogues`, `grammar`, `reading`, `writing`,
`antonyms`, `exam`, `emergency`, `speech`.

İçerik testlerinde tekrarlayan üç ölçü:

1. **Örnek cevap kendi kontrolünü geçmeli.** Geçmiyorsa ya görev
   imkânsız ya örnek yanlış; ikisi de kullanıcıyı çıkışsız bırakıyor.
2. **Yanlış alarm, kaçırmaktan kötüdür.** Doğru yazılmış bir cümleye
   "yanlış" demek öğrencinin doğruyu bozmasına yol açıyor. Bu yüzden
   `writing.test.js` her hata kalıbı için hem yakalaması hem
   **yakalamaması** gereken bir örnek tutuyor.
3. **Ücretsiz katman ayrıca test ediliyor.** Tüm içerik üzerinde geçen
   bir kural, kilitli içerik elenince bozulabiliyor —
   `antonyms.test.js`'teki sözcük türü testi tam bu yüzden iki kez var.

DOM testi **yok**: `vitest` `environment: 'node'` ile çalışıyor.
Arayüz davranışı tarayıcıda elle doğrulanıyor, mimari değişmezler ise
bu dosyada yazılı.

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
- **Quiz ilerlemesi çizim fonksiyonunun dışında tutulur.** `renderQuiz`
  ve `renderComprehension` durumu `main.js`'ten `run` nesnesiyle alır.
  Sebebi: depoya her yazma `emit()` → `render()` zinciri kuruyor. Durum
  closure'da olsaydı quiz ortasındaki her yazma kullanıcıyı birinci
  soruya döndürürdü. Aynı nedenle puanlama (`onPassed`) çizim sırasında
  değil, son sorudan sonraki tıklamada çağrılır — çizim içinde yazmak
  quizi kendi üstüne yeniden çizdiriyordu.
- **Yazma kontrolü anlamı ölçmüyor ve bunu saklamıyor.** `core/writing.js`
  üç kesin şeye bakar: uzunluk, görevin şart koştuğu ögeler, kalıplaşmış
  hatalar. Üslup ya da içerik puanı vermek bir dil modeli ister; uydurma
  bir puan öğrenciye metninin iyi olduğunu düşündürür. Arayüz sınırı
  açıkça yazıyor ve karşılaştırmayı örnek cevapla kullanıcıya bırakıyor.
  `MISTAKES` listesine kalıp eklerken ölçü **yanlış alarm üretmemek**:
  doğru yazılmış bir cümleye "yanlış" demek, öğrencinin doğruyu
  bozmasına yol açar. `test/writing.test.js` her kalıp için hem
  yakalaması hem yakalamaması gereken bir örnek tutuyor.
- **XP öğrenmeyi ölçmüyor.** `src/core/xp.js` yalnızca "bugün bir şey
  yaptım" duygusu için; öğrenmeyi SM-2 aralıkları ölçüyor. Bu yüzden
  yanlış cevap da XP veriyor (daha az): yalnızca doğruyu ödüllendirmek,
  kullanıcıyı bildiği kelimeleri tekrar etmeye ve bilmediklerinden
  kaçınmaya iter — aralıklı tekrarın tam tersi.
- **Rozetler saklanmıyor, her seferinde yeniden değerlendiriliyor**
  (`src/core/badges.js`). Saklanan liste gerçek durumla ayrışabiliyor
  ve "kazandım ama görünmüyor" en can sıkıcı hata. Bedeli kabul edildi:
  geriye dönük hesaplanamayan bir şey rozet olamaz, bu yüzden hepsi
  birikimli sayaçlara dayanıyor.
- **Haftalık hedef kullanıcının kendi geçmişinden türetiliyor**
  (`src/core/challenge.js`) ve hafta ortasında değişmiyor. Sabit hedef
  az çalışanı vazgeçiriyor, çok çalışan için salı biterek haftayı
  anlamsızlaştırıyor. Hedefin hafta içinde kayması ilerleme çubuğunu
  geri götürür.
- **XP grafiği SVG değil DOM.** İki SVG denemesi de bozuktu:
  `preserveAspectRatio` kapalıyken yazılar yatay geriliyor, açıkken
  grafik genişliğe ölçeklendiğinde yazı boyutu da büyüyor. Ayrıca
  `.chart` / `.chartBar` sınıf adları istatistik ekranının kendi
  grafiklerine ait; yeni grafikler `xp` önekli sınıflar kullanıyor.
- **Ses kaydı ile konuşma tanıma ayrı şeyler.** Tanıyıcı METİN
  üretiyor (`platform/speech-input.js`), kayıt SES üretiyor
  (`platform/recorder.js`). İkisi de aynı `RECORD_AUDIO` iznini
  kullanıyor ama işlevleri farklı: tanıyıcı "hangi kelimeyi
  tutturamadın", kayıt "nasıl duyuldun" sorusunu cevaplıyor. Kayıtta
  sabit `mimeType` verilmiyor — Safari'de sessizce boş kayıt üretiyordu.
  `URL.revokeObjectURL` çağrılmazsa her denemede bellekte bir kopya
  kalıyor.
- **Acil İngilizce hiçbir zaman kilitlenmiyor.** `entitlements.js` o
  modülde hiç çağrılmıyor. Abonelik duvarının arkasına konmuş bir acil
  durum özelliği, tam gerektiği anda işe yaramaz.
- **Türkçe arama harf duyarsız olmalı.** Telefonda kimse "çalındı"
  yazmıyor, "calindi" yazıyor (`core/emergency.js`, `fold`). Ayrıca
  Türkçe "İ" İngilizce kuralıyla küçültülürse birleşik noktalı bir
  karakter çıkıyor ve eşleşme kayboluyor.
- **Windows'ta `import.meta.url` yüzde-kodlu geliyor.** ASCII dışı
  kullanıcı adında `new URL(...).pathname` `ms%C4%B1` veriyor ve klasör
  bulunamıyor; `fileURLToPath` kullan. Aynı ailedeki TEMP tuzağı için
  "Komutlar" bölümüne bak.
- **Giriş ekranı `index.html` gövdesinin en başında, satır içi.** JS paketi
  yüklenmeden boyanabilsin ve yerel açılış ekranıyla arasında geçiş
  görünmesin diye. `main.js` veri hazır olunca kaldırır.

## Dürüstlük sözleşmesi

Uygulamanın **yapamadığı** şeyler var ve bunlar arayüzde açıkça
yazıyor. Bu bir üslup tercihi değil, ürün kararı: yapamadığı bir şeyi
yapıyormuş gibi gösteren bir öğrenme uygulaması, kullanıcının
hazırlanmadığı bir sınava girmesine ya da yanlış öğrendiğini fark
etmemesine yol açar.

| Nerede | Söylenmeyen şey | Neden yapılamıyor |
|---|---|---|
| Yazma kontrolü | Anlam ve üslup değerlendirmesi | Dil modeli + sunucu ister |
| Sınav modu | Bant / TOEFL puanı | Eğitimli değerlendiricinin ölçekli kararı |
| Konuşma tanıma | Telaffuz puanı | Fonem analizi ücretli servis ister |
| Ses kaydı | Telaffuz puanı | Aynı |
| XP | Öğrenme ölçüsü | Onu SM-2 aralıkları ölçüyor |
| Yerel profil | Yedek | Sunucuya gitmiyor |

Bir özellik eklerken soru şu: **bu ölçüm gerçek mi, yoksa gerçek gibi mi
duruyor?** Gerçek değilse ya yapma ya da ne olmadığını yaz.

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
- `DESIGN.md` — ekran haritası, bileşen envanteri, tasarım jetonları
  (arayüz yeniden tasarlanırken buradan başla)
- `README.md` — kullanıcıya dönük tanıtım (bazı bölümleri 1.0 dönemine ait
  ve güncel değil; mimari için bu dosyaya güven)
