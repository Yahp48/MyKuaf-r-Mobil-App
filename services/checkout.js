import * as WebBrowser from "expo-web-browser";
import { APP_SCHEME } from "../config";
import { paymentApi } from "./api";

/**
 * Ödeme sağlayıcısının güvenli sayfasını uygulama içi tarayıcıda açar.
 * Kart bilgisi uygulamaya hiç girmez. Sayfa kapanınca sonuç sunucudan sorgulanır
 * (yönlendirme URL'sindeki bilgiye güvenilmez).
 * @returns {Promise<"SUCCEEDED"|"FAILED"|"PENDING"|"REFUNDED">}
 */
export async function openCheckout(checkoutUrl, paymentId) {
  await WebBrowser.openAuthSessionAsync(checkoutUrl, `${APP_SCHEME}://payment-result`);
  const { payment } = await paymentApi.status(paymentId);
  return payment.status;
}
