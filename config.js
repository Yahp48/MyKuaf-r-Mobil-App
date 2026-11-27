import Constants from "expo-constants";
import { Platform } from "react-native";

/**
 * Tek API adresi. Öncelik sırası:
 * 1. .env → EXPO_PUBLIC_API_URL (production derlemesinde ZORUNLU, https olmalı)
 * 2. Geliştirmede: Expo sunucusunu çalıştıran bilgisayarın IP'si (gerçek telefon aynı ağdaysa çalışır)
 * 3. Android emülatör → 10.0.2.2, iOS simülatör → localhost
 */
function resolveApiUrl() {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, "");

  if (!__DEV__) {
    throw new Error("EXPO_PUBLIC_API_URL tanımlı değil: production derlemesi için .env/EAS ortam değişkenine ekleyin.");
  }

  const devHost = Constants.expoConfig?.hostUri?.split(":")[0];
  const host = devHost && devHost !== "localhost" ? devHost : Platform.OS === "android" ? "10.0.2.2" : "localhost";
  return `http://${host}:5000/api`;
}

export const API_URL = resolveApiUrl();
export const SOCKET_URL = API_URL.replace(/\/api$/, "");
export const APP_SCHEME = "mykuafor";
export const REQUEST_TIMEOUT_MS = 15000;

/**
 * İletişim bilgileri (.env → EXPO_PUBLIC_*). Girilmeyen bilgi uygulamada hiç gösterilmez;
 * böylece yer tutucu numara/adres yayına çıkamaz.
 */
const clean = (v) => (v && v.trim() ? v.trim() : null);
export const CONTACT = {
  phone: clean(process.env.EXPO_PUBLIC_SUPPORT_PHONE),
  whatsapp: clean(process.env.EXPO_PUBLIC_SUPPORT_WHATSAPP),
  email: clean(process.env.EXPO_PUBLIC_SUPPORT_EMAIL),
  hours: clean(process.env.EXPO_PUBLIC_SUPPORT_HOURS),
  website: clean(process.env.EXPO_PUBLIC_WEBSITE_URL),
  instagram: clean(process.env.EXPO_PUBLIC_INSTAGRAM_URL),
};

/** İşletme paneli adresi (rehberdeki salonunu sahiplenmek isteyenler için). Boşsa bağlantı gösterilmez. */
export const BUSINESS_PANEL_URL = clean(process.env.EXPO_PUBLIC_BUSINESS_PANEL_URL);
