# MyKuaför Backend

MyKuaför mobil uygulamasının REST API ve gerçek zamanlı (Socket.IO) sunucusu.

| Katman | Teknoloji |
| --- | --- |
| Çalışma ortamı | Node.js 22+ (TypeScript, ESM) |
| HTTP | Express 5, helmet, express-rate-limit, pino |
| Veritabanı | PostgreSQL 17 + Prisma ORM 7 |
| Doğrulama | Zod 4 |
| Kimlik | JWT erişim token'ı (15 dk) + döndürülen yenileme token'ı (30 gün), Argon2id şifre özeti (@node-rs/argon2) |
| Bildirim | Uygulama içi + Expo Push + Socket.IO |
| Test | Vitest + Supertest (gerçek PostgreSQL test veritabanı) |

## Yerel kurulum

```powershell
cd backend
copy .env.example .env        # JWT anahtarlarını doldur
docker compose up -d          # PostgreSQL (geliştirme + test veritabanı)
npm install
npm run db:deploy             # migration'ları uygula
npm run db:seed               # örnek salon, hizmet, ürün ve demo hesabı
npm run dev                   # http://localhost:5000/api
```

Demo hesabı (yalnızca yerel seed): `demo@mykuafor.test` / `Demo12345`

Android emülatörden sunucuya `http://10.0.2.2:5000/api`, gerçek telefondan bilgisayarın yerel IP'si ile erişilir.

## Komutlar

| Komut | Açıklama |
| --- | --- |
| `npm run dev` | İzleme modunda geliştirme sunucusu |
| `npm test` | Tüm testler (mykuafor_test veritabanında). Windows'ta test aracı nadiren (~%10) yerel bir hatayla çökebilir; testi yeniden çalıştırın, uygulamayı etkilemez. |
| `npm run typecheck` | TypeScript tip kontrolü |
| `npm run build` / `npm start` | Production derlemesi ve çalıştırma |
| `npm run db:migrate` | Şema değişikliğinden yeni migration üret |
| `npm run db:studio` | Veritabanı görsel arayüzü |

## API özeti

Tüm yanıtlar JSON. Hatalar her zaman `{ "error": { "code", "message", "details?" } }` biçimindedir.
Para tutarları API'de TL (ör. `149.99`), veritabanında kuruş (tam sayı) olarak tutulur.

| Uç | Açıklama |
| --- | --- |
| `POST /api/auth/register` · `login` · `refresh` · `logout` | Hesap ve oturum |
| `POST /api/auth/forgot-password` · `reset-password` | E-postayla 6 haneli kodla sıfırlama |
| `GET/PATCH/DELETE /api/users/me` | Profil, hesap silme (mağaza zorunluluğu) |
| `POST /api/users/me/change-password` · `/me/addresses` | Şifre ve teslimat adresleri |
| `GET /api/salons` (`?lat&lng` ile mesafeye göre) · `/:id` · `/:id/availability` · `/:id/reviews` | Salonlar |
| `POST /api/appointments` · `GET /` · `POST /:id/cancel` | Randevular |
| `GET /api/products` · `/categories` · `/:id` · `/:id/related` · `/:id/reviews` | Mağaza |
| `GET/DELETE /api/cart` · `POST /items` · `PUT/DELETE /items/:productId` · `POST /merge` | Sepet |
| `POST /api/orders` · `GET /` · `GET /:id` · `POST /:id/cancel` | Siparişler |
| `GET /api/wallet` · `POST /api/wallet/topups` | Cüzdan |
| `GET /api/payments/:id` | Ödeme sonucu |
| `GET /api/favorites` · `PUT/DELETE /products/:id` · `/salons/:id` | Favoriler |
| `GET /api/notifications` · `POST /:id/read` · `read-all` · `PUT /push-token` | Bildirimler |
| `POST/GET /api/support/tickets` | Destek, geri bildirim, hata bildirimi |
| `GET /api/maps/directions` | Yol tarifi (Google anahtarı sunucuda kalır) |
| `GET /api/health` | Sağlık kontrolü |

Socket.IO: `auth: { token: <accessToken> }` ile bağlanılır. Olaylar: `notification:new`, `appointment:updated`, `payment:updated`.

## Güvenlik ve iş kuralları

- **Fiyatlar sunucuda hesaplanır.** İstemciden tutar alınmaz; sipariş sepetten, randevu hizmetlerden fiyatlanır.
- **Çift rezervasyon imkânsız:** aynı personele çakışan aktif randevu PostgreSQL exclusion constraint ile engellenir (eşzamanlı isteklerde bile).
- **Stok yarışı yok:** stok koşullu güncellemeyle sipariş anında ayrılır; ödeme başarısız olur veya 30 dk içinde tamamlanmazsa geri bırakılır.
- **Kart bilgisi bize hiç gelmez:** ödeme sağlayıcısının güvenli sayfası (3D Secure) kullanılır, PCI-DSS kapsamı dışında kalınır.
- **Yenileme token'ı döndürme ve yeniden kullanım tespiti:** çalınan token kullanılırsa o oturum ailesi tamamen iptal edilir.
- **Hesap silme (App Store 5.1.1(v), Google Play, KVKK):** kişisel veriler silinir/anonimleştirilir; yasal saklama gereken sipariş kayıtları kişiden ayrılarak korunur.
- Giriş/kayıt uçlarında hız sınırı, loglarda şifre/token maskelenir, production'da sahte ödeme sağlayıcısı ve SMTP'siz çalışma env doğrulamasıyla engellenir.

## Production'a çıkmadan önce yapılacaklar

1. **iyzico entegrasyonu:** üye işyeri hesabı ve API anahtarları gerekli (`src/modules/payments/providers.ts` → `IyzicoProvider`).
2. Yönetim paneli (salon, personel, hizmet, ürün, sipariş durumu yönetimi) — şu an veriler seed ile giriliyor.
3. SMTP sağlayıcısı (ör. Amazon SES, Postmark) ve alan adı.
4. Barındırma: Docker imajı (`Dockerfile`) + yönetilen PostgreSQL; dağıtımda `npx prisma migrate deploy`.
