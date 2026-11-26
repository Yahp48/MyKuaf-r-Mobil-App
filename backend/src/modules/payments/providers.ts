import { env } from "../../config/env.ts";
import { randomToken } from "../../lib/codes.ts";
import { AppError } from "../../lib/errors.ts";

/**
 * Ödeme sağlayıcısı soyutlaması. Kart bilgisi hiçbir zaman uygulamamıza veya sunucumuza gelmez:
 * kullanıcı sağlayıcının güvenli ödeme sayfasında (3D Secure dahil) ödemeyi yapar (PCI-DSS kapsamı dışı kalırız).
 */
export interface CheckoutSession {
  providerRef: string;
  checkoutUrl: string;
}

export interface PaymentProviderAdapter {
  readonly name: "MOCK" | "IYZICO";
  createCheckout(input: {
    paymentId: string;
    amountCents: number;
    description: string;
    buyer: { id: string; name: string; email: string; phone: string | null };
  }): Promise<CheckoutSession>;
  refund(input: { providerRef: string; amountCents: number }): Promise<void>;
}

/** Yalnızca geliştirme/test: gerçek para hareketi olmadan ödeme akışını uçtan uca çalıştırır. */
class MockProvider implements PaymentProviderAdapter {
  readonly name = "MOCK" as const;

  async createCheckout(): Promise<CheckoutSession> {
    const providerRef = `mock_${randomToken(18)}`;
    return { providerRef, checkoutUrl: `${env.PUBLIC_BASE_URL}/api/payments/mock/checkout/${providerRef}` };
  }

  async refund(): Promise<void> {}
}

/**
 * iyzico Checkout Form entegrasyonu. Üye işyeri hesabı ve API anahtarları gerektiği için
 * henüz etkin değil; env doğrulaması production'da mock'a izin vermediğinden yanlışlıkla canlıya çıkamaz.
 */
class IyzicoProvider implements PaymentProviderAdapter {
  readonly name = "IYZICO" as const;

  async createCheckout(): Promise<CheckoutSession> {
    throw new AppError(503, "PAYMENT_PROVIDER_NOT_CONFIGURED", "Kartla ödeme şu anda kullanılamıyor");
  }

  async refund(): Promise<void> {
    throw new AppError(503, "PAYMENT_PROVIDER_NOT_CONFIGURED", "İade işlemi şu anda yapılamıyor");
  }
}

let provider: PaymentProviderAdapter | undefined;

export function paymentProvider(): PaymentProviderAdapter {
  provider ??= env.PAYMENT_PROVIDER === "iyzico" ? new IyzicoProvider() : new MockProvider();
  return provider;
}
