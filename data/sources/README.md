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

## Oxford CEFR listeleri

`Oxford_Lists_A1.pdf` … `Oxford_Lists_C1.pdf` (proje kökünde, git'e girmez)
→ `data/oxford-lists.json` (ayrıştırılmış çıktı, git'e girer)

- **Kaynak:** kullanıcı tarafından sağlandı
- **İçerik:** 4921 kelime — CEFR seviyesi + 1-3 Türkçe karşılık +
  sözcük türü (`[i.]` isim, `[f.]` fiil, `[s.]` sıfat, `[zf.]` zarf,
  `[zm.]` zamir, `[bağ.]` bağlaç, `[ed.]` edat, `[ünl.]` ünlem)
- **Kullanım:** seviye doğrulama, sözcük türü, Türkçe karşılık
  zenginleştirme ve yeni kelime ekleme

### Ayrıştırmada çözülen iki sorun

**1. Türkçe/İngilizce eşsesli tuzağı.** PDF metninde sütun ayracı yok:
`ten on [i.] onluk [i.]` tek satır. "on" hem İngilizce edat hem
Türkçe "10" olduğu için baş sözcük yanlışlıkla "ten on" çıkıyordu.
Çözüm: iki sözcüklü baş sözcük yalnızca ilk parça gerçek bir ifade
kurucu ise (`according`, `have`, `used`, `look`…) ve kalan kısım `[`
ile başlamıyorsa kabul ediliyor. Sonuç: 8 aday → 4 gerçek
(`according to`, `have to`, `next to`, `used to`).

**2. Kaynaktaki sözcük türü hataları.** Örnek:
`regain geri kazanmak [i.] tekrar ele geçirmek [f.] tekrar kavuşmak [f.]`
— ilk anlam yanlışlıkla isim işaretli, oysa üçü de fiil. İlk anlamın
türünü almak yerine **çoğunluk oyu** kullanılıyor; bu ~142 kaydı düzeltti.

### Lisans notu

Oxford 3000/5000 listeleri Oxford University Press'in derlemesidir.
Tek tek kelimeler ve seviyeleri olgudur, ancak **derlemenin kendisi**
bazı ülkelerde veritabanı/derleme hakkı doğurabilir. Ticari dağıtımdan
önce bu konuya bakılması önerilir — ayrıntı README ve proje notlarında.
