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
