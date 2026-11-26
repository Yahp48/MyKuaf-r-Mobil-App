# MyKuaför Mobil Uygulaması

Kuaför/güzellik salonu müşterileri için mobil uygulama: randevu alma, salon ürünleri mağazası,
sepet ve ödeme, cüzdan/bakiye yükleme, bildirimler, harita üzerinden salona yol tarifi.
Arayüz dili Türkçe. Uygulama içi marka adı şu an "womanhair" (AboutScreen).

## Teknoloji
- Expo SDK 54, React Native 0.81.4, React 19.1, New Architecture açık (`app.json` → `newArchEnabled`)
- Saf JavaScript (TypeScript yok), Android klasörü prebuild edilmiş (`android/`, paket `com.yaho.kuafor_mobil`)
- Navigasyon: `@react-navigation/stack` (tek stack, `App.js`)
- Global durum: `context/AppContext.js` (useReducer + Context)
- Harita: `react-native-maps` + `expo-location` + `@mapbox/polyline` (HomeScreen, Google Directions API)
- Gerçek zamanlı: `socket.io-client` (`services/socketService.js`)
- Bildirim: `expo-notifications` (`services/notificationService.js`)
- Ortam değişkenleri: `react-native-dotenv`, `import { X } from "@env"` — değerler `.env` dosyasında (`.env.example`'a bak)

## Komutlar
- `npm install` — bağımlılıklar
- `npx expo start` — geliştirme sunucusu (Expo Go veya dev build)
- `npm run android` — `expo run:android` ile native build (Android Studio/SDK gerekir)
- `npx expo export --platform android` — derleme kontrolü (hızlı "bundle oluşuyor mu" testi)
- Test ve lint kurulu değil.

## Klasör yapısı
- `App.js` — tüm ekranların kaydı, başlangıç ekranı `Home`
- `screens/` — 30 ekran (randevu, mağaza, sepet, ödeme, cüzdan, profil, destek...)
- `services/apiService.js` — merkezi API istemcisi (token, kuyruk, timeout, mock veriler içerir)
- `services/paymentService.js`, `socketService.js`, `notificationService.js`
- `context/AppContext.js` — kullanıcı, sepet, favoriler vb. global durum
- `fix-catch-blocks.js` — tek seferlik yardımcı betik (`catch {` → `catch (e) {`), uygulamanın parçası değil

## Backend
Backend bu repoda YOK. Uygulama `:5000` portunda çalışan bir Node/Express API bekliyor
(`/api/appointments`, `/api/orders`, `/api/users/...`). Android emülatörde `10.0.2.2:5000`,
iOS/web'de `localhost:5000`. Production adresi henüz yer tutucu (`your-production-api.com`).

## Bilinen sorunlar (öncelik sırasıyla)
1. **Dağınık API adresleri:** Bazı ekranlar `apiService` yerine doğrudan `fetch` ile farklı sabit LAN IP'lerine gidiyor:
   `SignInScreen` / `OrderScreen` (192.168.244.116), `SignUpScreen` (192.168.4.116),
   `AccountSettingsScreen` (192.168.73.116), `RandevuForm` (192.168.187.117),
   `PaymentVerificationScreen` (10.0.2.2). Hepsi `services/apiService.js` üzerinden, tek bir
   yapılandırılabilir adresle (`.env` → `API_URL`) çalışmalı.
2. **Giriş kapalı:** `App.js` içinde SignIn/SignUp ekranları yorum satırında; uygulama doğrudan Home ile açılıyor,
   `apiService.getUserId()` misafir ID üretiyor.
3. **Yer tutucular:** Stripe anahtarı (`pk_test_your_stripe_key_here`) ve backend URL'leri sahte;
   Stripe paketi kurulu ama hiçbir yerde import edilmiyor.
4. **Kullanılmayan bağımlılıklar:** `react-native-push-notification`, `react-native-datepicker` (terk edilmiş),
   `@react-native-community/checkbox`, `polyline`, `react-native-toast-message`, `@stripe/stripe-react-native`,
   `metro-react-native-babel-preset` (eski). Kaldırmadan önce tekrar grep ile kontrol et.
5. `babel.config.js` `react-native-worklets/plugin` kullanıyor ama paket `package.json`'da doğrudan yok
   (reanimated üzerinden geliyor) — `npx expo install react-native-worklets` ile açıkça eklenmeli.
6. Mock veriler `apiService.js`, `ShopScreen`, `FavoritesScreen`, `ShoppingCartScreen` içine gömülü.
7. Büyük dosyalar: `ShoppingCartScreen` (~1400 satır), `ShopScreen`, `ProductDetailScreen`, `apiService` —
   değişiklik yaparken bileşenlere bölmeyi düşün ama istenmeden toplu refactor yapma.
8. `package.json` adı hâlâ `newproje`.

## Kurallar
- `.env` asla commit edilmez (daha önce geçmişten temizlendi). Yeni anahtar → `.env.example`'a boş olarak ekle.
- Yeni paket eklerken `npx expo install <paket>` kullan (SDK 54 ile uyumlu sürümü seçer).
- Ekran metinleri Türkçe; kod içi isimler İngilizce (mevcut düzen böyle).
- Değişiklikten sonra en az `npx expo export --platform android` ile derlemenin bozulmadığını doğrula.
