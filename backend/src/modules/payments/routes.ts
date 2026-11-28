import { Router, urlencoded } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.ts";
import { parse, zId } from "../../lib/validate.ts";
import { notFound } from "../../lib/errors.ts";
import { formatTL } from "../../lib/money.ts";
import { requireAuth, userId } from "../../middleware/auth.ts";
import { env } from "../../config/env.ts";
import { finalizeByProviderRef, handlePaytrNotification, PURPOSE_LABEL, reconcilePayment, serializePayment } from "./service.ts";
import { paytrConfig } from "./providers.ts";
import { randomBytes } from "node:crypto";
import { randomToken } from "../../lib/codes.ts";

/** Sahte sağlayıcının test kartları (iyzico'nun yayımladığı test kartlarının son haneleri). */
const MOCK_CARDS = {
  master: { association: "MASTER_CARD", bankName: "Halkbank", last4: "0008", label: "Mastercard •••• 0008" },
  visa: { association: "VISA", bankName: "Denizbank", last4: "0000", label: "Visa •••• 0000" },
  troy: { association: "TROY", bankName: "QNB", last4: "0796", label: "Troy •••• 0796" },
} as const;

export const paymentsRouter = Router();

/** Ödeme sayfası kapandıktan sonra uygulama sonucu buradan sorgular. */
paymentsRouter.get("/:id", requireAuth, async (req, res) => {
  const payment = await prisma.payment.findFirst({ where: { id: parse(zId, req.params.id), userId: userId(req) } });
  if (!payment) throw notFound("Ödeme bulunamadı");
  // Sağlayıcı bildirimi henüz gelmediyse durumu sağlayıcıdan eşitle.
  res.json({ payment: serializePayment(await reconcilePayment(payment)) });
});

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

// returnUrl kayıt sırasında zReturnUrl ile doğrulanmıştır (yalnızca uygulama şeması / geliştirmede exp://).
const appReturnUrl = (paymentId: string, returnUrl?: string | null) => {
  const base = returnUrl ?? `${env.APP_DEEP_LINK_SCHEME}://payment-result`;
  return `${base}${base.includes("?") ? "&" : "?"}paymentId=${encodeURIComponent(paymentId)}`;
};

// ───────────── Sahte sağlayıcı (yalnızca PAYMENT_PROVIDER=mock; production'da env doğrulaması engeller) ─────────────

if (env.PAYMENT_PROVIDER === "mock") {
  paymentsRouter.get("/mock/checkout/:ref", async (req, res) => {
    const ref = parse(z.string().regex(/^mock_[\w-]+$/), req.params.ref);
    const payment = await prisma.payment.findUnique({ where: { providerRef: ref }, include: { savedCard: true } });
    if (!payment) throw notFound("Ödeme bulunamadı");
    const pending = payment.status === "PENDING";
    const cardPicker = payment.savedCard
      ? `<p class="card">Kayıtlı kart: <b>${escapeHtml(payment.savedCard.alias)}</b></p>`
      : `<p>Test kartı seçin:</p>${Object.entries(MOCK_CARDS)
          .map(
            ([k, c], i) =>
              `<label class="opt"><input type="radio" name="card" value="${k}"${i === 0 ? " checked" : ""}> ${escapeHtml(c.label)}</label>`,
          )
          .join("")}${payment.saveCard ? `<p class="note">Bu kart ödeme kuruluşunda saklanacak.</p>` : ""}`;
    res.type("html").send(`<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Test ödeme sayfası</title>
<style>body{font-family:system-ui,sans-serif;max-width:420px;margin:40px auto;padding:0 16px;color:#222}
.badge{display:inline-block;background:#fff3cd;color:#7a5b00;padding:4px 10px;border-radius:12px;font-size:13px}
button{width:100%;padding:14px;margin-top:12px;border:0;border-radius:10px;font-size:16px;font-weight:600}
.ok{background:#C9184A;color:#fff}.fail{background:#eee;color:#333}
.opt{display:block;padding:10px;border:1px solid #ddd;border-radius:10px;margin:6px 0}.note{font-size:13px;color:#555}</style></head>
<body><span class="badge">TEST ORTAMI — gerçek para çekilmez</span>
<h2>${escapeHtml(formatTL(payment.amountCents))}</h2>
<p>${escapeHtml(PURPOSE_LABEL[payment.purpose])}</p>
${
  pending
    ? `<form method="post" action="/api/payments/mock/complete">
<input type="hidden" name="ref" value="${escapeHtml(ref)}">
${cardPicker}
<button class="ok" name="result" value="success">Ödemeyi onayla</button>
<button class="fail" name="result" value="fail">Ödemeyi reddet</button></form>`
    : `<p>Bu ödeme zaten sonuçlandı: ${escapeHtml(payment.status)}</p><a href="${escapeHtml(appReturnUrl(payment.id, payment.returnUrl))}">Uygulamaya dön</a>`
}
</body></html>`);
  });

  paymentsRouter.post("/mock/complete", urlencoded({ extended: false, limit: "4kb" }), async (req, res) => {
    const body = parse(
      z.object({
        ref: z.string().regex(/^mock_[\w-]+$/),
        result: z.enum(["success", "fail"]),
        card: z.enum(["master", "visa", "troy"]).default("master"),
      }),
      req.body,
    );
    const pending = await prisma.payment.findUnique({ where: { providerRef: body.ref } });
    if (!pending) throw notFound("Ödeme bulunamadı");
    const c = MOCK_CARDS[body.card];
    const card =
      pending.saveCard && !pending.savedCardId
        ? {
            cardUserKey: `mock_user_${pending.userId}`,
            cardToken: `mock_card_${randomToken(16)}`,
            last4: c.last4,
            association: c.association,
            bankName: c.bankName,
          }
        : undefined;
    const payment = await finalizeByProviderRef(
      body.ref,
      body.result === "success" ? { ok: true, card } : { ok: false, reason: "Ödeme reddedildi" },
    );
    res.redirect(303, appReturnUrl(payment.id, payment.returnUrl));
  });
}

// ───────────── PayTR (PAYMENT_PROVIDER=paytr) ─────────────

if (env.PAYMENT_PROVIDER === "paytr") {
  const cfg = paytrConfig();

  /**
   * PayTR'ın belgelediği yöntem: ödeme formu bizim sayfamızda PayTR iframe'i olarak açılır.
   * Kart bilgisi yalnızca PayTR'ın iframe'ine girilir; bu sayfa yalnızca çerçeveyi barındırır.
   */
  paymentsRouter.get("/paytr/checkout/:id", async (req, res) => {
    const payment = await prisma.payment.findUnique({ where: { id: parse(zId, req.params.id) } });
    if (!payment || payment.provider !== "PAYTR") throw notFound("Ödeme bulunamadı");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'none'; frame-src https://www.paytr.com; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'",
    );
    const body =
      payment.status === "PENDING" && payment.checkoutToken
        ? `<iframe src="https://www.paytr.com/odeme/guvenli/${encodeURIComponent(payment.checkoutToken)}" title="Güvenli ödeme formu" allow="payment"></iframe>`
        : `<p class="msg">Bu ödeme sonuçlandı. Uygulamaya dönebilirsiniz.</p>`;
    res.type("html").send(`<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Güvenli ödeme</title>
<style>html,body{margin:0;height:100%;background:#fff;font-family:system-ui,sans-serif}
.test{background:#fff3cd;color:#7a5b00;font-size:13px;text-align:center;padding:6px}
iframe{border:0;width:100%;height:calc(100% - ${cfg.testMode ? 30 : 0}px);display:block}.msg{padding:24px;text-align:center}</style></head>
<body>${cfg.testMode ? `<div class="test">TEST MODU — gerçek para çekilmez</div>` : ""}${body}</body></html>`);
  });

  /** PayTR ödeme bitince müşteriyi buraya yönlendirir (iframe içinde); uygulamaya dönülür. Kesin sonuç bildirimle gelir. */
  paymentsRouter.get("/paytr/return/:id", async (req, res) => {
    const payment = await prisma.payment.findUnique({ where: { id: parse(zId, req.params.id) } });
    if (!payment) throw notFound("Ödeme bulunamadı");
    const target = appReturnUrl(payment.id, payment.returnUrl);
    const nonce = randomBytes(16).toString("base64");
    res.setHeader(
      "Content-Security-Policy",
      `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; base-uri 'none'`,
    );
    res.type("html").send(`<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Uygulamaya dönülüyor</title><style>body{font-family:system-ui,sans-serif;text-align:center;padding:32px}</style></head>
<body><p>Ödeme sonucu uygulamaya iletiliyor…</p><a href="${escapeHtml(target)}" target="_top">Uygulamaya dön</a>
<script nonce="${nonce}">try{window.top.location.href=${JSON.stringify(target)}}catch(e){location.href=${JSON.stringify(target)}}</script>
</body></html>`);
  });

  /**
   * PayTR ödeme sonucu bildirimi (mağaza panelinde "Bildirim URL" olarak tanımlanır). Hash doğrulanmadan
   * hiçbir işlem yapılmaz. Aynı bildirim birden çok gelebilir; finalizePayment yalnızca ilkini işler.
   * PayTR yanıt olarak düz metin "OK" bekler; alamazsa bildirimi tekrarlar.
   */
  paymentsRouter.post("/paytr/callback", urlencoded({ extended: false, limit: "8kb" }), async (req, res) => {
    const result = await handlePaytrNotification(cfg, (req.body ?? {}) as Record<string, string | undefined>);
    if (result === "BAD_HASH") {
      res.status(400).type("text").send("PAYTR notification failed: bad hash");
      return;
    }
    res.type("text").send("OK");
  });
}
