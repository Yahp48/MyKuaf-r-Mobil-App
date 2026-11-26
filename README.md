# MyKuaför

Kuaför ve güzellik salonu müşterileri için mobil uygulama: haritada salon bulma ve yol tarifi,
online randevu, salon ürünleri mağazası, güvenli ödeme, cüzdan ve bildirimler.

| Klasör | İçerik |
| --- | --- |
| `/` | Expo (React Native) mobil uygulaması — Android ve iOS |
| `backend/` | Node.js + TypeScript REST API, PostgreSQL ([ayrıntılar](backend/README.md)) |

## Hızlı başlangıç

```powershell
# 1) Backend
cd backend
copy .env.example .env      # JWT anahtarlarını doldur
docker compose up -d
npm install
npm run db:deploy
npm run db:seed
npm run dev

# 2) Mobil (yeni terminalde, kök dizinde)
copy .env.example .env
npm install
npx expo start
```

Telefon ve bilgisayar aynı Wi-Fi ağındaysa uygulama backend'i otomatik bulur.
Demo hesabı: `demo@mykuafor.test` / `Demo12345`

> Haritalar ve ödeme dönüşü (`mykuafor://`) için Expo Go yerine geliştirme derlemesi önerilir:
> `npx expo run:android` veya EAS Build.
