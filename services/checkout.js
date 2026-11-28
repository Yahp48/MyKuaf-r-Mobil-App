import * as Linking from "expo-linking";
import { paymentApi } from "./api";
import { presentPayment } from "../components/PaymentSheet";

/**
 * Ödeme sayfası bitince dönülecek adres. Geliştirme derlemesinde/mağaza sürümünde "bibakim://",
 * Expo Go'da "exp://..." olur; sunucu yalnızca bu iki biçimi kabul eder.
 */
export const paymentReturnUrl = () => Linking.createURL("payment-result");

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Ödeme kuruluşunun güvenli sayfasını uygulama içi ödeme penceresinde açar (components/PaymentSheet.js).
 * Kart bilgisi uygulamaya hiç girmez. Pencere kapanınca sonuç sunucudan sorgulanır
 * (yönlendirme URL'sindeki bilgiye güvenilmez). Sayfadan dönüldüyse ama sağlayıcının bildirimi
 * henüz gelmediyse birkaç saniye daha beklenir.
 * @returns {Promise<"SUCCEEDED"|"FAILED"|"PENDING"|"REFUNDED">}
 */
export async function openCheckout(checkoutUrl, paymentId) {
  const how = await presentPayment(checkoutUrl, paymentReturnUrl());
  let { payment } = await paymentApi.status(paymentId);
  for (let i = 0; how === "returned" && payment.status === "PENDING" && i < 4; i++) {
    await wait(1500);
    ({ payment } = await paymentApi.status(paymentId));
  }
  return payment.status;
}
