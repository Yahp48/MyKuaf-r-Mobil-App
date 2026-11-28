# BiBakım İşletme Paneli

Kuaför salonları ve kozmetik ürün satıcıları için web paneli. Tasarım ilkeleri: [DESIGN.md](DESIGN.md).

- **Kamuya açık:** tanıtım sayfası (SEO, yapılandırılmış veri, SSS), giriş, 3 adımlı işletme kaydı
  (VKN/TCKN, vergi dairesi, MERSİS, KEP, adres, IBAN; kuaförde harita konumu), şifre sıfırlama, KVKK ve sözleşme
- **Kuaför:** Bugün özeti, personel sütunlu randevu defteri (boş satıra tıkla → randevu yaz), randevu detayı
  (onay/tamamlandı/gelmedi/iptal, saat taşıma, salon notu, müşteri geçmişi), personel ve izinler, hizmetler,
  çalışma saatleri, gelir-gider, yorumlar, ayarlar
- **Satıcı:** özet, siparişler (hazırlanacak/kargoda/kapanan), kargo firması + takip no, iptal-iade, ürün ve
  hızlı stok düzenleme, görsel yükleme, finans, yorumlar, mağaza ve kargo ayarları
- **Canlı:** uygulamadan gelen randevu/sipariş panele anında düşer; paneldeki değişiklik uygulamaya anında yansır

```powershell
cd dashboard
npm install
npm run dev      # http://localhost:5173 (API için backend :5000'de çalışmalı)
npm run build    # dist/ (statik dosyalar; herhangi bir CDN/nginx ile sunulur, /api backend'e yönlendirilir)
```

Demo hesapları (yalnızca yerel seed): `salon@mykuafor.test` ve `satici@mykuafor.test`, şifre `Demo12345`.

Not: `index.html`, `robots.txt` ve `sitemap.xml` içindeki `isletme.bibakim.app` alan adı yer tutucudur.
