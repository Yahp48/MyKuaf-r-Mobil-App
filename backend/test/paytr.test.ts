import { createHmac } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { registerUser, resetDb } from "./helpers.ts";
import { prisma } from "../src/lib/prisma.ts";
import { PaytrProvider, paytrOid, verifyPaytrHash, type PaytrConfig } from "../src/modules/payments/providers.ts";
import { handlePaytrNotification } from "../src/modules/payments/service.ts";

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

const cfg: PaytrConfig = {
  merchantId: "123456",
  merchantKey: "TESTKEY0123456789",
  merchantSalt: "TESTSALT987654",
  testMode: true,
  publicBaseUrl: "https://api.example.test",
  devPublicIp: "85.105.1.2",
};
const sign = (s: string) => createHmac("sha256", cfg.merchantKey).update(s).digest("base64");

/** PayTR'ı taklit eden fetch: gönderilen formu kaydeder, verilen yanıtı döner. */
function fakePaytr(reply: Record<string, unknown>) {
  const calls: { url: string; form: URLSearchParams }[] = [];
  const http = (async (url: string, init: RequestInit) => {
    calls.push({ url, form: new URLSearchParams(init.body as string) });
    return new Response(JSON.stringify(reply));
  }) as unknown as typeof fetch;
  return { calls, http };
}

const PAYMENT_ID = "0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b";

describe("PayTR iFrame API", () => {
  it("get-token isteğini belgedeki sırayla imzalar; yerel IP yerine dış IP gönderir", async () => {
    const { calls, http } = fakePaytr({ status: "success", token: "iframe-token-1" });
    const p = new PaytrProvider(cfg, http);
    const s = await p.createCheckout({
      paymentId: PAYMENT_ID,
      amountCents: 12_990,
      description: "BiBakım sipariş ödemesi",
      buyer: { id: "u1", name: "Ayşe Yılmaz", email: "ayse@example.com", phone: "05551234567" },
      buyerIp: "192.168.0.6",
      items: [
        { name: "Şampuan", unitPriceCents: 9_990, quantity: 1 },
        { name: "Kargo", unitPriceCents: 3_000, quantity: 1 },
      ],
      allowInstallments: true,
      registerCard: false,
    });
    expect(calls[0]!.url).toBe("https://www.paytr.com/odeme/api/get-token");
    const f = calls[0]!.form;
    expect(f.get("merchant_oid")).toBe(paytrOid(PAYMENT_ID));
    expect(f.get("merchant_oid")).toMatch(/^[a-z0-9]+$/);
    expect(f.get("user_ip")).toBe("85.105.1.2");
    expect(f.get("payment_amount")).toBe("12990");
    expect(f.get("test_mode")).toBe("1");
    expect(f.get("no_installment")).toBe("0");
    expect(JSON.parse(Buffer.from(f.get("user_basket")!, "base64").toString())).toEqual([
      ["Şampuan", "99.90", 1],
      ["Kargo", "30.00", 1],
    ]);
    const expected = sign(
      cfg.merchantId + "85.105.1.2" + f.get("merchant_oid") + "ayse@example.com" + "12990" + f.get("user_basket") + "0" + "0" + "TL" + "1" + cfg.merchantSalt,
    );
    expect(f.get("paytr_token")).toBe(expected);
    expect(f.get("merchant_ok_url")).toBe(`https://api.example.test/api/payments/paytr/return/${PAYMENT_ID}`);
    expect(s).toEqual({
      providerRef: paytrOid(PAYMENT_ID),
      checkoutToken: "iframe-token-1",
      checkoutUrl: `https://api.example.test/api/payments/paytr/checkout/${PAYMENT_ID}`,
    });
    expect(p.supportsSavedCards).toBe(false);
  });

  it("PayTR reddederse anlaşılır hata verir", async () => {
    const { http } = fakePaytr({ status: "failed", reason: "Zorunlu alan degeri gecersiz: user_phone" });
    const p = new PaytrProvider(cfg, http);
    await expect(
      p.createCheckout({
        paymentId: PAYMENT_ID,
        amountCents: 100,
        description: "x",
        buyer: { id: "u", name: "A", email: "a@example.com", phone: null },
        buyerIp: "85.1.1.1",
        allowInstallments: false,
        registerCard: false,
      }),
    ).rejects.toMatchObject({ code: "PAYMENT_PROVIDER_ERROR", message: expect.stringContaining("cep telefonu") });
  });

  it("iade ve durum sorgusu belgedeki imzayla gider", async () => {
    const ok = fakePaytr({ status: "success" });
    const p = new PaytrProvider(cfg, ok.http);
    await p.refund({ providerRef: "abc123", amountCents: 1_197 });
    const f = ok.calls[0]!.form;
    expect(ok.calls[0]!.url).toBe("https://www.paytr.com/odeme/iade");
    expect(f.get("return_amount")).toBe("11.97");
    expect(f.get("paytr_token")).toBe(sign(cfg.merchantId + "abc123" + "11.97" + cfg.merchantSalt));

    expect(await p.queryStatus("abc123")).toBe("SUCCEEDED");
    expect(ok.calls[1]!.form.get("paytr_token")).toBe(sign(cfg.merchantId + "abc123" + cfg.merchantSalt));

    const bad = fakePaytr({ status: "error", err_no: "006", err_msg: "Toplam iade tutari odeme tutarindan fazla olamaz" });
    await expect(new PaytrProvider(cfg, bad.http).refund({ providerRef: "abc123", amountCents: 1 })).rejects.toMatchObject({
      code: "REFUND_FAILED",
    });
  });
});

describe("PayTR ödeme bildirimi", () => {
  async function pendingTopup(amountCents = 10_000) {
    const u = await registerUser();
    const payment = await prisma.payment.create({
      data: { userId: u.user.id, purpose: "WALLET_TOPUP", amountCents, provider: "PAYTR" },
    });
    const oid = paytrOid(payment.id);
    await prisma.payment.update({ where: { id: payment.id }, data: { providerRef: oid } });
    return { u, payment, oid };
  }
  const note = (oid: string, status: string, total: string, extra: Record<string, string> = {}) => ({
    merchant_oid: oid,
    status,
    total_amount: total,
    hash: sign(oid + cfg.merchantSalt + status + total),
    ...extra,
  });

  it("hash'i doğrulanmayan bildirim hiçbir şey değiştirmez", async () => {
    const { payment, oid } = await pendingTopup();
    const forged = { ...note(oid, "success", "10000"), hash: "sahte" };
    expect(verifyPaytrHash(cfg, forged)).toBe(false);
    expect(await handlePaytrNotification(cfg, forged)).toBe("BAD_HASH");
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("PENDING");
  });

  it("başarılı bildirim cüzdana yükler; tekrar gelen bildirim ikinci kez yüklemez", async () => {
    const { u, payment, oid } = await pendingTopup(10_000);
    const n = note(oid, "success", "10000", { payment_amount: "10000" });
    expect(await handlePaytrNotification(cfg, n)).toBe("OK");
    expect(await handlePaytrNotification(cfg, n)).toBe("OK");
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("SUCCEEDED");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.user.id } })).walletBalanceCents).toBe(10_000);
  });

  it("başarısız bildirim ödemeyi sebebiyle kapatır; eksik tutar kabul edilmez", async () => {
    const a = await pendingTopup();
    await handlePaytrNotification(cfg, note(a.oid, "failed", "10000", { failed_reason_msg: "Yetersiz bakiye" }));
    expect(await prisma.payment.findUniqueOrThrow({ where: { id: a.payment.id } })).toMatchObject({
      status: "FAILED",
      failureReason: "Yetersiz bakiye",
    });

    const b = await pendingTopup(10_000);
    await handlePaytrNotification(cfg, note(b.oid, "success", "100", { payment_amount: "100" }));
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: b.payment.id } })).status).toBe("FAILED");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: b.u.user.id } })).walletBalanceCents).toBe(0);
  });
});
