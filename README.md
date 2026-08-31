# Kelime Havuzum (My Word Pool)

[🇬🇧 English](#english--0) | [🇹🇷 Türkçe](#türkçe)

---

## Türkçe

Kelime Havuzum, İngilizce öğrenenler için geliştirilmiş, **SRS (Spaced Repetition System)** tabanlı bir kelime öğrenme uygulamasıdır.

### ✨ Özellikler

- **Kelime Ekleme & Yönetimi** - İngilizce kelime, Türkçe anlam, örnek cümle ve etiketlerle kelime ekleyin
- **Akıllı Tekrar Sistemi** - Spaced Repetition algoritmamı ile öğrenmeyi optimize edin
  - 7 seviye ilerleme sistemi (1, 2, 4, 7, 15, 30, 60 gün)
  - 5 doğru cevaptan sonra otomatik "öğrenilmiş" durumuna geç
- **İki Görünüm Modu**
  - 📇 **Kartlar**: Detaylı kelime kartları
  - 📋 **Anlamlar**: Grid görünüm
- **Esnek Tekrar Modları**
  - Normal Tekrar: Sadece öğrenilmesi gereken kelimeler
  - Serbest Tekrar: Tüm kelimeleri rastgele sırayla
- **Aramacılık & Filtreleme**
  - Kelime, anlam veya etikete göre arayın
  - Filtreler: Hepsi, Bugün tekrar, Sadece yeni, Öğrenilmiş
- **Günlük İstatistikler**
  - Toplam kelime sayısı
  - Bugün tekrar edilecek sayı
  - Bugün eklenen kelimeler
- **Yedekleme & Geri Yükleme**
  - JSON olarak dışa aktar
  - Başka cihazdan JSON içe aktar
  - Tarayıcı localStorage'da otomatik kayıt
- **Responsive Tasarım** - Telefon, tablet ve masaüstünde mükemmel çalışır
- **Koyu Tema** - Göz yormayan, profesyonel tasarım

### 🚀 Nasıl Kullanılır

#### Çevrimiçi (En kolay)
Direkt olarak tarayıcınızda açın:
```
https://kelime-havuzum.netlify.app
```
*veya local dosyayı açın*

#### Local Kurulum
1. Deposu klonlayın:
```bash
git clone https://github.com/yourusername/kelime-havuzum.git
cd kelime-havuzum
```

2. `index.html` dosyasını tarayıcıda açın:
```bash
# macOS/Linux
open index.html

# Windows
start index.html
```

Veya basit bir web sunucusu çalıştırın:
```bash
python -m http.server 8000
# veya
npx live-server
```

### 📖 Kullanım Adımları

1. **Kelime Ekleyin** - Sol panelden:
   - İngilizce kelimeyi yazın
   - Türkçe anlamını yazın
   - (İsteğe bağlı) Örnek cümle ekleyin
   - (İsteğe bağlı) Etiketler ekleyin (virgülle ayırın)
   - "Ekle" butonuna tıklayın

2. **Tekrar Başlatın**:
   - Sol panelden havuz seçin (Hepsi, Tekrar, Yeni, Öğrenilmiş)
   - İsteğe bağlı: "Serbest tekrar" seçseneğini ayarlayın
   - "Tekrar Et" butonuna tıklayın

3. **Tekrar Modunda**:
   - İlk olarak sadece İngilizce kelimeyi görürsünüz
   - "Anlamı Göster" butonuna tıklayın
   - "Biliyordum ✓" veya "Unuttum ✗" seçeneğini işaretleyin
   - Otomatik olarak sonraki kelimeye geçer

4. **Yedekleme**:
   - "JSON Dışa Aktar" ile yedeğinizi alın
   - "Dosya Seç" ile önceki yedeğinizi geri yükleyin

### ⚙️ Ayarlar

- **Günlük Hedef** - Günde öğrenmek istediğiniz kelime sayısını ayarlayın
- **Bugün Sayaç Sıfırla** - Günün ilerlemeyi sıfırla
- **Tüm Veriyi Sil** - Tüm kelimeleri ve ayarları sil ⚠️

### 💾 Veri Depolaması

- Tüm veriler tarayıcının **localStorage**'da saklanır
- Veriler hiçbir sunucuya gönderilmez (tamamen özel)
- Tarayıcı veya uygulamayı değiştirirken JSON olarak yedek alın

### 🎨 Tema

Uygulama modern, koyu temalı bir arayüze sahiptir:
- Rahat okuma için optimize edilmiş renk şeması
- Mobil desteğiyle tam responsive
- Hızlı ve akıcı kullanıcı deneyimi

### 📱 Tarayıcı Uyumluluğu

- ✅ Chrome, Edge, Firefox, Safari (son 2 sürüm)
- ✅ Mobil tarayıcılar (iOS Safari, Chrome Mobile)
- ✅ Progressive Web App olarak yüklenebilir (PWA desteği planlı)

### 🔧 Teknik Bilgiler

- **Vanilla JavaScript** - Hiç framework bağımlılığı yok
- **HTML5 + CSS3** - Modern web standartları
- **LocalStorage API** - Veriler tarayıcıda saklanır
- **Responsive Grid** - Mobil uyumlu tasarım

### 📊 Spaced Repetition Algoritması

Uygulama **SM-2 tabanlı** basitleştirilmiş bir sistem kullanır:

```
Başarılı cevap → Seviye +1
Başarısız cevap → Seviye 0 (baştan başla)
5 başarılı → Öğrenilmiş olarak işaretle
```

**Tekrar Takvimi (gün cinsinden)**:
- Seviye 0 → 1 gün
- Seviye 1 → 2 gün
- Seviye 2 → 4 gün
- Seviye 3 → 7 gün
- Seviye 4 → 15 gün
- Seviye 5 → 30 gün
- Seviye 6+ → 60 gün

---

## English

My Word Pool is a **SRS (Spaced Repetition System)** based vocabulary learning app designed for English learners.

### ✨ Features

- **Add & Manage Words** - Add English words with Turkish meanings, example sentences, and tags
- **Smart Learning System** - Optimize learning with Spaced Repetition scheduling
  - 7-level progression system (1, 2, 4, 7, 15, 30, 60 days)
  - Auto-mark as "learned" after 5 correct answers
- **Two View Modes**
  - 📇 **Cards**: Detailed word cards
  - 📋 **Tiles**: Grid view
- **Flexible Review Modes**
  - Normal Review: Learn only due words
  - Free Review: Random order of all unlearned words
- **Search & Filtering**
  - Search by word, meaning, or tags
  - Filters: All, Due today, New only, Learned
- **Daily Statistics**
  - Total words
  - Words due for review
  - Words added today
- **Backup & Restore**
  - Export as JSON
  - Import from other devices
  - Auto-save to browser localStorage
- **Responsive Design** - Works perfectly on mobile, tablet, and desktop
- **Dark Theme** - Professional, comfortable design

### 🚀 Quick Start

#### Online (Easiest)
Open directly in your browser:
```
https://kelime-havuzum.netlify.app
```

#### Local Setup
```bash
git clone https://github.com/yourusername/kelime-havuzum.git
cd kelime-havuzum
open index.html  # or start index.html on Windows
```

Or run a local server:
```bash
python -m http.server 8000
# or
npx live-server
```

### 📖 How to Use

1. **Add Words** - From left panel:
   - Enter English word
   - Enter Turkish meaning
   - (Optional) Add example sentence
   - (Optional) Add tags (comma-separated)
   - Click "Ekle" (Add)

2. **Start Review**:
   - Select pool: All, Due, New, or Learned
   - Optional: Enable "Serbest tekrar" (Free review)
   - Click "Tekrar Et" (Review)

3. **In Review Mode**:
   - See English word first
   - Click "Anlamı Göster" (Show meaning)
   - Mark "Biliyordum ✓" (Knew it) or "Unuttum ✗" (Forgot)
   - Auto-advances to next word

4. **Backup**:
   - Click "JSON Dışa Aktar" to export
   - Click file picker to import previous backup

### 💾 Data Storage

- All data stored locally in **browser localStorage**
- No data sent to any server (completely private)
- Export JSON backup when switching browsers

### 🔧 Technical Details

- **Vanilla JavaScript** - No framework dependencies
- **HTML5 + CSS3** - Modern web standards
- **LocalStorage API** - Client-side data persistence
- **Responsive Grid** - Mobile-friendly

### 📊 Spaced Repetition Algorithm

Uses a simplified SM-2-based system:
- Correct answer → Level +1
- Wrong answer → Level 0 (restart)
- 5 correct answers → Mark as learned

Review intervals (in days):
- Level 0 → 1 day
- Level 1 → 2 days
- Level 2 → 4 days
- Level 3 → 7 days
- Level 4 → 15 days
- Level 5 → 30 days
- Level 6+ → 60 days

---

### 📄 License

MIT License - See [LICENSE](LICENSE) file

### 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### 📧 Questions or Feedback?

Open an issue on GitHub or reach out directly.

---

**Made with ❤️ for English learners**
