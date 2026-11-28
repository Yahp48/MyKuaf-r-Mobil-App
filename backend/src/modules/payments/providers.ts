import { createHmac, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import { env } from "../../config/env.ts";
import { randomToken } from "../../lib/codes.ts";
import { AppError } from "../../lib/errors.ts";
import { logger } from "../../lib/logger.ts";

/**
 * Ödeme sağlayıcısı soyutlaması. Kart bilgisi hiçbir zaman uygulamamıza veya sunucumuza gelmez:
 * kullanıcı sağlayıcının güvenli ödeme sayfasında (3D Secure dahil) ödemeyi yapar (PCI-DSS kapsamı dışı kalırız).
 */
export interface CheckoutSession {
  providerRef: string;
  checkoutUrl: string;
  /** Sağlayıcının ödeme sayfası anahtarı (PayTR iframe token'ı); kendi barındırdığımız sayfada kullanılır. */
  checkoutToken?: string;
}

/** Sağlayıcının sakladığı kartın bize dönen bilgileri (numara yok; yalnızca anahtarlar ve son 4 hane). */
export interface StoredCardInfo {
  cardUserKey: string;
  cardToken: string;
  last4: string;
  association: string | null;
  bankName: string | null;
}

export interface CheckoutInput {
  paymentId: string;
  amountCents: number;
  description: string;
  buyer: { id: string; name: string; email: string; phone: string | null };
  /** Müşterinin IP adresi (PayTR zorunlu tutar; dolandırıcılık denetimi için). */
  buyerIp: string | null;
  /** Sepet satırları; yoksa tek satır (açıklama) gönderilir. */
  items?: { name: string; unitPriceCents: number; quantity: number }[];
  /** Taksit seçenekleri gösterilsin mi (yalnızca ürün siparişlerinde). */
  allowInstallments: boolean;
  /** Kayıtlı kartla ödeme: sağlayıcı sayfası bu kartla açılır (3D Secure yine yapılır). */
  savedCard?: { cardUserKey: string; cardToken: string };
  /** Kullanıcı kartını kaydetmek istedi: sağlayıcı kartı saklar ve anahtarını döner. */
  registerCard: boolean;
}

export interface PaymentProviderAdapter {
  readonly name: "MOCK" | "IYZICO" | "PAYTR";
  /** Kart saklama destekleniyor mu (desteklenmiyorsa uygulamada "Kayıtlı kartlarım" gizlenir). */
  readonly supportsSavedCards: boolean;
  createCheckout(input: CheckoutInput): Promise<CheckoutSession>;
  refund(input: { providerRef: string; amountCents: number }): Promise<void>;
  deleteCard(input: { cardUserKey: string; cardToken: string }): Promise<void>;
  /** Sağlayıcıya ödemenin son durumunu sorar (bildirim gelmediyse eşitlemek için). */
  queryStatus?(providerRef: string): Promise<"SUCCEEDED" | "UNKNOWN">;
}

/** Yalnızca geliştirme/test: gerçek para hareketi olmadan ödeme akışını uçtan uca çalıştırır. */
class MockProvider implements PaymentProviderAdapter {
  readonly name = "MOCK" as const;
  readonly supportsSavedCards = true;

  async createCheckout(): Promise<CheckoutSession> {
    const providerRef = `mock_${randomToken(18)}`;
    return { providerRef, checkoutUrl: `${env.PUBLIC_BASE_URL}/api/payments/mock/checkout/${providerRef}` };
  }

  async refund(): Promise<void> {}

  async deleteCard(): Promise<void> {}
}

/**
 * iyzico Checkout Form entegrasyonu. Üye işyeri hesabı ve API anahtarları gerektiği için
 * henüz etkin değil; env doğrulaması production'da mock'a izin vermediğinden yanlışlıkla canlıya çıkamaz.
 */
class IyzicoProvider implements PaymentProviderAdapter {
  readonly name = "IYZICO" as const;
  readonly supportsSavedCards = true;

  async createCheckout(): Promise<CheckoutSession> {
    throw new AppError(503, "PAYMENT_PROVIDER_NOT_CONFIGURED", "Kartla ödeme şu anda kullanılamıyor");
  }

  async refund(): Promise<void> {
    throw new AppError(503, "PAYMENT_PROVIDER_NOT_CONFIGURED", "İade işlemi şu anda yapılamıyor");
  }

  async deleteCard(): Promise<void> {
    throw new AppError(503, "PAYMENT_PROVIDER_NOT_CONFIGURED", "Kart işlemi şu anda yapılamıyor");
  }
}

// ───────────────────────────── PayTR ─────────────────────────────

export interface PaytrConfig {
  merchantId: string;
  merchantKey: string;
  merchantSalt: string;
  testMode: boolean;
  /** Sunucumuzun herkese açık adresi (ödeme sayfası ve dönüş adresleri). */
  publicBaseUrl: string;
  /** Yerel denemede müşterinin IP'si özel ağdan gelir; PayTR dış IP ister. */
  devPublicIp?: string;
  apiBase?: string;
}

const hmacB64 = (key: string, data: string) => createHmac("sha256", key).update(data, "utf8").digest("base64");

/** PayTR sipariş numarası yalnızca harf/rakam kabul eder: UUID'nin tireleri atılır. */
export const paytrOid = (paymentId: string) => paymentId.replace(/-/g, "");

/** Özel/yerel ağ adresi mi (PayTR bunları kabul etmez). */
function isPrivateIp(ip: string) {
  const v = ip.replace(/^::ffff:/, "");
  return (
    /^(10\.|127\.|192\.168\.|169\.254\.)/.test(v) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(v) ||
    v === "::1" ||
    /^f[cd]/i.test(v) ||
    /^fe80:/i.test(v)
  );
}

/** PayTR bildirimindeki hash'i doğrular (sabit zamanlı karşılaştırma). */
export function verifyPaytrHash(
  cfg: Pick<PaytrConfig, "merchantKey" | "merchantSalt">,
  body: { merchant_oid?: string; status?: string; total_amount?: string; hash?: string },
) {
  if (!body.merchant_oid || !body.status || !body.total_amount || !body.hash) return false;
  const expected = Buffer.from(hmacB64(cfg.merchantKey, body.merchant_oid + cfg.merchantSalt + body.status + body.total_amount));
  const given = Buffer.from(body.hash);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/**
 * PayTR iFrame API (https://dev.paytr.com/iframe-api). Akış:
 * 1) Sunucu get-token ile iframe anahtarı alır; müşteri bizim barındırdığımız sayfada PayTR iframe'inde öder.
 * 2) Kesin sonuç PayTR'ın "Bildirim URL"sine (POST /api/payments/paytr/callback) hash'li gelir.
 * Bildirim ulaşamadıysa (ör. yerel deneme) durum-sorgu ile eşitlenir. Test modunda gerçek para çekilmez.
 * iFrame API kart saklamayı desteklemediği için "kayıtlı kart" özelliği bu sağlayıcıda kapalıdır.
 */
export class PaytrProvider implements PaymentProviderAdapter {
  readonly name = "PAYTR" as const;
  readonly supportsSavedCards = false;
  private readonly api: string;

  constructor(
    private readonly cfg: PaytrConfig,
    private readonly http: typeof fetch = fetch,
  ) {
    this.api = cfg.apiBase ?? "https://www.paytr.com";
  }

  private async post(path: string, form: Record<string, string>) {
    const res = await this.http(`${this.api}${path}`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(form).toString(),
      signal: AbortSignal.timeout(20_000),
    });
    const text = await res.text();
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new AppError(502, "PAYMENT_PROVIDER_ERROR", "Ödeme kuruluşundan geçersiz yanıt alındı");
    }
  }

  async createCheckout(input: CheckoutInput): Promise<CheckoutSession> {
    const c = this.cfg;
    const oid = paytrOid(input.paymentId);
    let ip = input.buyerIp?.replace(/^::ffff:/, "") ?? "";
    if ((!ip || !isIP(ip) || isPrivateIp(ip)) && c.devPublicIp) ip = c.devPublicIp;
    const lines = input.items?.length
      ? input.items
      : [{ name: input.description, unitPriceCents: input.amountCents, quantity: 1 }];
    const basket = Buffer.from(
      JSON.stringify(lines.map((l) => [l.name.slice(0, 100), (l.unitPriceCents / 100).toFixed(2), l.quantity])),
    ).toString("base64");
    const amount = String(input.amountCents);
    const noInstallment = input.allowInstallments ? "0" : "1";
    const maxInstallment = "0";
    const currency = "TL";
    const testMode = c.testMode ? "1" : "0";
    const token = hmacB64(
      c.merchantKey,
      c.merchantId + ip + oid + input.buyer.email + amount + basket + noInstallment + maxInstallment + currency + testMode + c.merchantSalt,
    );
    const back = `${c.publicBaseUrl}/api/payments/paytr/return/${input.paymentId}`;
    const r = await this.post("/odeme/api/get-token", {
      merchant_id: c.merchantId,
      user_ip: ip,
      merchant_oid: oid,
      email: input.buyer.email,
      payment_amount: amount,
      paytr_token: token,
      user_basket: basket,
      debug_on: c.testMode ? "1" : "0",
      no_installment: noInstallment,
      max_installment: maxInstallment,
      user_name: input.buyer.name.slice(0, 60),
      user_address: "Türkiye",
      user_phone: (input.buyer.phone ?? "").slice(0, 20),
      merchant_ok_url: back,
      merchant_fail_url: `${back}?sonuc=hata`,
      timeout_limit: "30",
      currency,
      test_mode: testMode,
      lang: "tr",
    });
    if (r.status !== "success" || typeof r.token !== "string") {
      logger.warn({ reason: r.reason, paymentId: input.paymentId }, "PayTR get-token reddetti");
      const reason = typeof r.reason === "string" ? r.reason : "";
      throw new AppError(
        502,
        "PAYMENT_PROVIDER_ERROR",
        /user_phone/i.test(reason)
          ? "Kartla ödeme için profilinize cep telefonu ekleyin"
          : "Ödeme başlatılamadı, lütfen biraz sonra tekrar deneyin",
      );
    }
    return {
      providerRef: oid,
      checkoutToken: r.token,
      checkoutUrl: `${c.publicBaseUrl}/api/payments/paytr/checkout/${input.paymentId}`,
    };
  }

  async refund({ providerRef, amountCents }: { providerRef: string; amountCents: number }) {
    const c = this.cfg;
    const amount = (amountCents / 100).toFixed(2);
    const r = await this.post("/odeme/iade", {
      merchant_id: c.merchantId,
      merchant_oid: providerRef,
      return_amount: amount,
      paytr_token: hmacB64(c.merchantKey, c.merchantId + providerRef + amount + c.merchantSalt),
    });
    if (r.status !== "success") {
      logger.error({ err_no: r.err_no, err_msg: r.err_msg, providerRef }, "PayTR iadesi başarısız");
      throw new AppError(502, "REFUND_FAILED", "İade ödeme kuruluşunda yapılamadı; destek ekibimiz ilgileniyor");
    }
  }

  async deleteCard(): Promise<void> {}

  async queryStatus(providerRef: string): Promise<"SUCCEEDED" | "UNKNOWN"> {
    const c = this.cfg;
    const r = await this.post("/odeme/durum-sorgu", {
      merchant_id: c.merchantId,
      merchant_oid: providerRef,
      paytr_token: hmacB64(c.merchantKey, c.merchantId + providerRef + c.merchantSalt),
    }).catch(() => ({ status: "error" }) as Record<string, unknown>);
    return r.status === "success" ? "SUCCEEDED" : "UNKNOWN";
  }
}

export const paytrConfig = (): PaytrConfig => ({
  merchantId: env.PAYTR_MERCHANT_ID,
  merchantKey: env.PAYTR_MERCHANT_KEY,
  merchantSalt: env.PAYTR_MERCHANT_SALT,
  testMode: env.PAYTR_TEST_MODE,
  publicBaseUrl: env.PUBLIC_BASE_URL,
  devPublicIp: env.PAYTR_DEV_PUBLIC_IP || undefined,
});

let provider: PaymentProviderAdapter | undefined;

export function paymentProvider(): PaymentProviderAdapter {
  provider ??=
    env.PAYMENT_PROVIDER === "paytr"
      ? new PaytrProvider(paytrConfig())
      : env.PAYMENT_PROVIDER === "iyzico"
        ? new IyzicoProvider()
        : new MockProvider();
  return provider;
}
