# MyKuaför

Kuaför/güzellik salonu müşterileri için mobil uygulama + backend: harita üzerinden salon bulma ve
yol tarifi, randevu alma, salon ürünleri mağazası, sepet ve ödeme, cüzdan, bildirimler.
Arayüz dili Türkçe. Uygulama adı "MyKuaför", ekranlardaki salon markası "WOMAN HAIR DESIGN".
Hedef: Play Store ve App Store'da yayın — prototip değil, mağaza kurallarına uygun olmalı.

## Yapı
- Kök dizin: Expo mobil uygulaması (saf JavaScript)
- `backend/`: Node.js + TypeScript API (ayrıntılar `backend/README.md`)

## Mobil teknoloji
- Expo SDK 54, React Native 0.81, React 19.1, New Architecture açık
- Expo CNG: `android/` ve `ios/` git'te YOK; native ayarlar `app.config.js`'te (EAS Build / `npx expo prebuild`)
- Navigasyon: `@react-navigation/stack`. `App.js` oturuma göre `AuthStack` (giriş/kayıt) veya `MainStack` gösterir
- Global durum: `context/AppContext.js` → oturum, sunucudaki sepet, okunmamış bildirim sayısı
- API: `services/api.js` tek istemci. Yenileme token'ı `expo-secure-store`'da, erişim token'ı bellekte; 401'de otomatik yenileme
- API adresi: `config.js` → `.env`'deki `EXPO_PUBLIC_API_URL`; geliştirmede boşsa Expo host IP'si:5000
- Ödeme: `services/checkout.js` sağlayıcının güvenli sayfasını `expo-web-browser` ile açar, sonucu sunucudan sorgular.
  Uygulama kart bilgisi ASLA toplamaz (PCI-DSS)
- Ortak bileşenler: `components/` (AppHeader, BottomNav, ProductCard, ui.js, theme.js, useRemote.js)

## Backend teknoloji
- Express 5, PostgreSQL 17 + Prisma ORM 7 (driver adapter `@prisma/adapter-pg`), Zod 4, JWT + Argon2id
- Para kuruş cinsinden Int; API'de TL ondalık. Fiyatlar her zaman sunucuda hesaplanır
- Çift rezervasyon PostgreSQL exclusion constraint ile engellenir (migration'da elle eklenmiş SQL)
- Ödeme sağlayıcısı soyut: `PAYMENT_PROVIDER=mock` (geliştirme) | `iyzico` (henüz yazılmadı). Production'da mock yasak

## Komutlar
Mobil (kök dizin):
- `npm install`, `npx expo start`
- `npx expo export --platform android --output-dir dist` — derleme kontrolü (her değişiklikten sonra)
- `npx expo-doctor` — bağımlılık/yapılandırma kontrolü
Backend (`backend/`):
- `docker compose up -d` (PostgreSQL), `npm run db:deploy`, `npm run db:seed`, `npm run dev`
- `npm test` (33 entegrasyon testi, `mykuafor_test` veritabanı), `npm run typecheck`
- Şema değişikliği: `prisma/schema.prisma` düzenle → `npm run db:migrate -- --name <ad>`
- Demo hesabı (yalnızca yerel seed): `demo@mykuafor.test` / `Demo12345`

## Kurallar
- `.env` asla commit edilmez. Yeni anahtar → ilgili `.env.example`'a boş olarak ekle
- `EXPO_PUBLIC_*` değerleri uygulama paketine gömülür: gizli anahtar koyma (gizli anahtarlar backend'de)
- Yeni mobil paket: `npx expo install <paket>` (SDK 54 uyumlu sürüm)
- Ekran metinleri Türkçe; kod içi isimler İngilizce
- Mağaza kuralları: hesap silme uygulama içinde kalmalı (AccountSettings), sahte veri/yorum/indirim gösterilmez,
  çalışmayan özellik menüde yer almaz, izin metinleri Türkçe ve gerekçeli
- Her adım ayrı commit; doğrulama: mobil bundle + `backend` testleri

## Bilinen eksikler / sıradaki işler
1. iyzico ödeme entegrasyonu (üye işyeri hesabı ve API anahtarı gerekli) — `backend/src/modules/payments/providers.ts`
2. Yönetim paneli yok: salon, personel, hizmet, ürün ve sipariş durumu şu an seed/veritabanından yönetiliyor
3. Production altyapısı: barındırma, alan adı + HTTPS, SMTP, EAS projectId (push bildirimleri için)
4. Gerçek içerik: KVKK aydınlatma metni, mesafeli satış sözleşmesi, ön bilgilendirme formu (PrivacyScreen),
   Hakkında/Destek ekranlarındaki telefon, WhatsApp ve sosyal medya adresleri yer tutucu
5. Expo SDK 54 → güncel SDK (58) yükseltmesi ayrı bir adım olarak yapılmalı (cihazda test gerekir)
6. Gerçek zamanlı güncellemeler backend'de hazır (Socket.IO) ama mobil henüz bağlanmıyor; ekranlar odakta yenileniyor
7. Eski ekranlar (About, Privacy, Support, Feedback) hâlâ kendi başlık/alt menü kopyalarını kullanıyor;
   `components/AppHeader` ve `BottomNav`'a taşınabilir
