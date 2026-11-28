# MyKuaför

Kuaför/güzellik salonu müşterileri için mobil uygulama + backend: harita üzerinden salon bulma ve
yol tarifi, randevu alma, salon ürünleri mağazası, sepet ve ödeme, cüzdan, bildirimler.
Arayüz dili Türkçe. Uygulama adı "MyKuaför", ekranlardaki salon markası "WOMAN HAIR DESIGN".
Hedef: Play Store ve App Store'da yayın — prototip değil, mağaza kurallarına uygun olmalı.

## Yapı
- Kök dizin: Expo mobil uygulaması (saf JavaScript) — müşteriler
- `backend/`: Node.js + TypeScript API (ayrıntılar `backend/README.md`)
- `dashboard/`: işletme paneli, React + Vite + TypeScript (ayrıntılar `dashboard/README.md`, tasarım `dashboard/DESIGN.md`)
- İki işletme türü: `SALON` (hizmet işletmesi) ve `SELLER` (ürün satıcısı). Hesap rolü `BUSINESS_OWNER`;
  işletme hesapları mobil uygulamaya, müşteri hesapları panele giremez
- Hizmet işletmesi alt türü `Salon.kind`: HAIR (kuaför), BEAUTY, NAIL, SKIN, MASSAGE (kadınlara özel spa), BROW_LASH, MAKEUP.
  Panel türe göre uyarlanır (`dashboard/src/lib/kinds.ts`); hazır hizmet kataloğu `backend/src/modules/catalog/services.ts`
  (tıbbi işlemler — dolgu, botoks — bilerek yok). Masaj işletmesi rehbere OSM'den alınmaz, yalnızca doğrulanmış kayıtla

## Mobil teknoloji
- Expo SDK 58, React Native 0.88, React 19.3 (Expo Go mağaza sürümü yalnızca güncel SDK'yı açar)
- Expo CNG: `android/` ve `ios/` git'te YOK; native ayarlar `app.config.js`'te (EAS Build / `npx expo prebuild`)
- Navigasyon: `@react-navigation/stack`. `App.js` oturuma göre `AuthStack` (giriş/kayıt) veya `MainStack` gösterir
- Global durum: `context/AppContext.js` → oturum, sunucudaki sepet, okunmamış bildirim sayısı
- Canlı bağlantı: `services/realtime.js` (Socket.IO). `salons:changed`, `catalog:changed`, `availability:changed`
  (boş saatler), `appointment:updated`, `order:updated`, `notification:new`, `payment:updated`; ekranlarda `useRealtimeEvent`.
  Sunucu odaları: `user:<id>`, `business:<id>` (randevu/sipariş/yorum, `business:updated`, `product:moderated`),
  `admins` (`admin:activity`). Panel: `dashboard/src/lib/realtime.ts` (TanStack Query anahtarlarını tazeler)
- Alt menü App kökünde tek (`PersistentBottomNav`, `components/BottomNav.js`); ekranlar yalnızca `<BottomNavSpacer />` koyar.
  Hangi ekranda görüneceği `ROUTE_TAB`'da
- Geri bildirim: `Alert.alert` KULLANILMAZ. `components/Feedback.js` → `toast.success/error/info` (kısa, akışı durdurmaz),
  `confirm({...})` yalnızca geri alınamaz işlemler için. Gereksiz "eklendi" mesajı yok (sepet rozeti zıplar)
- API: `services/api.js` tek istemci. Yenileme token'ı `expo-secure-store`'da, erişim token'ı bellekte; 401'de otomatik yenileme
- API adresi: `config.js` → `.env`'deki `EXPO_PUBLIC_API_URL`; geliştirmede boşsa Expo host IP'si:5000
- Ödeme: `services/checkout.js` sağlayıcının güvenli sayfasını uygulama içi pencerede açar (`components/PaymentSheet.js`,
  App kökünde `<PaymentHost />`; WebView, dönüş adresini yakalar), sonucu sunucudan sorgular.
  Uygulama kart bilgisi ASLA toplamaz (PCI-DSS)
- Ortak bileşenler: `components/` (AppHeader, BottomNav, DraggableSheet, SalonSheet, PhotoViewer, ProductCard, ContactList, ui.js, theme.js, useRemote.js)
- Canlı deneme (alt menüde "Dene", `screens/TryOnScreen.js`): WebView içinde MediaPipe Tasks Vision
  (`components/tryon/page.js`, sürüm sabit); yüz şekli, saç modeli (2B saç katmanı, 3 noktalı afin yerleşim,
  kendi saçı push-pull dolgu ile gizlenir), saç rengi, makyaj cihazda işlenir, görüntü sunucuya gitmez.
  Saç katmanları `assets/tryon/hair/` (Unsplash kaynaklı, CREDITS.md), katalog `components/tryon/catalog.js`
- Yapay zekâ ile gerçekçi deneme (`screens/AiTryOnScreen.js`, API `/api/tryon/ai`): fotoğraf açık rızayla
  AILabTools'a gider (TRYON_AI_PROVIDER + AILABTOOLS_API_KEY; boşsa özellik gizli), günlük sınır TRYON_AI_DAILY_LIMIT
- Uygulama yalnızca kadınlara yöneliktir: erkek/unisex içerik, salon türü veya seçenek eklenmez
- Salonlar: randevu alınabilen (işletme panelden yönetir) + rehber kaydı (`isListing`, gerçek İstanbul salonları,
  `backend/prisma/data/istanbul-salons.ts`, kaynak OpenStreetMap/ODbL — atıf zorunlu; fotoğraf/puan kopyalanmaz,
  saat bilinmiyorsa uydurulmaz). Randevu/müsaitlik yalnızca `bookableSalonWhere`
- Kayıtlı kart: kart ödeme kuruluşunda saklanır, bizde yalnızca anahtar + son 4 hane (`SavedCard`); kart ekleme 1 TL doğrulama + iade
- Yönetim paneli (`dashboard/src/pages/admin`, API `/api/admin` + `admin/center.ts`, rol ADMIN): canlı özet (bugün,
  30 gün, 14 günlük grafik), işletme doğrulama (vergi levhası `private-uploads/` içinde), askıya alma, rehber sahiplenme,
  müşteriler (askıya alma → giriş/yenileme kapanır), tüm randevu/sipariş/ödemeler, ürün denetimi (`blockedAt`,
  satıcı açamaz), kategoriler, destek yanıtı, yorum gizleme, işlem geçmişi (`AdminAction`, her değiştirici işlem
  `audit(res, …)` ile yazılır). Hatırlatma/bekleme listesi işleri `backend/src/modules/appointments/jobs.ts`, puan `modules/loyalty`
- Ürün rozetleri (`backend/src/modules/products/metrics.ts`) yalnızca gerçek satış/favori verisinden; mağaza logosunu satıcı kendisi yükler
- İndirim: hizmet başına yüzde + tarih aralığı; fiyat randevu gününe göre sunucuda hesaplanır (`backend/src/modules/salons/discount.ts`).
  Son 30 günde fiyatı artırılan hizmette indirim yok, indirim sürerken fiyat artırılamaz
- Şirket bilgisi (faturayı kesen taraf, Symmetry Group): backend `.env` → `COMPANY_*`, API `/api/meta/company`;
  uygulamada Hakkında + KVKK, panelde yasal sayfalar. Boşsa gösterilmez; production'da zorunlu
- iOS: `app.config.js` → `ios.privacyManifests` (izleme yok, konum cihazda kalır); iOS haritası Apple Maps
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
- `npm test` (82 test, `mykuafor_test` veritabanı), `npm run typecheck`
- Şema değişikliği: `prisma/schema.prisma` düzenle → `npm run db:migrate -- --name <ad>`
- Demo hesapları (yalnızca yerel seed, şifre `Demo12345`): müşteri `demo@mykuafor.test`,
  kuaför paneli `salon@mykuafor.test` ("MyKuaför Demo Salon", Kadıköy), satıcı paneli `satici@mykuafor.test`,
  yönetim paneli `admin@mykuafor.test` (/yonetim). Her işletme türü için örnek işletme ("Örnek …"):
  `guzellik@`, `tirnak@`, `cilt@`, `spa@`, `kirpik@`, `makyaj@` (hepsi `mykuafor.test`). Production'da yönetici: `npm run admin:create -- <e-posta> "<Ad>"`
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
3. Production altyapısı: barındırma, alan adı + HTTPS, SMTP, EAS projectId (push bildirimleri için)
4. Gerçek içerik: Symmetry Group'un tam ticari unvanı, adresi, VKN, MERSİS, KEP → `COMPANY_*`; KVKK metni (PrivacyScreen) ve mesafeli satış sözleşmesi hukukçu onayından geçmeli;
   destek telefonu/WhatsApp/e-posta/sosyal medya `.env` → `EXPO_PUBLIC_SUPPORT_*` ile girilmeli (boşsa gösterilmez)
5. Görsel yükleme yerel diskte (`backend/uploads`); production'da S3 uyumlu depolamaya taşınmalı
6. Panel alan adı (`isletme.mykuafor.app`) index.html, robots.txt ve sitemap.xml'de yer tutucu
