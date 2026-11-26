import { Router, urlencoded } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.ts";
import { parse, zId } from "../../lib/validate.ts";
import { notFound } from "../../lib/errors.ts";
import { formatTL } from "../../lib/money.ts";
import { requireAuth, userId } from "../../middleware/auth.ts";
import { env } from "../../config/env.ts";
import { finalizeByProviderRef, serializePayment } from "./service.ts";

export const paymentsRouter = Router();

/** Ödeme sayfası kapandıktan sonra uygulama sonucu buradan sorgular. */
paymentsRouter.get("/:id", requireAuth, async (req, res) => {
  const payment = await prisma.payment.findFirst({ where: { id: parse(zId, req.params.id), userId: userId(req) } });
  if (!payment) throw notFound("Ödeme bulunamadı");
  res.json({ payment: serializePayment(payment) });
});

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const appReturnUrl = (paymentId: string) =>
  `${env.APP_DEEP_LINK_SCHEME}://payment-result?paymentId=${encodeURIComponent(paymentId)}`;

// ───────────── Sahte sağlayıcı (yalnızca PAYMENT_PROVIDER=mock; production'da env doğrulaması engeller) ─────────────

if (env.PAYMENT_PROVIDER === "mock") {
  paymentsRouter.get("/mock/checkout/:ref", async (req, res) => {
    const ref = parse(z.string().regex(/^mock_[\w-]+$/), req.params.ref);
    const payment = await prisma.payment.findUnique({ where: { providerRef: ref } });
    if (!payment) throw notFound("Ödeme bulunamadı");
    const pending = payment.status === "PENDING";
    res.type("html").send(`<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Test ödeme sayfası</title>
<style>body{font-family:system-ui,sans-serif;max-width:420px;margin:40px auto;padding:0 16px;color:#222}
.badge{display:inline-block;background:#fff3cd;color:#7a5b00;padding:4px 10px;border-radius:12px;font-size:13px}
button{width:100%;padding:14px;margin-top:12px;border:0;border-radius:10px;font-size:16px;font-weight:600}
.ok{background:#FF4896;color:#fff}.fail{background:#eee;color:#333}</style></head>
<body><span class="badge">TEST ORTAMI — gerçek para çekilmez</span>
<h2>${escapeHtml(formatTL(payment.amountCents))}</h2>
<p>${payment.purpose === "ORDER" ? "Sipariş ödemesi" : "Cüzdan yükleme"}</p>
${
  pending
    ? `<form method="post" action="/api/payments/mock/complete">
<input type="hidden" name="ref" value="${escapeHtml(ref)}">
<button class="ok" name="result" value="success">Ödemeyi onayla</button>
<button class="fail" name="result" value="fail">Ödemeyi reddet</button></form>`
    : `<p>Bu ödeme zaten sonuçlandı: ${escapeHtml(payment.status)}</p><a href="${escapeHtml(appReturnUrl(payment.id))}">Uygulamaya dön</a>`
}
</body></html>`);
  });

  paymentsRouter.post("/mock/complete", urlencoded({ extended: false, limit: "4kb" }), async (req, res) => {
    const body = parse(
      z.object({ ref: z.string().regex(/^mock_[\w-]+$/), result: z.enum(["success", "fail"]) }),
      req.body,
    );
    const payment = await finalizeByProviderRef(
      body.ref,
      body.result === "success" ? { ok: true } : { ok: false, reason: "Ödeme reddedildi" },
    );
    res.redirect(303, appReturnUrl(payment.id));
  });
}
