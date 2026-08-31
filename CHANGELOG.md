# Changelog

All notable changes to this project will be documented in this file.

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
