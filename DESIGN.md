# DESIGN.md — arayüz şeması

Bu dosya **arayüzü yeniden tasarlamak** için yazıldı. Ekranların ne
olduğunu, hangi durumlara girdiğini, hangi bileşenlerden kurulduğunu ve
yeni tasarımın **kırmaması gereken** kısıtları anlatır.

Mimari ve kod kuralları için `CLAUDE.md`'ye bak; burada yalnızca görsel
katman var.

---

## 1. Kabuk

Her ekran aynı üç parçanın içinde yaşıyor:

```
┌─────────────────────────────────┐
│ header  (sabit, safe-area'lı)   │  ← logo + iki sayaç rozeti
├─────────────────────────────────┤
│                                 │
│ <main id="...View">             │  ← aynı anda YALNIZCA BİRİ görünür
│   (bölüm içeriği)               │     diğerlerinde .hidden
│                                 │
├─────────────────────────────────┤
│ nav.tabBar (sabit alt)          │  ← 5 sekme
└─────────────────────────────────┘
```

- `header` — uygulama adı, "Toplam: 5276", "Bugün tekrar: N"
- `main` — 16 ayrı `<main>` elemanı; `showSection()` birini gösterir
- `nav.tabBar` — Ana · Öğren · Diyalog · Havuz · Ayarlar

Bunların **üstüne** binen iki katman var:

| Katman | Sınıf | Ne zaman |
|---|---|---|
| Tekrar oturumu | `.reviewOverlay` | Kelime çalışırken — tam ekran, sekme çubuğunu kapatır |
| Diyalog | `.dialogOverlay` | Onay, form, seçim pencereleri |
| Acil gösterim | `.emOverlay` | Cümleyi karşıdakine göstermek için, `z-index: 9999` |
| Toast | `.toastHost` | Kısa bildirim, akışı kesmez |
| Açılış | `#launchScreen` | `index.html` gövdesinin **en başında, satır içi** |

---

## 2. Gezinme haritası

Beş sekme, on altı bölüm. **"Öğren" bir hub'dır** — altındaki her şey
`navLearn` sekmesini yanık bırakır.

```
Ana (navHome)
├── home ............... hedef halkası, günlük plan, seviye çubukları
└── stats .............. XP/rozet paneli + detaylı istatistik
                         (ana ekrandan "📊 Detaylı istatistik" ile)

Öğren (navLearn)
├── learn .............. 9 modül kartı — hub
├── topics ............. konu ızgarası
├── grammar ............ ders listesi → ders → quiz
├── reading ............ parça listesi → metin → anlama soruları
├── writing ............ görev listesi → görev → kontrol sonucu
├── email .............. aynı motor, farklı içerik
├── antonyms ........... seviyeli liste + 10 soruluk tur
├── lists .............. liste listesi → liste içi
├── exam ............... sınav seçimi → sınav → konuşma görevi / kelime seti
│   └── examWriting .... sınav yazma görevi (writing motoru)
└── emergency .......... arama + acil cümleler + 6 durum

Diyalog (navDialogues)
└── dialogues .......... diyalog listesi → diyalog → rol yapma

Havuz (navPool)
└── pool ............... arama, filtreler, seviye çubuğu, kelime kartları

Ayarlar (navSettings)
└── settings ........... profil, hedef, hatırlatma, ses, bulut, veri
```

### Geri dönüş kuralı

Alt sekmeler dışında **her iç ekranın başında bir `.dlgHead` var** ve
solunda `← <üst ekran adı>` düğmesi bulunuyor. Tarayıcı geri düğmesi
bölümler arasında çalışmıyor (tek sayfa, geçmiş yönetimi yok) — bu
yüzden görsel geri yolu kaybolmamalı.

---

## 3. Ekran ekran

### 3.1 Ana (`home`)

| Blok | Sınıf | İçerik |
|---|---|---|
| Hedef halkası | `.ringWrap` `.goalRing` | "0/10 bugün", yanında seri ve seviye rozeti |
| Karşılama / eylem | `.panel.hero` | Başlık, alt başlık, 2–3 düğme |
| Günlük plan | `.planPanel` | Hedefe göre üretilen görev listesi |
| Seviye çubukları | `.levelRows` | A1–C2, her biri ilerleme yüzdesiyle |
| İstatistik kartları | `.statCards` | 4 küçük kart |

### 3.2 Öğren hub (`learn`)

`.learnGrid` içinde 9 `.learnCard`: Konular · Dilbilgisi · Okuma ·
Yazma · E-posta · Zıt anlamlılar · Listelerim · Sınav modu · Acil
İngilizce. Her kart `.learnIcon` + `.learnTitle` + `.learnNote`
("12 ders", "68 çift").

**Bu ızgara büyümeye devam edecek.** Tasarım 9 kartla sınırlı
varsayılmamalı.

### 3.3 Liste → detay → alıştırma kalıbı

Dilbilgisi, okuma, yazma, e-posta, sınav ve diyalog **aynı üç adımı**
paylaşıyor ve aynı sınıfları kullanıyor:

```
LİSTE            .dlgGrid > .dlgCard
                   .dlgIcon .dlgTitle .dlgSummary
                   .dlgMeta > .cefr .dlgLines [.lockBadge]

DETAY            .dlgHead (geri + rozet)
                 .sectionIntro (h2 + p.small)
                 .panel / .writePanel (details+summary)

ALIŞTIRMA        .quizBox
                   .quizQuestion
                   .exerciseOptions > .exOption > .exKey + span
                   .quizFeedback (.ok / .bad) > .quizNext

SONUÇ            .dlgFinish
                   .dlgFinishIcon .dlgFinishTitle
                   .quizReview (yanlışlar)
                   .dlgFinishActions (2 düğme)
```

Bu kalıbı tek yerde yeniden tasarlamak **altı ekranı birden**
değiştirir. En yüksek getirili nokta burası.

### 3.4 Tekrar oturumu (`.reviewOverlay`)

Tam ekran katman. Altı alıştırma tipi aynı iskeleti kullanıyor:

| Tip | Ek bileşen |
|---|---|
| `choice-en-tr` | `.exerciseOptions` |
| `choice-tr-en` | `.exerciseOptions` |
| `listen` | `.speakBtn` (kelime yazılı değil) |
| `type-en` | `.typeRow` `.typeInput` |
| `cloze` | `.clozeSentence` `.clozeBlank` |
| `recall` | `.rateRow` `.rateBtn` (4 buton) |

`.reviewCard` → `.reviewEnRow` (kelime + 🔊) → `.reviewMeta` (CEFR,
seviye) → alıştırma → `.exerciseFeedback` → `.reviewActions`.

### 3.5 Havuz (`pool`)

Arama kutusu, filtre satırı (`.toolbar`), CEFR seviye çubuğu, sonra
kart listesi. **Sonsuz kaydırma:** `.listSentinel` ile 40'lık parçalar
hâlinde yükleniyor.

Kart (`.item`): üst satırda kelime + 🔊 + çeviri + CEFR + tür + seviye
+ durum rozeti; altında etiketler, örnek cümle kutusu ve 3–4 düğme
(`.actions`).

### 3.6 Diyalog rol yapma

`.dlgLineList` konuşma dökümü — A ve B replikleri farklı hizada
(`.dlgLine--a` / `.dlgLine--b`). Altında `.dlgExercise` içinde dört
moddan biri: seçme, sıralama, boşluk doldurma, konuşma
(`.speakUi` → `.speakTarget` `.speakActions` `.speakResult`
`.speakWords`).

### 3.7 İlerleme paneli (`stats` başı)

`.progressPanel` → iki halka (`.ringRow` `.ringBox`) → günlük XP
grafiği (`.xpChart` `.xpCol` `.xpBar`) → beceri çubukları
(`.skillBars` `.skillRow`) → rozet ızgarası (`.badgeGrid` `.badge2`).

### 3.8 Acil İngilizce

Arama kutusu → kritik cümleler paneli (`.emCritical`, sol kenarı
kırmızı) → 6 durum kartı. Her cümle satırı (`.emRow`): metin + 🔊 + 👁.
👁 tam ekran gösterim açıyor (`.emOverlay`, dev punto).

---

## 4. Tasarım jetonları (şu anki)

```css
:root {
	--bg:    #0f1320;   /* sayfa zemini */
	--panel: #171c2c;   /* kart zemini */
	--text:  #e6ecf2;
	--muted: #9aa4b2;
	--acc:   #5cc8ff;   /* birincil / vurgu */
	--good:  #3ddc97;
	--bad:   #ff6b6b;
	--warn:  #ffc857;
	--transition: 0.2s ease;
}
```

**Yalnızca koyu tema var.** `prefers-color-scheme` hiç kullanılmıyor
(0 eşleşme). Açık tema eklenecekse önce renkler jetona çevrilmeli:
CSS'te **118 ayrı sabit hex** var (`#22283a`, `#0e1424`, `#212a44`
gibi) ve bunların çoğu jeton değil, doğrudan kurala gömülü.

### CEFR renkleri

`.cefr--A1` … `.cefr--C2` altı ayrı üçlü taşıyor (`color`,
`background`, `border-color`) ve **anlam yüklü**: kullanıcı seviyeyi
renkten tanıyor.

```css
.cefr--A1 { color: #b8f5da; background: #10382b; border-color: #1f6b4f; }
.cefr--A2 { color: #cdf6c4; background: #1c3a1a; border-color: #3a6b2f; }
.cefr--B1 { color: #c4e4ff; background: #0f2c47; border-color: #1f5482; }
.cefr--B2 { color: #c9d6ff; background: #17224a; border-color: #2e3f80; }
/* C1, C2 aynı biçimde */
```

Rozetin **metni de seviyeyi yazıyor** ("A1"), yani tek başına renge
bağımlı değil. Ama A1/A2 (iki yeşil) ve B1/B2 (iki mavi) birbirine
yakın; renk körlüğünde ayrışmaları zayıf. Yeniden tasarımda altısının
ayırt edilebilirliği gözden geçirilmeli.

### Tipografi

`system-ui, -apple-system, Segoe UI, Roboto, Arial`, `line-height: 1.5`.
Özel yazı tipi yok — paket boyutu ve çevrimdışı çalışma için.

---

## 5. Yeni tasarımın kırmaması gereken kısıtlar

Bunların her biri **yaşanmış bir hatadan** geliyor.

### 5.1 `1fr` değil `minmax(0, 1fr)`

`1fr` aslında `minmax(auto, 1fr)` demek; sütun içeriğin min-content
genişliğinin altına inemiyor. Bu, havuz sayfasını 375 px ekranda
**1484 px**'e çıkarmıştı. Izgara kullanan her yerde `minmax(0, 1fr)`.

### 5.2 Sonraki kural öncekini eziyor

`.klist { repeat(3, 1fr) }` kuralı, mobil medya sorgusundaki kuralı
**kaynak sırası** yüzünden eziyordu (eşit özgüllük). Çözüm sabit sütun
sayısı yerine `repeat(auto-fill, minmax(min(260px, 100%), 1fr))`.

### 5.3 Sınıf adı çakışması sessiz

`.chart` ve `.chartBar` istatistik ekranının kendi grafiklerine ait.
Yeni grafikler aynı adı kullanınca `svg.chart` daha özgül olduğu için
yeni kuralları sessizce ezdi. **Yeni bileşene önek ver.**

### 5.4 Safe-area zorunlu

`header` ve `.tabBar`, `env(safe-area-inset-*)` kullanıyor. Çentikli
telefonlarda başlık kamera deliğinin altında kalıyordu. Fallback `0px`.

### 5.5 Beş sekme sınırı

Altıncı sekme 375 px'te alt çubuğu okunmaz yapıyor. Yeni bölümler
"Öğren" hub'ına eklenmeli, sekmeye değil.

### 5.6 Uzun içerik taşmamalı

Kelime, cümle ve liste adları uzun olabiliyor. `min-width: 0` ve
`overflow-wrap: anywhere` yaygın olarak kullanılıyor; kaldırılırsa
yatay kaydırma geri geliyor.

### 5.7 Metin `textContent` ile yazılıyor

`ui/dom.js`'teki `el()` yardımcısı **daima** `textContent` kullanıyor,
`innerHTML` değil. İçerik dosyaları kullanıcıya gösterilen metin
üretiyor; HTML enjeksiyonuna kapalı kalmalı.

### 5.8 `el()` yalnızca dört seçenek biliyor

`class`, `text`, `title`, `attrs`. Başka bir anahtar (`id`, `rows`,
`placeholder`, `open`) **sessizce yok sayılıyor** — `attrs` içine
konmalı.

---

## 6. Bileşen envanteri

363 CSS sınıfı var. Yeniden tasarımda gruplandırılabilecek başlıca
aileler:

| Aile | Önek | Nerede |
|---|---|---|
| Kart listesi | `.dlgCard` `.dlgGrid` `.dlgMeta` | 6 bölüm |
| Alıştırma | `.exOption` `.exKey` `.quizBox` `.quizFeedback` | Tekrar, quiz, tur |
| Bitiş ekranı | `.dlgFinish*` `.quizReview` | 5 bölüm |
| Havuz kartı | `.item` `.actions` `.tags` `.exampleBox` | Havuz |
| Yazma | `.write*` (18 sınıf) | Yazma, e-posta, sınav |
| Zıt anlamlı | `.ant*` (10 sınıf) | Zıt anlamlılar |
| Acil | `.em*` (12 sınıf) | Acil İngilizce |
| Sınav | `.exam*` (8 sınıf) | Sınav modu |
| Grafik | `.xp*` `.ring*` `.skill*` `.stage*` | İlerleme, istatistik |
| Rozet | `.badge2*` | İlerleme |
| Diyalog penceresi | `.dialog*` `.choice*` | Her yer |
| Bildirim | `.toast*` | Her yer |

### Tekrarlanan atomlar

Bunlar her yerde kullanılıyor ve tek bir yerde tanımlanmalı:

- `.panel` — kart zemini
- `.small` — ikincil metin
- `.kpill` — küçük etiket
- `.cefr` + `.cefr--XX` — seviye rozeti
- `.primary` / `.ghost` / `.good` / `.bad` — düğme türleri
- `.speakBtn` — 🔊 düğmesi
- `.dlgHead` — geri satırı
- `.sectionIntro` — h2 + açıklama
- `.lockBadge` — 🔒

---

## 7. Yeniden tasarım için öncelik sırası

Etkiye göre:

1. **Liste → detay → alıştırma kalıbı** (§3.3) — altı bölüm birden
2. **`.panel` / düğme / rozet atomları** — her ekran
3. **Ana ekran** — ilk izlenim
4. **Tekrar oturumu** — en çok zaman geçirilen ekran
5. **Havuz kartı** — en yoğun bilgi taşıyan bileşen
6. Grafikler ve rozetler
7. Bölüme özel aileler (yazma, acil, sınav)

---

## 8. Değişiklikten sonra

```bash
npm run check:ids   # $('id') <-> index.html
npm test            # 639 test
npm run build
```

Tarayıcıda **375 px genişlikte** her bölümü gez ve şunu doğrula:

```js
document.documentElement.scrollWidth <= window.innerWidth
```

Yatay taşma bu projede en sık tekrarlayan görsel hata.
