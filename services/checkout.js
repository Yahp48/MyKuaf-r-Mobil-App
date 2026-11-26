import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { paymentApi } from "./api";

/**
 * Ödeme sayfası bitince dönülecek adres. Geliştirme derlemesinde/mağaza sürümünde "mykuafor://",
 * Expo Go'da "exp://..." olur; sunucu yalnızca bu iki biçimi kabul eder.
 */
export const paymentReturnUrl = () => Linking.createURL("payment-result");

/**
 * Ödeme sağlayıcısının güvenli sayfasını uygulama içi tarayıcıda açar.
 * Kart bilgisi uygulamaya hiç girmez. Sayfa kapanınca sonuç sunucudan sorgulanır
 * (yönlendirme URL'sindeki bilgiye güvenilmez).
 * @returns {Promise<"SUCCEEDED"|"FAILED"|"PENDING"|"REFUNDED">}
 */
export async function openCheckout(checkoutUrl, paymentId) {
  await WebBrowser.openAuthSessionAsync(checkoutUrl, paymentReturnUrl());
  const { payment } = await paymentApi.status(paymentId);
  return payment.status;
}
