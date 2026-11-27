# MyKuaför

Kuaför/güzellik salonu müşterileri için mobil uygulama + backend: harita üzerinden salon bulma ve
yol tarifi, randevu alma, salon ürünleri mağazası, sepet ve ödeme, cüzdan, bildirimler.
Arayüz dili Türkçe. Uygulama adı "MyKuaför", ekranlardaki salon markası "WOMAN HAIR DESIGN".
Hedef: Play Store ve App Store'da yayın — prototip değil, mağaza kurallarına uygun olmalı.

## Yapı
- Kök dizin: Expo mobil uygulaması (saf JavaScript) — müşteriler
- `backend/`: Node.js + TypeScript API (ayrıntılar `backend/README.md`)
- `dashboard/`: işletme paneli, React + Vite + TypeScript (ayrıntılar `dashboard/README.md`, tasarım `dashboard/DESIGN.md`)
- İki işletme türü: `SALON` (kuaför) ve `SELLER` (ürün satıcısı). Hesap rolü `BUSINESS_OWNER`;
  işletme hesapları mobil uygulamaya, müşteri hesapları panele giremez

## Mobil teknoloji
- Expo SDK 58, React Native 0.88, React 19.3 (Expo Go mağaza sürümü yalnızca güncel SDK'yı açar)
- Expo CNG: `android/` ve `ios/` git'te YOK; native ayarlar `app.config.js`'te (EAS Build / `npx expo prebuild`)
- Navigasyon: `@react-navigation/stack`. `App.js` oturuma göre `AuthStack` (giriş/kayıt) veya `MainStack` gösterir
- Global durum: `context/AppContext.js` → oturum, sunucudaki sepet, okunmamış bildirim sayısı
- Canlı bağlantı: `services/realtime.js` (Socket.IO). `salons:changed`, `catalog:changed`, `appointment:updated`,
  `order:updated`, `notification:new`; ekranlarda `useRealtimeEvent` ile dinlenir
- API: `services/api.js` tek istemci. Yenileme token'ı `expo-secure-store`'da, erişim token'ı bellekte; 401'de otomatik yenileme
- API adresi: `config.js` → `.env`'deki `EXPO_PUBLIC_API_URL`; geliştirmede boşsa Expo host IP'si:5000
- Ödeme: `services/checkout.js` sağlayıcının güvenli sayfasını `expo-web-browser` ile açar, sonucu sunucudan sorgular.
  Uygulama kart bilgisi ASLA toplamaz (PCI-DSS)
- Ortak bileşenler: `components/` (AppHeader, BottomNav, ProductCard, ContactList, ui.js, theme.js, useRemote.js)
- Tasarım: tek vurgu rengi `#C9184A` (`colors.primary`), beyaz başlık ve alt menü, gri yüzey üzerinde gruplu kartlar,
  Ionicons çizgi ikonlar. Renkleri ekranlara sabit yazma; `components/theme.js`'ten al

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
- `npm test` (48 entegrasyon testi, `mykuafor_test` veritabanı), `npm run typecheck`
- Şema değişikliği: `prisma/schema.prisma` düzenle → `npm run db:migrate -- --name <ad>`
- Demo hesapları (yalnızca yerel seed, şifre `Demo12345`): müşteri `demo@mykuafor.test`,
  kuaför paneli `salon@mykuafor.test`, satıcı paneli `satici@mykuafor.test`
Panel (`dashboard/`): `npm run dev` (http://localhost:5173, /api'yi :5000'e yönlendirir), `npm run build`
Telefonla test: backend `.env` → `PUBLIC_BASE_URL=http://<bilgisayar-IP>:5000`; `npx expo start` → Expo Go ile QR

## Kurallar
- `.env` asla commit edilmez. Yeni anahtar → ilgili `.env.example`'a boş olarak ekle
- `EXPO_PUBLIC_*` değerleri uygulama paketine gömülür: gizli anahtar koyma (gizli anahtarlar backend'de)
- Yeni mobil paket: `npx expo install <paket>` (SDK 58 uyumlu sürüm)
- Ekran metinleri Türkçe; kod içi isimler İngilizce
- Mağaza kuralları: hesap silme uygulama içinde kalmalı (AccountSettings), sahte veri/yorum/indirim gösterilmez,
  çalışmayan özellik menüde yer almaz, izin metinleri Türkçe ve gerekçeli
- Her adım ayrı commit; doğrulama: mobil bundle + `backend` testleri

## Bilinen eksikler / sıradaki işler
1. iyzico ödeme entegrasyonu (üye işyeri hesabı ve API anahtarı gerekli) — `backend/src/modules/payments/providers.ts`
2. Platform yönetici (admin) paneli yok: işletme askıya alma, kategori yönetimi, destek talepleri şimdilik veritabanından
3. Production altyapısı: barındırma, alan adı + HTTPS, SMTP, EAS projectId (push bildirimleri için)
4. Gerçek içerik: KVKK metni (PrivacyScreen) ve mesafeli satış sözleşmesi hukukçu onayından geçmeli;
   destek telefonu/WhatsApp/e-posta/sosyal medya `.env` → `EXPO_PUBLIC_SUPPORT_*` ile girilmeli (boşsa gösterilmez)
5. Görsel yükleme yerel diskte (`backend/uploads`); production'da S3 uyumlu depolamaya taşınmalı
6. Panel alan adı (`isletme.mykuafor.app`) index.html, robots.txt ve sitemap.xml'de yer tutucu
