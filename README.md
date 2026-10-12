# Kelimece

**Türkçe konuşanlar için A1–C2 İngilizce öğrenme uygulaması.**
Çekirdeği aralıklı tekrar (SRS) ile kelime; üstüne dilbilgisi, okuma,
yazma, rol yapmalı diyalog, konuşma pratiği, IELTS/TOEFL modu ve acil
İngilizce.

Çerçeve yok — vanilla JS (ES modülleri), Vite ile paketleniyor. PWA
olarak çalışıyor, Capacitor ile Android'e sarmalanıyor. Veri cihazda
kalıyor, uygulama çevrimdışı çalışıyor.

[🇹🇷 Türkçe](#türkçe) · [🇬🇧 English](#english)

---

## Türkçe

### Ne var

| | |
|---|---|
| **Kelime** | 5276 kelime, sıklık sırasına göre tanıtılır. SM-2 aralıklı tekrar: 1, 2, 4, 7, 15, 30, 60 gün. Altı alıştırma tipi (çoktan seçmeli iki yön, dinleme, yazma, boşluk doldurma, klasik kart). |
| **Dilbilgisi** | 12 ders, 36 quiz sorusu. Her sorunun *neden* açıklaması var; konular Türkçe konuşanların zorlandığı yerlerden seçildi (am/is/are, üçüncü tekil -s, a/an/the, in/on/at). |
| **Okuma** | 10 parça, A1–C1. Düşük seviyelerde hikâye, yüksek seviyelerde makale. Sorular metin **görünmeden** sorulur. |
| **Yazma** | 8 yazma + 6 e-posta görevi. Yerel kontrol: uzunluk, istenen ögeler, Türkçe konuşanların kalıp hataları. Örnek cevapla karşılaştırmalı. |
| **Diyalog** | A1–C2 × 10 rol yapmalı diyalog. Sen B kişisisin; cevabı seçerek, kelimeleri sıralayarak, boşluk doldurarak ya da **söyleyerek** verirsin. |
| **Konuşma** | Konuşma tanıma ile kelime kelime geri bildirim. Ayrıca ses kaydı — kendini dinlersin. |
| **Zıt anlamlılar** | 68 çift, çift yönlü sorulur. Çeldiriciler aynı sözcük türünden. |
| **Sınav modu** | IELTS ve TOEFL: biçim, gerçek görev formatları, süreli konuşma görevleri, sınav kelimeleri. |
| **Acil İngilizce** | Hastane, polis, eczane, havaalanı, kayboldum, para. Söyleyeceklerin **ve duyacakların**. Her zaman ücretsiz, internet gerekmez. |
| **İlerleme** | Günlük hedef, seri, XP, 12 rozet, haftalık hedef (kendi geçmişinden hesaplanır), beceri bazlı başarı grafikleri. |
| **Tema** | Açık ve koyu. Sistem / Açık / Koyu seçimi. |

### Ne vaat etmiyor

Uygulamanın **yapamadığı** şeyler arayüzde açıkça yazıyor. Bu bir üslup
tercihi değil: yapamadığı bir şeyi yapıyormuş gibi gösteren bir öğrenme
uygulaması, kullanıcının hazırlanmadığı bir sınava girmesine yol açar.

- **Yazma kontrolü** anlamı ve üslubu değerlendiremez — uzunluğa,
  istenen ögelere ve kalıplaşmış hatalara bakar.
- **Sınav modu** bant ya da TOEFL puanı vermez; o eğitimli
  değerlendiricilerin ölçekli kararıdır.
- **Konuşma alıştırması** telaffuz puanı vermez; söylediğin kelimeleri
  hedefle karşılaştırır. Fonem analizi ücretli bir servis ister.
- **XP** öğrenmeyi ölçmez; onu SM-2 aralıkları ölçer.

### Kurulum

Gereksinim: Node.js 20.19+ (veya 22.12+).

```bash
git clone https://github.com/gulezgin/kelimece.git
cd kelimece
npm install
npm run dev
```

Tarayıcıda `http://localhost:5173`.

| Komut | Ne yapar |
|---|---|
| `npm run dev` | Geliştirme sunucusu |
| `npm run build` | `dist/` altına PWA build |
| `npm test` | 639 test |
| `npm run check:ids` | `$('id')` ↔ `index.html` çapraz denetimi |
| `npm run android:apk` | İmzasız debug APK |

> `index.html`'i çift tıklayarak açmak çalışmaz — uygulama ES
> modüllerine ayrılmış durumda, bir sunucu gerekiyor.

### Mimari

En önemli karar: **tanım ile ilerleme ayrı saklanır.**

```
words deposu     →  tanımlar (en, tr, örnek cümle, CEFR, tür, konu)
progress deposu  →  kullanıcıya ait olan her şey (seviye, tarih, geçmiş)
bağ              →  kararlı kimlik: core:abandon
```

Bu ayrım sayesinde içerik paketi güncellenince kullanıcının ilerlemesi
yerinde kalır. Sözleşmeyi bozan bir değişiklik sessizce herkesin
ilerlemesini siler.

| Klasör | Sorumluluk |
|---|---|
| `src/core/` | Saf mantık. DOM'a ve depoya dokunmaz; testlerin çoğu buraya bakar |
| `src/data/` | IndexedDB sarmalayıcı, göç, uygulama durumu |
| `src/ui/` | Çizim ve olaylar. Durumu değiştirmez |
| `src/platform/` | Capacitor ve tarayıcı API'leri |
| `src/main.js` | Tek bağlayıcı |

Ayrıntı ve tuzaklar: **[CLAUDE.md](CLAUDE.md)**.
Arayüz şeması ve tasarım jetonları: **[DESIGN.md](DESIGN.md)**.

### Aralıklı tekrar

SM-2 türevi. Her doğru cevapta bir sonraki tekrar daha uzağa planlanır;
unutulan kelime başa döner.

```
seviye:   0  →  1  →  2  →  3  →  4  →  5  →  6
gün:      1     2     4     7    15    30    60
```

Yeni kelimeler alfabetik değil **kullanım sıklığına** göre tanıtılır
(`freqRank`) ve oturum başına günlük hedef kadarı girer.

### İçerik üretimi

`public/content/core-v1.json` elle düzenlenmez — üretilir. Kaynaklar
Tatoeba cümle dökümü, bir sıklık listesi ve Oxford seviye listeleri.

```bash
npm run build:examples   # Tatoeba → örnek cümleler
npm run infer:pos        # sözcük türü + konu
npm run build:content    # hepsini birleştir
```

Diğer içerik dosyaları (`grammar`, `reading`, `writing`, `email`,
`antonyms`, `exam`, `emergency`) kelime paketinden **ayrı** indiriliyor;
böylece biri değişince 5276 kaydın yeniden kurulması gerekmiyor.

### Veri

Hepsi IndexedDB'de, cihazda. Hesap zorunlu değil, reklam yok, takip yok.
Firebase yapılandırılırsa isteğe bağlı bulut yedeği açılıyor
(`src/platform/firebase-config.js` varsayılan olarak boş).

### Belgeler

- [CLAUDE.md](CLAUDE.md) — mimari, değişmezler, tuzaklar
- [DESIGN.md](DESIGN.md) — ekran haritası, bileşen envanteri, jetonlar
- [ANDROID.md](ANDROID.md) — Android projesi, imzalama, Play Console
- [FIREBASE.md](FIREBASE.md) — bulut eşitleme kurulumu
- [store-listing.md](store-listing.md) — mağaza metinleri
- [privacy-policy.md](privacy-policy.md) — gizlilik politikası

---

## English

**An English learning app for Turkish speakers, A1–C2.** Spaced
repetition vocabulary at its core, plus grammar, reading, writing,
role-play dialogues, speaking practice, an IELTS/TOEFL mode and
emergency English.

No framework — vanilla JS (ES modules), bundled with Vite. Ships as a
PWA and wraps to Android with Capacitor. Data stays on the device and
the app works offline.

> The interface and all content are **in Turkish**. This app teaches
> English *to Turkish speakers*; explanations, error patterns and
> examples are written for that audience specifically.

### What's in it

5276 words introduced in frequency order with SM-2 spaced repetition ·
12 grammar lessons · 10 reading texts · 14 writing and email tasks · 60
role-play dialogues · speech recognition with word-level feedback and
voice recording · 68 antonym pairs · IELTS/TOEFL format practice ·
emergency phrasebook · XP, badges and a weekly goal derived from your
own history · light and dark themes.

### What it does not claim

The limits are stated **in the interface**, not hidden:

- Writing feedback checks length, required elements and common Turkish-speaker
  error patterns. It cannot judge meaning or style.
- Exam mode gives no band or TOEFL score — that is a trained rater's
  scaled judgement.
- Speaking practice gives no pronunciation score; it compares the words
  you said against the target. Phoneme-level analysis needs a paid service.
- XP does not measure learning. The SM-2 intervals do.

### Setup

Requires Node.js 20.19+ (or 22.12+).

```bash
git clone https://github.com/gulezgin/kelimece.git
cd kelimece
npm install
npm run dev
```

Then open `http://localhost:5173`.

### Architecture

The key decision: **definitions and progress are stored separately.**

```
words store     →  definitions (en, tr, example, CEFR, pos, topic)
progress store  →  everything that belongs to the user
link            →  stable id: core:abandon
```

This is what lets the content pack be updated without touching anyone's
progress. See [CLAUDE.md](CLAUDE.md) for the architecture, invariants
and the traps worth knowing about.

---

## License

MIT — see [LICENSE](LICENSE).

## Contributing

Pull requests welcome. Code comments, UI strings and commit messages are
in **Turkish**; indentation is **tabs**. Comments explain *why*, not
*what*. See [CONTRIBUTING.md](CONTRIBUTING.md).

Before opening a PR:

```bash
npm test && npm run check:ids && npm run build
```
