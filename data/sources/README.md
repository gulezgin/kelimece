# Kaynak veriler

Bu klasördeki dosyalar üçüncü taraf kaynaklardan gelir ve **uygulamayla
birlikte dağıtılmaz** — yalnızca içerik paketi üretilirken kullanılır.

## en_50k.txt

İngilizce kelimelerin kullanım sıklığına göre sıralı listesi (50.000 kelime).

- **Kaynak:** https://github.com/hermitdave/FrequencyWords
- **Korpus:** OpenSubtitles 2018
- **Lisans:** MIT
- **Kullanım:** CEFR seviye atamalarının doğrulanması ve `freqRank` alanı.

### Bilinen yanlılık

Korpus film/dizi altyazılarından geliyor, yani konuşma dili ağırlıklı:

- Somut günlük ve sınıf kelimeleri (`carrot` #8557, `giraffe` #13464,
  `eraser` #24221) hak ettiğinden çok daha zor görünür. Her A1 ders
  kitabında olan bu kelimeler filmde nadiren geçer.
- Akademik ve biçimsel kelimeler de olduğundan seyrek görünür.

Bu yüzden sıklık verisi **tek karar verici olarak kullanılmaz**; elle
yapılan seviye atamalarına karşı ikinci bir görüş olarak değerlendirilir.
Yöntem ve gerekçeler `scripts/reconcile-cefr.mjs` dosyasında.

## Tatoeba cümle verileri

`tur_sentences.tsv.bz2`, `eng_sentences.tsv.bz2`, `tur-eng_links.tsv.bz2`

- **Kaynak:** https://tatoeba.org (https://downloads.tatoeba.org)
- **Lisans:** CC BY 2.0 FR — **ticari kullanıma açık, atıf zorunlu**
- **Kullanım:** her kelime için örnek cümle seçimi (`scripts/build-examples.py`)

### Atıf yükümlülüğü

CC BY, kaynağın belirtilmesini şart koşar. Atıf üç yerde veriliyor:

1. Uygulama içinde: **Ayarlar → Kaynaklar**
2. `privacy-policy.md`
3. İçerik paketinin üst verisinde (`pack.attribution`)

**Bu atıflar kaldırılmamalıdır** — lisans ihlali olur.

### Seçim yöntemi

675.000 Türkçe çevirisi olan İngilizce cümle taranır. Her kelime için:

- Cümle 4-12 sözcük olmalı (bağlam yeterli, okuması kolay)
- Büyük harfle başlayıp noktalama ile bitmeli
- Cümledeki diğer kelimeler hedef kelimenin seviyesinde ya da altında
  olmalı — A1 kelimesi C1 cümlesiyle öğretilmez
- Tatoeba'nın yer tutucu adları (Tom, Mary...) hafif cezalı: dışlanmıyor
  ama eşit puanda geçmeyen cümle tercih ediliyor

Kapsama: **2441 / 2493 kelime (%97,9)**
