# Play Store mağaza kaydı metinleri

Kopyala-yapıştır için hazır. Karakter sınırları Play Console'un
istediği değerler.

**Metinler arama için yazıldı.** Play'de sıralamayı belirleyen üç
indekslenen alan var ve ağırlıkları eşit değil:

| Alan | Sınır | Ağırlık |
|---|---|---|
| Uygulama adı | 30 | En yüksek |
| Kısa açıklama | 80 | Yüksek |
| Tam açıklama | 4000 | Orta (terim sıklığı sayılır) |

Kural: **başlığa sığmayan terim kısa açıklamaya, oraya da sığmayan
tam açıklamaya taşınır.** Aynı terimi üç alanda da tekrarlamak
sıralamayı artırmıyor; Play bunu doldurma sayıp cezalandırabiliyor.

---

## Uygulama adı (30 karakter)

```
Kelimece: İngilizce Öğren
```

*(25 karakter)*

**Neden bu ad:** Marka **"kelime"** terimini kendi içinde taşıyor,
başlığın görünen kısmı da **"İngilizce Öğren"** geniş terimini alıyor.
Böylece tek başlıkla iki arama grubuna birden giriliyor ve başlık
doldurma gibi durmuyor — Play jenerik/doldurulmuş başlıkları kalite
sinyali olarak aşağı çekiyor.

Yakaladığı aramalar: `ingilizce` · `ingilizce öğren` · `öğren` ·
`kelime` · `ingilizce kelime` · `kelimece` (marka)

> **Başlıkta yasak:** emoji, TAMAMI BÜYÜK harf, "en iyi", "1
> numara", "ücretsiz", "indirim", performans iddiaları. Bunlar
> yayını reddettirir.

---

## Kısa açıklama (80 karakter)

```
Kelime, gramer, okuma, konuşma ve IELTS. Aralıklı tekrarla A1'den C2'ye.
```

*(72 karakter)*

Başlığın alamadığı terimleri taşıyor: `gramer` · `okuma` · `konuşma` ·
`IELTS` · `aralıklı tekrar` · `A1` · `C2`.

---

## Tam açıklama (4000 karakter)

Terim sıklığı burada sayılıyor. Ana terim ("İngilizce") doğal biçimde
5 kez geçiyor; daha fazlası doldurma sayılıyor. Başlıklar tarama
kolaylığı için, alt satırlar arama için.

```
Kelimece, İngilizce'yi A1'den C2'ye kadar sistemli biçimde öğrenmen için
tasarlandı. Ezber listesi değil: ne zaman neyi tekrar etmen gerektiğini
hesaplayan bir çalışma arkadaşı.

Türkçe konuşanlar için yazıldı. Açıklamalar Türkçe, örnekler Türkçe
konuşanların gerçekten zorlandığı yerlerden seçildi.

■ ARALIKLI TEKRAR — KELİME AKLINDA KALSIN

Bildiğin kelimeyi tekrar tekrar sormaz. Her doğru cevapta bir sonraki
tekrar daha uzağa planlanır: 1 gün, 2 gün, 4 gün, bir hafta, iki hafta,
bir ay. Unuttuğun kelime başa döner. Zamanını gerçekten zorlandığın
kelimelere ayırırsın.

5300 kelime, kullanım sıklığına göre sıralı. En çok karşına çıkacak
kelimeyi önce öğrenirsin.

■ SADECE KELİME DEĞİL

• Dilbilgisi dersleri ve quizleri — her sorunun "neden" açıklaması var
• Okuma parçaları — hikâyeler ve makaleler, sorular metin görünmeden
• Yazma ve e-posta görevleri — örnek cevapla karşılaştırmalı
• Rol yapmalı diyaloglar — sen B kişisi olarak cevap veriyorsun
• Zıt anlamlılar — çift yönlü sorulur
• Konu konu kelime — seyahat, iş, sağlık, yemek

■ KONUŞMA PRATİĞİ

İngilizce cümleyi mikrofona söylersin, hangi kelimeyi tutturamadığın
kelime kelime gösterilir. Kendi sesini kaydedip dinleyebilirsin — konuşurken
fark etmediğin duraksamaları böyle duyarsın.

Farklı aksanlar: cihazında kurulu İngilizce seslerin arasından seçim
yaparsın (Amerikan, İngiliz, Avustralya...) ve aynı cümleyi
karşılaştırmalı dinlersin.

■ SINAV MODU: IELTS VE TOEFL

Sınav biçimi, bölümler ve süreler. Gerçek görev formatında yazma
alıştırmaları. Konuşma görevleri gerçek süreleriyle: 1 dakika hazırlık,
2 dakika konuşma. Sınava özgü kelime setleri.

■ ACİL İNGİLİZCE

Hastane, polis, eczane, havaalanı, kayboldum, para. Söyleyeceğin
cümleler ve karşıdan DUYACAĞIN cümleler bir arada. Cümleyi
seslendirebilir ya da telefonu karşındakine gösterebilirsin.
İnternet gerekmez, tamamı ücretsiz.

■ İLERLEMENİ GÖR

Günlük hedef, seri takibi, XP ve rozetler. Haftalık hedef senin kendi
geçmişinden hesaplanır — herkese aynı sayı verilmez. Kelime, dilbilgisi,
okuma, diyalog ve konuşma için ayrı başarı oranları.

■ ÇEVRİMDIŞI ÇALIŞIR

Uçakta, metroda, kotan bittiğinde. Tüm İngilizce içeriği cihazında.
Reklam yok, takip yok, hesap zorunlu değil.

■ NE VAAT ETMİYORUZ

Yazma kontrolü uzunluğa, istenen ögelere ve Türkçe konuşanların sık
yaptığı kalıp hatalara bakar — anlamı ve üslubu değerlendiremez.
Sınav modu bant ya da TOEFL puanı vermez; o eğitimli
değerlendiricilerin kararıdır. Konuşma alıştırması telaffuz puanı
vermez, söylediğin kelimeleri hedefle karşılaştırır. Bunları
uygulamanın içinde de açıkça yazıyoruz.

■ ÜCRETSİZ VE ABONELİK

A1 ve A2 seviyelerinin tamamı ücretsiz. Acil İngilizce her zaman
ücretsiz. B1'den C2'ye abonelikle açılır.
```

---

## Anahtar kelime haritası

Hangi terimin hangi alanda geçtiği. Bir terim en az bir yerde
geçmiyorsa o arama için görünmezsin.

| Terim | Ad | Kısa | Tam |
|---|:--:|:--:|:--:|
| ingilizce | ✓ | | ✓ |
| ingilizce öğren | ✓ | | ✓ |
| kelime | ✓ | ✓ | ✓ |
| ingilizce kelime | ✓ | | ✓ |
| kelime ezberleme | | | ✓ |
| aralıklı tekrar | | ✓ | ✓ |
| gramer / dilbilgisi | | ✓ | ✓ |
| okuma | | ✓ | ✓ |
| konuşma pratiği | | ✓ | ✓ |
| ielts | | ✓ | ✓ |
| toefl | | | ✓ |
| çevrimdışı | | | ✓ |
| a1 / c2 | | ✓ | ✓ |

**Eksik bırakılanlar ve sebebi:** `yds`, `yökdil`, `kpds` — uygulamada
o sınavlara özel içerik yok. Aranan terim diye eklemek, indiren
kullanıcının aradığını bulamayıp uygulamayı silmesine yol açar; Play
bunu kaldırma oranından görüp sıralamayı düşürür.

---

## Görsel varlıklar — hazırlanacaklar

| Varlık | Boyut | Not |
|---|---|---|
| Uygulama simgesi | 512×512 PNG | Şeffaflık yok |
| Öne çıkan görsel | 1024×500 PNG | Mağaza üstünde |
| Telefon ekran görüntüsü | en az 2, 1080×1920 | 8'e kadar |
| 7" tablet | isteğe bağlı | |
| 10" tablet | isteğe bağlı | |

**Ekran görüntüleri de arama sonucu tıklanma oranını etkiliyor.**
Önerilen sıra — ilk ikisi listede küçük hâlde görünüyor, en güçlü
ikisi öne:

1. Kelime çalışma ekranı, üstünde "5300 kelime, sıklık sırasına göre"
2. İlerleme paneli (halkalar, grafik, rozetler)
3. Diyalog rol yapma
4. Sınav modu — IELTS konuşma sayacı
5. Acil İngilizce
6. Açık ve koyu tema yan yana

---

## Kategori ve etiketler

- **Kategori:** Eğitim
- **Etiketler:** Dil öğrenme, Eğitim, Kelime
- **İçerik derecelendirmesi:** Herkes
- **Hedef kitle:** 13+

---

## Sürüm notları (ilk yayın)

```
İlk sürüm.

• 5300 kelime, aralıklı tekrar ile A1–C2
• Dilbilgisi, okuma, yazma, e-posta ve rol yapmalı diyalog
• Konuşma pratiği ve ses kaydı
• IELTS / TOEFL modu
• Acil İngilizce — her zaman ücretsiz
• Açık ve koyu tema
• Çevrimdışı çalışır, reklam yok
```

---

## Yayından sonra

ASO tek seferlik bir iş değil. Play Console **Erişim ve cihazlar →
Mağaza performansı** altında hangi aramaların gösterim getirdiğini
veriyor. İlk iki hafta sonra oraya bak:

- Gösterim alıp **tıklanmayan** terim → ekran görüntüleri ya da kısa
  açıklama o beklentiyi karşılamıyor
- Tıklanıp **indirilmeyen** terim → ekran görüntüleri yanlış şeyi
  gösteriyor
- Hiç gösterim almayan terim → o kelime metinlerde yok ya da o
  aramada rekabet çok yüksek

Adı değiştirmek sıralamayı sıfırlamıyor ama **paket adı
(`com.gulezgin.kelimece`) yayından sonra ASLA değişmez.** İlk yükleme
öncesi son kontrol noktası burası.
