# Changelog

All notable changes to this project will be documented in this file.

## [2.0.0] - 2026-09-01

Oxford CEFR listeleri işlendi. İçerik iki katına çıktı ve seviyeler
artık yayımlanmış bir derecelendirmeye dayanıyor.

### Eklendi
- **2819 yeni kelime.** Paket 2493 → **5310**.
  A1:856 A2:859 B1:864 B2:1362 C1:1350 C2:19
- Yeni kelimelerin tamamında CEFR seviyesi, Türkçe karşılık ve
  sözcük türü; %97'sinde örnek cümle (Tatoeba'dan yeniden üretildi).
- `scripts/extract-oxford.py` — PDF listelerini ayrıştırır.

### Değişti
- **Seviyeler artık Oxford'un derecelendirmesine dayanıyor.**
  Örtüşen 2102 kelimenin %62'sinde kendi atamamla aynıydı; farklı
  olanlarda Oxford esas alındı. En büyük düzeltmeler: `career` B1→A1,
  `compare` B1→A1, `culture` B1→A1, `colleague` B2→A2, `appetite` B1→C1.
- **Sözcük türü 1581 → 5159** (%97). Artık neredeyse tüm kelimelerde var.
- Zayıf Türkçe karşılıklar zenginleştirildi (1327 kayıt). Zaten iki-üç
  anlamı olanlara dokunulmadı — Oxford'un nadir anlamlarını eklemek
  kartı gürültülendiriyordu (`career` = "kariyer" + "hız yapmak").

### Düzeltildi
- **Türkçe/İngilizce eşsesli tuzağı:** `ten on [i.] onluk [i.]` satırında
  "on" hem İngilizce edat hem Türkçe "10". Baş sözcük "ten on" çıkıyordu.
  8 çok sözcüklü adaydan 4'ü sahteymiş.
- **Kaynak PDF'teki ~142 sözcük türü hatası** çoğunluk oyuyla düzeltildi
  (`regain` isim işaretliydi, fiil).
- **Sözcük türü artık gösterilen Türkçe karşılıkla tutarlı.** `stay`
  "isim" yazıp "kalmak" göstermek çelişkiliydi.
- 1.0 verisinden iki bozuk çeviri: `package` = "paket lemek" (fiil ikiye
  bölünmüş), `in order to` = "mek mak bir sonraki cümle için" (çeviri
  değil, kullanıcının notu).

### Doğrulandı
Paket v1'den v6'ya yeniden kuruldu; ilerlemesi olan 40 kelimenin
geçmişi ve tekrar aralıkları eksiksiz korundu.

### Lisans notu
Oxford 3000/5000 listeleri Oxford University Press derlemesidir.
Tek tek kelimeler ve seviyeleri olgudur; derlemenin kendisi bazı
ülkelerde veritabanı hakkı doğurabilir. Ticari yayından önce
değerlendirilmeli — ayrıntı `data/sources/README.md`.

---

## [1.11.0] - 2026-09-01

### Eklendi
- **Sözcük türü** 841 → **1581** kayıtta dolu (%63).
  En güçlü ipucu Türkçe karşılık: Türkçede mastar "-mek/-mak" ile biter,
  yani "terk etmek" karşılığı olan İngilizce kelime fiildir. Bu tek kural
  416 fiili yakaladı. İngilizce son ekleri (-ly, -tion, -ous…) ikinci sırada.
  Emin olunamayan kayıtlar **boş bırakıldı** — yanlış etiket etiketsizden
  daha zararlı.
- **Konu** 841 → **1258** kayıtta dolu (%50). 20 anlamsal grup.
  Genel/soyut kelimeler konusuz kalıyor; her kelimenin konusu olmak
  zorunda değil.
- Kart listesinde sözcük türü rozeti (isim, fiil, sıfat…).

### Değişti
- **Yanıltıcı şıklar artık aynı sözcük türünden seçiliyor.** "run"
  sorusuna "table" şıkkını elemek kolay; "walk" gerçek bir ayırt etme
  gerektirir.

### Düzeltildi
- **Geri besleme döngüsü:** `infer-pos.mjs` üretilmiş paketi okuyup
  kendi eski çıktısını "elle yazılmış" sanıyordu. Hatalı bir çıkarım
  sonsuza kadar korunuyor, düzeltme hiç uygulanamıyordu. Artık elle
  yazılan değerler yalnızca kaynak dosyalardan okunuyor.
- `bread` (ekmek) fiil işaretlenmişti: "parmak", "ekmek", "çocuk" gibi
  Türkçe **isimler** de mastar gibi bitiyor. İstisna listesi eklendi.
- **`be` = "almak"** — 1.0 verisinde anlamı tamamen değiştiren bir yazım
  hatası, doğrusu "olmak". Düz metin eşlemesi yetmedi çünkü `take` için
  "almak" doğru; kelimeye özel düzeltme mekanizması eklendi.
- Eklenen kelime zaten varsa artık anlamlar birleştiriliyor:
  `report` = "bildirmek" + "rapor" → "bildirmek, rapor".

---

## [1.10.0] - 2026-09-01

### Eklendi
- **Günlük hatırlatma bildirimleri.** Android'de uygulama kapalıyken de
  çalışır, tarayıcıda sekme açıkken. İzin zorunlu olarak isteniyor,
  reddedilirse sessizce devre dışı kalıyor. Varsayılan kapalı.
  Mesaj dili kasıtlı olarak baskısız: *"serini kaybettin"* değil
  *"seni bekliyor"*. Bir test suçlayıcı kelimelerin girmesini engelliyor.
- **İstatistik ekranı** (yeni üçüncü bölüm):
  - Hatırlama oranı — genel ve son 30 gün
  - Son 30 günün günlük cevap grafiği (saf SVG, kütüphane yok)
  - Öğrenme aşamaları — başlanmamış / öğreniliyor / genç / pekişiyor / öğrenilmiş
  - Önündeki 14 günün tekrar yükü, gecikmişler ayrı
  - En çok zorlanılan kelimeler (unutma sayısı + kolaylık katsayısına göre)
  - Tahmini kelime hazinesi — kaba tahmin olduğu belirtilerek

### Düzeltildi
- Geçmişteki bozuk kayıt (elle düzenlenmiş yedek, eski sürüm)
  istatistik hesabını çökertiyordu. Üç fonksiyonda koruma eklendi.
- Android geri tuşu artık istatistik ekranından da ana ekrana dönüyor.

---

## [1.9.0] - 2026-09-01

Öz-değerlendirme yerine gerçek test; tanıma yanına üretim eklendi.

### Değişti
- **Cevaplar artık denetleniyor.** Önceki akışta kelimeyi görüp "İyi"ye
  basıyordun — cevap hiç kontrol edilmiyordu. İnsan "biliyordum" demeye
  yatkındır (hatırlama yanılsaması), bu yüzden öz-değerlendirme
  öğrenmeyi olduğundan iyi gösteriyordu.
- **Üretim yönü eklendi.** Önceden yalnızca EN→TR tanıma ölçülüyordu.
  Artık TR→EN de var; konuşabilmek için gereken yön bu.

### Eklendi — dört alıştırma tipi
Kelimenin olgunluğuna göre otomatik seçiliyor:

| Aşama | Alıştırma |
|---|---|
| İlk görüş | Çoktan seçmeli **EN→TR** (tanıştırma) |
| 1-2 tekrar | Çoktan seçmeli **TR→EN** (üretim yönü, kolay) |
| 3+ tekrar | **Yazarak** ya da **boşluk doldurma** (gerçek üretim) |
| Olgun (21 gün+) | Klasik kart (bakım) |

- **Boşluk doldurma** örnek cümleyi kullanıyor:
  *"karar vermek"* → `Do I have to _____ right now?`
  Türkçe çeviri ipucu olarak altında.
- Yanıltıcı şıklar aynı CEFR seviyesinden seçiliyor — şıklar benzer
  zorlukta olsun.
- Yazılan cevapta büyük/küçük harf ve noktalama yok sayılıyor, **harf
  hatası kabul edilmiyor** (yazımı da öğrenmek gerekiyor).
  Tek harf hatası "az kaldı" geri bildirimi alıyor.
- Eş anlamlılar kabul ediliyor (`accuse` için `blame` de doğru).
- Klavye: 1-4 şık seçimi, Enter ile devam.

### Düzeltildi
- `.hidden` yardımcı sınıfı, dosyanın ilerisinde tanımlı `display: flex`
  kurallarınca eziliyordu — gizlenmesi gereken alıştırma alanları
  görünür kalıyordu. Artık `!important`.
- Çekim tanıma ünsüz ikizleşmesini kaçırıyordu (`run` → `running`).
- Uzun kart ekrana sığmazsa artık kaydırılabiliyor.

---

## [1.8.0] - 2026-09-01

En büyük içerik açığı kapandı: kelimeler artık bağlamıyla geliyor.

### Eklendi
- **2441 örnek cümle, Türkçe çevirileriyle** (önceki: 4).
  Kapsama: 2493 kelimenin %97,9'u.
  Kaynak: [Tatoeba](https://tatoeba.org), CC BY 2.0 FR — ticari kullanıma
  açık, atıf zorunlu.
- Örnek cümle kartta ve tekrar ekranında, İngilizcesi öne çıkan
  Türkçesi altında soluk duran bir blokta gösteriliyor.
- **Kaynak atfı** üç yerde: uygulama içinde Ayarlar → Kaynaklar,
  gizlilik politikası ve içerik paketinin üst verisinde. Bir test bu
  atfın pakette kalmasını kilitliyor — kaldırılması lisans ihlali olur.

### Seçim yöntemi
675.000 Türkçe çevirisi olan İngilizce cümle tarandı. Her kelime için:

- 4-12 sözcük (bağlam yeterli, okuması kolay)
- Büyük harfle başlayıp noktalama ile bitmeli
- **Cümledeki diğer kelimeler hedef kelimenin seviyesinde ya da altında** —
  A1 kelimesi C1 cümlesiyle öğretilmez
- Tatoeba'nın yer tutucu adları (Tom, Mary…) hafif cezalı

### Düzeltildi
- Kullanıcının kendi örneği artık bir kalite kapısından geçiyor.
  1.0 verisindeki 4 örnekten 2'si cümle değildi — biri çok satırlı bir
  kullanım notu, biri dilbilgisi hatalı. Bunlar Tatoeba örneğine
  düşüyor; kullanıcının metni `data/` altındaki orijinal yedekte duruyor.

---

## [1.7.0] - 2026-09-01

Öğrenme motoru ve telaffuz.

### Değişti
- **SM-2 tabanlı zamanlayıcı.** 1.0'daki sistem sabit bir merdivendi:
  her doğru bir basamak yukarı, her yanlış en başa. İki sorunu vardı —
  zor kelime ile kolay kelime aynı hızda ilerliyordu ve tek bir yanlış,
  aylarca süren ilerlemeyi siliyordu.

  Yeni sistem her kelimeye bir **kolaylık katsayısı** tutar: kolay
  bulduğun kelimenin aralığı hızla açılır, zorlandığınınki dar kalır.
  "Hiç hatırlamadım" aralığı kısaltır ama katsayıyı ve geçmişi silmez.

- **Dört seçenekli değerlendirme:** Hiç / Zor / İyi / Kolay.
  Her düğme bir sonraki tekrarın ne zaman olacağını gösterir
  ("İyi — 12 gün"), böylece karar somutlaşır. Klavye: 1-4.

- Eski `level` alanı gösterim ve süzgeçler için korunuyor, aralıktan
  türetiliyor. **1.0/1.2 verisi kayıpsız geçiyor**: `ease`/`interval`
  yoksa eski basamaktan hesaplanıyor (level 5 → 30 gün).

### Eklendi
- **Telaffuz.** Her kelimenin yanında 🔊 düğmesi; tekrar ekranında,
  kelime kartlarında ve seviye testinde. Tarayıcının konuşma sentezini
  kullanıyor: ücretsiz, çevrimdışı ve Android WebView'de çalışıyor.
  Klavye kısayolu: S. İngilizce ses yoksa düğme hiç görünmez.

### Not
- 2500 kelime için ses dosyası paketlemek yüzlerce MB olurdu; Web Speech
  API cihazdaki sesleri kullandığı için paket boyutunu hiç artırmıyor.
  Bedeli: ses kalitesi cihaza göre değişiyor.

---

## [1.6.0] - 2026-09-01

Uygulama artık kurulabilir (PWA) ve Android'e taşınmaya hazır.

### Eklendi
- **PWA desteği.** Servis çalışanı, manifest ve ikonlar. Uygulama telefona
  kurulabiliyor ve tamamen çevrimdışı çalışıyor (23 dosya, 672 KB önbellek).
- **Uygulama ikonu.** `assets/icon.svg` kaynağından PWA, iOS ve Android
  (adaptif + açılış ekranı) varyantları üretiliyor: `npm run build:icons`.
- **Capacitor yapılandırması.** Paket adı, açılış ekranı ve durum çubuğu
  ayarları hazır. Yerel entegrasyon (`src/platform/native.js`):
  durum çubuğu teması, açılış ekranının kapatılması ve **Android geri
  tuşu** — açık diyalog/test/tekrar katmanını kapatır, havuzdayken ana
  ekrana döner, ancak en üstteyken uygulamadan çıkar.
- **ANDROID.md** — Node yükseltmesinden imzalı AAB'ye kadar tüm adımlar,
  keystore uyarıları ve sık karşılaşılan sorunlar.
- **privacy-policy.md** — Play Store'un zorunlu tuttuğu gizlilik metni.
- **store-listing.md** — mağaza kaydı için hazır Türkçe metinler,
  içerik derecelendirmesi ve veri güvenliği formu cevapları.

### Notlar
- Capacitor 8 CLI **Node 22 LTS** gerektiriyor (kurulu sürüm 20.13).
  `npx cap add android` çalıştırmadan önce Node yükseltilmeli.
  Ayrıntı: ANDROID.md bölüm 0.
- Capacitor build'i servis çalışanı üretmez (`npm run build:capacitor`):
  yerel WebView'de gereksiz ve eski önbellek güncellemeleri gizleyebiliyor.

## [1.5.0] - 2026-09-01

### Eklendi
- **Ana ekran.** Uygulamanın yeni açılış ekranı: seviye, günlük durum,
  seri, seviye seviye ilerleme ve tek tuşla çalışmaya başlama.
  Üst navigasyon: Ana Sayfa / Havuz.
- **Seviye belirleme testi.** Basamaklı uyarlanabilir test: A2'den başlar,
  her seviyede 4 soru sorar, %75+ doğruda yükselir, %50 altında iner.
  En fazla 24 soru. Sonuç profile yazılır ve ana ekran o seviyeye
  odaklanır. Cevaplar ilerlemeye yazılmaz — sadece seviye ölçülür.
- **Kullanıcı profili ve seri takibi.** Günde en az bir cevapla seri
  ilerler; bir günden fazla ara verilince sıfırlanır.

### Değişti
- İçerik paketi v3: 639 orta seviye kelime eklendi (sıklık listesinin
  ilk 4000 sırasından seçilen, havuzda olmayan gerçek sözcükler).
  Toplam **2493 kelime** — A1:599 A2:679 B1:639 B2:383 C1:174 C2:19.

---

## [1.4.0] - 2026-08-31

İçerik paketi v2. Seviye atamaları dış veriyle doğrulandı, A1 temel
kelime dağarcığı eklendi.

### Eklendi
- **202 A1 temel kelimesi.** Mevcut havuzda `abandon` ve `prosperity` vardı
  ama sayıların, günlerin, ayların, soru kelimelerinin ve zamirlerin
  neredeyse tamamı yoktu — liste bir müfredat değil, karşılaşılan
  kelimelerin birikimiydi. Eklenenler: sayılar (1-100, yüz, bin),
  günler ve aylar, soru kelimeleri, zamirler, bağlaçlar, yer/zaman
  edatları ve temel isim/sıfat/fiiller. Çeviriler elle yazıldı —
  üçüncü taraf sözlük verisi kullanılmadı.
- **Sıklık sırası (`freqRank`)** 1725 kelimede dolu. Kaynak:
  hermitdave/FrequencyWords (MIT, OpenSubtitles 2018).
- **Konu (`topic`) ve sözcük türü (`pos`)** alanları yeni kelimelerde dolu;
  20 konu kategorisi (sayılar, zaman, dilbilgisi, aile, vücut, yiyecek…).
- İçerik paketi bütünlük testleri (22 test): mükerrer kimlik, boş alan,
  geçersiz seviye, baş sözcükte virgül, Türkçe harf kalıntısı gibi
  kusurları yakalar.

### Değişti
- **CEFR atamaları sıklık verisiyle doğrulandı.** 1652 kelimenin %83'ünde
  iki kaynak 1 seviye içinde uyuştu. 2+ seviye ayrışan 255 kayıt tek tek
  incelendi ve **94 düzeltme** uygulandı:
  - 20 kelime indirildi (`certainly`, `completely`, `trouble`, `debt`…) —
    gerçekte sanılandan çok daha yaygın.
  - 74 kelime yükseltildi (`implementation`, `classification`,
    `corresponding`, `sustainable`…) — konuşma dilinde seyrek, soyut.
  - ~160 kayıtta sıklık verisi **kasıtlı olarak yok sayıldı**: korpus film
    altyazısından geldiği için `carrot` (#8557), `giraffe` (#13464) gibi
    somut sınıf kelimelerini hak ettiğinden zor gösteriyor.
- İçerik paketi sürümü 2'ye yükseltildi; mevcut kurulumlar güncellemeyi
  otomatik alır ve **ilerleme yerinde kalır** (kararlı kimlikler sayesinde).
  Gerçek veriyle doğrulandı: paket güncellendi, 1094 kelimenin geçmişi
  eksiksiz korundu.
- Toplam paket: 1652 → **1854 kelime**.
  A1:551 A2:529 B1:374 B2:223 C1:158 C2:19

### Notlar
- Tureng gibi tescilli sözlüklerden veri alınmadı; ticari bir üründe
  telif riski taşır ve zaten CEFR bilgisi içermezler.
- Kullanılan tek dış veri kaynağı MIT lisanslı sıklık listesi.
  Ayrıntılar ve bilinen yanlılığı: `data/sources/README.md`.

---

## [1.3.0] - 2026-08-31

CEFR seviye sistemi ve içerik kalitesi sürümü.

### Eklendi
- **A1-C2 seviye sistemi.** Paketteki 1652 kelimenin tamamı CEFR seviyesiyle
  etiketlendi (A1:396, A2:483, B1:404, B2:213, C1:137, C2:19). Eşleme
  `data/cefr-levels.json` dosyasında; elle düzenlenebilir, kod değişikliği
  gerektirmez.
- **Seviye seçici.** Havuzu A1-C2 arasında süzer. Seçim yalnızca listeyi
  değil **tekrar kuyruğunu da** kapsar: "Tekrar Et" seçili seviyeyi çalıştırır.
- Kartlarda, kutularda ve tekrar ekranında renk kodlu CEFR rozeti
  (A1 yeşilden C2 mora giden skala).
- Seviye başına öğrenilme oranı özeti.
- **Türkçe aksana duyarsız arama.** "yag" yazınca "don yağı" bulunuyor;
  Türkçe klavyeye geçmeden arama yapılabiliyor. Eş anlamlılarda da arıyor.

### Değişti
- **1.0'dan gelen hatalı "öğrenilmiş" işaretleri bir kez otomatik onarılıyor**
  (doğrulama turu). Cevap geçmişi aynen korunur; kelime yalnızca bir kez daha
  sorulacak seviyeye alınır, doğru bilinirse etiket geri kazanılır.
  Kullanıcı Ayarlar > İlerleme denetimi'nden diğer kipleri seçebilir.

### Düzeltildi (içerik)
- **53 İngilizce yazım hatası.** Bir kısmı basit harf hatasıydı
  (`coffe`, `philosphy`, `succes`, `howewer`, `sitaction`), bir kısmı
  ise bambaşka kelimeydi ve Türkçe karşılığına bakılarak tespit edildi:
  `breake` → **brake** ("fren"), `stich` → **stick** ("çubuk"),
  `dept` → **debt** ("borç"), `plub` → **plug** ("priz"),
  `resistons` → **resistor** ("direnç"), `bidata` → **big data**.
- Virgüllü kayıtların baş sözcüğündeki hatalar da yakalanıyor
  (`iterna, inner, interior` → `interior`). Önce yalnızca tüm metin
  karşılaştırılıyordu, bu kayıtlar gözden kaçıyordu.
- Türkçe tarafta: `erişm` → `erişim`, `terketmek` → `terk etmek`,
  `yoğum bakım` → `yoğun bakım`, `çevre bilimi` → `çevre birimleri`.
- Sondaki yer tutucu `x` temizlendi (`around x` → `around`).
- Toplam: 1682 ham kayıt → **1652 temiz kelime** (30 mükerrer birleştirildi).

---

## [1.2.0] - 2026-08-31

Veri mimarisi sürümü. A1-C2 müfredatının üzerine kurulacağı temel.

### Değişti
- **İçerik ile ilerleme ayrıldı.** 1.0'da bir kelimenin sözlük tanımı ile
  kullanıcının o kelimedeki ilerlemesi tek nesnedeydi; bu yüzden yeni bir
  kelime paketi göndermek ilerlemeyi ezmeden mümkün değildi. Artık `words`
  (tanım, sürümlenen içerik) ve `progress` (kullanıcıya özel) ayrı depolarda.
  Arayüz bu ayrımı görmez.
- **localStorage yerine IndexedDB.** localStorage'ın ~5MB sınırı A1-C2
  müfredatını kaldırmaz; ayrıca her yazmada tüm veri JSON'a çevriliyordu
  (1682 kelimede her cevapta ~600KB). Bağımlılık eklenmedi, ~200 satırlık
  ince bir sarmalayıcı yazıldı.
- Kelime kimlikleri kararlı hâle geldi (`core:abandon`). Paket güncellendiğinde
  ilerleme doğru kelimeye bağlı kalır.
- Kelime şeması genişletildi: `cefr`, `pos`, `ipa`, `topic`, `freqRank`,
  `audio`, `synonyms`, `exampleTr`, `aliases`. (Faz 2'de doldurulacak.)

### Eklendi
- **Göç (migration).** 1.0 verisi otomatik taşınır. İki güvence: eski veri
  localStorage'da SİLİNMEZ (tek geri dönüş noktası), ve göç hiçbir seviyeyi
  "düzeltmez" — yanlış hesaplanmış olanlar bile olduğu gibi taşınır.
- **İlerleme denetimi** (Ayarlar > 🩺). "Öğrenilmiş" işaretinin hak edilip
  edilmediğini inceler ve üç seçenek sunar: doğrulama turu (kayıpsız),
  geçmişi baştan hesapla, sıfırla. Kullanıcı seçmeden hiçbir onarım uygulanmaz.
- **İçerik paketi üreticisi** (`scripts/build-content-pack.mjs`). Kullanıcı
  yedeğinden temiz, sürümlenmiş paket üretir.
- Çok seçenekli diyalog bileşeni.

### Düzeltildi (içerik)
- İngilizce alanda Türkçe noktasız `ı` kullanılan **16 kayıt** (`ımprove`,
  `ımportant`, `ıllness`...). Bu harf sözlük eşleşmesini, aramayı ve ileride
  sesli okumayı bozuyordu.
- 6 yazım hatası: `T-shitt`→`T-shirt`, `enfırcement`→`enforcement`,
  `anınymous`→`anonymous`, `icrease`→`increase`, `hurry hurries`→`hurry`,
  `Intelligent`→`intelligent`. TR tarafında `teleaş`→`telaş`.
- Tek alanda birden fazla baş sözcük taşıyan **89 kayıt** ayrıştırıldı
  (`prosperity, welfare, wealth` → baş sözcük + eş anlamlılar).
- **24 mükerrer kayıt** birleştirildi; anlamları korunarak tek kelimede toplandı.
- İçe aktarmada aynı kelimenin daha ileri ilerlemesi varsa artık alınıyor
  (önce sessizce atlanıyordu).

---

## [1.1.0] - 2026-08-31

Bu sürüm görünür yeni özellik getirmez; A1-C2 müfredatının üzerine kurulacağı
temeli atar ve uygulamanın ana özelliği olan aralıklı tekrarı gerçekten
çalışır hâle getirir.

### Düzeltildi
- **Aralıklı tekrar fiilen çalışmıyordu.** `startReview()` tekrar takvimini
  (`isDue`) hiç kullanmıyordu; "Normal" ve "Serbest" tekrar aynı kelime
  havuzunu veriyordu. Normal tekrar artık sadece zamanı gelmiş kelimeleri,
  en çok gecikmiş olan başta olacak şekilde sıraya alıyor.
- "Bugün tekrar" filtresi tarihe değil öğrenilmişlik durumuna bakıyordu.
- Havuzdaki "Tekrar" sayacı üstteki rozetten farklı bir sayı gösteriyordu.
- Otomatik "öğrenilmiş" işaretlemesi geçmişteki **toplam** doğruyu sayıyor,
  aradaki yanlışları yok sayıyordu. Artık üst üste 5 doğru cevap aranıyor.
- Başlangıç kelime setini yükleyen kod var olmayan bir dosya adını arıyordu;
  özellik hiç çalışmamıştı.
- "Kutular" görünümü arama/filtreyi yok sayıp her zaman tüm kelimeleri
  basıyordu.
- Eksik `tags`/`history` alanı olan bir kayıt içe aktarıldığında arayüz
  TypeError ile çöküyordu. Artık tüm veri `normalizeWord()` sınırından geçiyor.
- Yeni eklenen kelime yarına planlanıyordu; bugün eklenen kelime "Tekrar Et"
  kuyruğuna girmiyordu. Artık hemen çalışılabilir.

### Değişti
- Tek dosyalık `index.html` (1238 satır) ES modüllerine ayrıldı; Vite build
  sistemi eklendi. `src/core` katmanı DOM'dan bağımsız ve test edilebilir.
- `alert()` / `confirm()` yerine uygulama içi diyaloglar ve toast bildirimleri.
  (Tarayıcı diyalogları Capacitor WebView'ünde uygulamayı web sitesi gibi
  gösteriyordu.)
- Tekrar ekranı yeniden tasarlandı: opak arka plan, büyük tipografi,
  klavye kısayolları (Boşluk = göster, 1/← = unuttum, 2/→ = biliyordum,
  Esc = kapat) ve oturum sonu özeti.
- Kelime havuzu `public/content/seed-vocabulary.json` altına taşındı;
  içerik ile kodun ayrılmasının ilk adımı.
- Form alanlarına etiketler, sekmelere `role`/`aria` nitelikleri eklendi.

### Eklendi
- Vitest ile 35 birim testi. Yukarıdaki hataların çoğu regresyon testiyle
  kilitlendi.
- `ENG-TRapplication.html` silindi (index.html'in eski kopyasıydı).

---

## [1.0.0] - 2026-01-12

### Added
- Initial release of Kelime Havuzum
- Spaced Repetition System (SRS) with 7-level progression
- Add, search, and manage English-Turkish vocabulary pairs
- Two view modes: Cards and Tiles
- Multiple review modes: Normal and Free Review
- Daily statistics tracking
- JSON export/import for backup and restore
- Responsive design for all devices
- Dark theme UI
- Auto-import feature for JSON files
- Tag system for word categorization
- Example sentence support
- Daily goal setting
- Automatic "learned" status after 5 correct answers

### Features
- 📝 Add words with meanings, examples, and tags
- 🔄 Smart spaced repetition scheduling
- 📊 Track progress with statistics
- 🎯 Set and track daily goals
- 💾 Export/import vocabulary as JSON
- 🌙 Professional dark theme
- 📱 Fully responsive mobile design
- 🚀 No dependencies, pure vanilla JavaScript
- 🔒 All data stored locally (no server required)

### Technical
- Vanilla JavaScript (ES6+)
- HTML5 markup
- CSS3 with CSS Grid and Flexbox
- LocalStorage for persistence
- No external dependencies

---

## Future Roadmap

### Planned Features
- [ ] PWA (Progressive Web Application) support for offline use
- [ ] Dark/Light theme switching
- [ ] Export to Anki format
- [ ] Graphical statistics panel
- [ ] Keyboard shortcuts
- [ ] Multi-language support (Spanish, French, etc.)
- [ ] Cloud synchronization (optional)
- [ ] Word pronunciation (TTS)
- [ ] Image associations
- [ ] Community vocabulary packs
- [ ] AI-powered training
- [ ] AI-powered speech practice
- [ ] Mini quizzes

### Improvements
- [ ] Better mobile keyboard usage
- [ ] Accessibility improvements (ARIA tags)
- [ ] Performance optimizations for large dictionaries
- [ ] Advanced filtering options
- [ ] Custom sorting options
- [ ] Batch operations
---

## Version History Format

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
