# BiBakım İşletme — Tasarım

## Sahne
Salon sahibi ön masada, iki müşteri arasında tablete veya dizüstüne göz atıyor; telefon çalıyor, kuaför
"saat 3'teki kim?" diye soruyor. Satıcı akşam dükkân kapanınca siparişleri kargoya hazırlıyor.
Panel bir bakışta okunmalı, tek dokunuşla iş yapılmalı. Mod: **Operate** (panel), **Persuade** (tanıtım sayfası).

## Görsel dünya: "Defter"
Salonların yıllardır kullandığı kâğıt randevu defteri. Sıcak kâğıt zemin, mürekkep, cetvel çizgileri,
kenar boşluğundaki el yazısı notlar. Kart gölgesi, gradyan, cam efekti, ikonlu KPI kutusu YOK.

- **Kâğıt** `--paper #F4EFE6`, **yaprak** `--leaf #FBF8F2` (çalışma yüzeyi), **cetvel** `--rule #DED5C6`
- **Mürekkep** `--ink #1E1A16`, ikincil `--ink-2 #5C5348`, soluk `--ink-3 #8C8172`
- **Vurgu** işletme türüne göre tek mürekkep rengi: kuaför `gül kurusu #A23E5E`, satıcı `petrol #1F5F6B`
- Durumlar "damga" biçiminde: ince çerçeve + büyük harf + harf aralığı (renkli hap değil)

## Tipografi
- Başlık ve büyük rakamlar: **Fraunces** (değişken serif, optik boyut)
- Gövde: **IBM Plex Sans** (Türkçe karakterler tam, teknik netlik)
- Saat, tutar, kod: **IBM Plex Mono**, `tabular-nums`
- Ölçek: 12 / 13 / 15 / 18 / 24 / 34 / 48

## Düzen
- Sol "dizin" sütunu: kitap fihristi gibi numarasız, küçük-büyük harf bölüm etiketleri
- İçerik geniş kenar boşluklu; tablolar ince çizgiyle ayrılır, satır yüksekliği 44px (dokunmatik)
- İmza öğe: **Günlük defter** — saat satırları × personel sütunları, şu anki saati gösteren vurgu çizgisi
- 900px altında dizin üst menüye katlanır; defter yatay kaydırılır

## Erişilebilirlik
Odak halkası her etkileşimli öğede görünür, metin kontrastı ≥ 4.5:1, durumlar yalnızca renkle değil
metinle de ayrılır, form alanlarının hepsinde etiket ve hata mesajı vardır.
