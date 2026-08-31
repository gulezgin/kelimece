# 🚀 Hızlı Başlangıç Rehberi

[English](#quick-start-guide) | [Türkçe](#hızlı-başlangıç-rehberi)

---

## Hızlı Başlangıç Rehberi

### Adım 1: Uygulamayı Aç
`index.html` dosyasını tarayıcıda açın. İnternet bağlantısına veya kuruluma ihtiyaç yoktur.

### Adım 2: Ilk Kelimeleri Ekle
1. Sol panelde **"➕ Kelime Ekle"** bölümünü bulun
2. English alanına İngilizce kelime yazın (örn: "happy")
3. Turkish alanına Türkçe anlamını yazın (örn: "mutlu, neşeli")
4. İsteğe bağlı: Örnek cümle ve etiket ekleyin
5. **"Ekle"** butonuna tıklayın

```
English:  happy
Turkish:  mutlu, neşeli
Example:  She is always happy with her life.
Tags:     adjective, emotion
```

### Adım 3: Tekrar Başlat
1. Sol panelde havuz seçin:
   - **"Tekrar"** - Sadece öğrenilmesi gereken kelimeler
   - **"Yeni"** - Bugün eklenen kelimeler
   - **"Hepsi"** - Tüm kelimeler
2. **"Tekrar Et"** butonuna tıklayın
3. Tekrar kartında:
   - Kelimeyi görürsünüz
   - **"Anlamı Göster"** butonuna tıklayın
   - **"Biliyordum ✓"** veya **"Unuttum ✗"** seçeneğini seçin

### Adım 4: İstatistikleri Takip Et
Başlıkta istatistikler görüntülenir:
- **Toplam**: Tüm kelime sayısı
- **Bugün tekrar**: Tekrar edilmesi gereken kelime sayısı
- **Bugün eklendi**: Bugün eklenen kelimeler / Günlük hedef

### Adım 5: Yedekle
Sol panelde **"💾 Yedekleme"** bölümünden:
- **"JSON Dışa Aktar"** - Kelimeleri dosya olarak indir
- **"Dosya Seç"** - Daha önce kaydettiğin dosyayı geri yükle

---

## Ipuçları & Püf Noktaları

### 🎯 Etkili Öğrenme
- Günlük hedefini (örn: 10 kelime) ayarla
- Gün boyunca düzenli tekrar yap
- İlk başta yeni kelimelere odaklan

### 🔍 Arama & Filtreleme
- **Ara kutusuna** kelime, anlam veya etiket yazarak filtrele
- Etiketlere tıklayarak o etikete göre filtrele
- Farklı görünüm modları (Kartlar/Kutuları) arasında geç

### 💾 Veri Güvenliği
- Tüm veriler tarayıcında **localStorage**'da saklanır
- Sunucuya hiçbir veri gönderilmez
- Tarayıcı veya cihaz değiştirirken JSON olarak yedek al

### ⚙️ Ayarlar
- **Günlük hedef** - Hedef kelime sayısını ayarla
- **Bugün sayaç sıfırla** - Günün ilerlemeyi sıfırla
- **Tüm veriyi sil** - ⚠️ Tüm kelimeleri sil (geri alınamaz!)

### 📊 Seviye Sistemi
```
Seviye 0 → Yeni (1 gün sonra tekrar)
Seviye 1 → 2 gün sonra tekrar
Seviye 2 → 4 gün sonra tekrar
Seviye 3 → 7 gün sonra tekrar
Seviye 4 → 15 gün sonra tekrar
Seviye 5 → 30 gün sonra tekrar
Seviye 6+ → Öğrenilmiş (60+ gün)
```

5 doğru cevaptan sonra otomatik olarak **Seviye 6** (Öğrenilmiş) olur.

### 📱 Mobil Kullanım
- Uygulamayı telefona ekleyebilirsin (tarayıcının menüsünde "Ana ekrana ekle")
- Tamamen responsive ve mobil-optimized
- Offline de çalışır (localStorage sayesinde)

---

## Örnek Veri Yükleme

`sample-vocabulary.json` dosyasını kullanarak örnek kelimelerle başla:

1. **"JSON Dışa Aktar"** yanında dosya input alanını bul
2. `sample-vocabulary.json` seç
3. Otomatik olarak yüklenecek

---

## Sıkça Sorulan Sorular

### S: Verilerim ne kadar süre saklanır?
A: Tarayıcı localStorage'ı temizlemedikçe kalır. Güvenliği için düzenli JSON yedekleri al.

### S: Başka bir cihaza taşıyabilir miyim?
A: Evet! JSON olarak dışa aktar, diğer cihazdan içe aktar.

### S: Serbest tekrar modu ne işe yarar?
A: Normal tekrar (sadece due kelimeler) yerine tüm kelimeleri rastgele sırayla tekrar et.

### S: İnternet bağlantısına ihtiyacım var mı?
A: Hayır! Uygulama tamamen offline çalışır. localStorage kullanır.

### S: Verileri yanlışlıkla sildim, kurtarabilir miyim?
A: Eğer JSON yedek aldıysan evet. Yoksa, ne yazık ki kurtarılamaz.

---

## Sorun Giderme

### Veriler kayboldu
- Tarayıcı önbelleğini temizledin mi? localStorage silinir.
- **Çözüm**: JSON yedek varsa içe aktar

### Aplikasyon yalm yüklemiyor
- Tarayıcı cache'sini temizle (Ctrl+F5 / Cmd+Shift+R)
- Farklı tarayıcı dene
- JavaScript'in aktif olduğundan emin ol

### JSON içe aktarma hata veriyor
- Dosya formatı doğru mu? (geçerli JSON olmalı)
- Dosya **sample-vocabulary.json** gibi yapılandırılmış mı?

---

## Quick Start Guide

### Step 1: Open the App
Open `index.html` in your browser. No internet or installation needed.

### Step 2: Add Your First Words
1. Find **"➕ Add Word"** section on the left
2. Enter English word (e.g., "happy")
3. Enter Turkish meaning (e.g., "mutlu, neşeli")
4. Optional: Add example sentence and tags
5. Click **"Ekle"** (Add)

### Step 3: Start Review
1. Choose a pool: **"Tekrar"** (Due), **"Yeni"** (New), or **"Hepsi"** (All)
2. Click **"Tekrar Et"** (Review)
3. In the review card:
   - See the English word
   - Click **"Anlamı Göster"** (Show meaning)
   - Mark **"Biliyordum ✓"** or **"Unuttum ✗"**

### Step 4: Track Progress
Header shows statistics:
- **Toplam** (Total): All vocabulary count
- **Bugün tekrar** (Due): Words to review today
- **Bugün eklendi** (Added today): Count vs. daily goal

### Step 5: Backup
From **"💾 Yedekleme"** section:
- Export as JSON
- Import previously saved file

---

## Tips & Tricks

### 🎯 Effective Learning
- Set daily goal (e.g., 10 words)
- Review consistently throughout the day
- Focus on new words first

### 🔍 Search & Filters
- Type in search box to filter by word, meaning, or tag
- Click tags to filter by category
- Switch between Cards and Tiles view

### 💾 Data Security
- All data stored locally in browser localStorage
- No data sent to any server
- Backup as JSON when switching browsers

### 📊 Level System
```
Level 0 → New (review in 1 day)
Level 1 → Review in 2 days
Level 2 → Review in 4 days
Level 3 → Review in 7 days
Level 4 → Review in 15 days
Level 5 → Review in 30 days
Level 6+ → Learned (60+ days)
```

Auto-marks as **Level 6** (Learned) after 5 correct answers.

### 📱 Mobile Usage
- Add to home screen from browser menu
- Fully responsive and mobile-optimized
- Works offline thanks to localStorage

---

**Happy Learning! 🎓**
