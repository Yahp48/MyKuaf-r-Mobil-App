import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.ts";
import { parse, zId } from "../../lib/validate.ts";
import { AppError, notFound } from "../../lib/errors.ts";
import { requireAuth, userId } from "../../middleware/auth.ts";
import { paymentProvider } from "../payments/providers.ts";
import { CARD_VERIFY_CENTS, serializePayment, startCheckout, zReturnUrl } from "../payments/service.ts";
import type { SavedCard } from "../../generated/prisma/client.ts";

/**
 * Kayıtlı kartlar. Kart bilgisi uygulamaya veya sunucuya hiç gelmez: kart, ödeme kuruluşunun güvenli sayfasında
 * "kartımı kaydet" ile saklanır; burada yalnızca kuruluşun verdiği anahtarlar ve son 4 hane tutulur.
 */
export const cardsRouter = Router();
cardsRouter.use(requireAuth);

const MAX_CARDS = 5;

export const serializeCard = (c: SavedCard) => ({
  id: c.id,
  alias: c.alias,
  association: c.association,
  bankName: c.bankName,
  last4: c.last4,
  isDefault: c.isDefault,
  createdAt: c.createdAt.toISOString(),
});

cardsRouter.get("/", async (req, res) => {
  const items = await prisma.savedCard.findMany({
    where: { userId: userId(req) },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
  res.json({ items: items.map(serializeCard) });
});

/** Yeni kart ekleme: 1 TL'lik doğrulama ödemesi açılır, kart saklanır ve tutar hemen iade edilir. */
cardsRouter.post("/verify", async (req, res) => {
  const { returnUrl } = parse(z.object({ returnUrl: zReturnUrl.optional() }), req.body ?? {});
  const uid = userId(req);
  if ((await prisma.savedCard.count({ where: { userId: uid } })) >= MAX_CARDS) {
    throw new AppError(400, "CARD_LIMIT", `En fazla ${MAX_CARDS} kart kaydedebilirsiniz`);
  }
  const payment = await prisma.payment.create({
    data: {
      userId: uid,
      purpose: "CARD_VERIFY",
      amountCents: CARD_VERIFY_CENTS,
      provider: paymentProvider().name,
      saveCard: true,
      returnUrl,
    },
  });
  const checkout = await startCheckout(payment.id);
  const fresh = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
  res.status(201).json({ payment: serializePayment(fresh), checkoutUrl: checkout.checkoutUrl });
});

async function ownCard(uid: string, id: string) {
  const card = await prisma.savedCard.findFirst({ where: { id, userId: uid } });
  if (!card) throw notFound("Kart bulunamadı");
  return card;
}

cardsRouter.patch("/:id", async (req, res) => {
  const uid = userId(req);
  const id = parse(zId, req.params.id);
  const body = parse(
    z.object({
      alias: z.string().trim().min(1, "Kart adı gerekli").max(40).optional(),
      isDefault: z.literal(true).optional(),
    }),
    req.body,
  );
  await ownCard(uid, id);
  const card = await prisma.$transaction(async (tx) => {
    if (body.isDefault) await tx.savedCard.updateMany({ where: { userId: uid }, data: { isDefault: false } });
    return tx.savedCard.update({ where: { id }, data: body });
  });
  res.json({ card: serializeCard(card) });
});

cardsRouter.delete("/:id", async (req, res) => {
  const uid = userId(req);
  const card = await ownCard(uid, parse(zId, req.params.id));
  await paymentProvider().deleteCard({ cardUserKey: card.cardUserKey, cardToken: card.cardToken });
  await prisma.$transaction(async (tx) => {
    await tx.savedCard.delete({ where: { id: card.id } });
    if (card.isDefault) {
      const next = await tx.savedCard.findFirst({ where: { userId: uid }, orderBy: { createdAt: "asc" } });
      if (next) await tx.savedCard.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  });
  res.status(204).end();
});

/** Ödeme isteğindeki kart seçeneklerini doğrular; kayıtlı kart kullanıcıya ait olmalı. */
export const zCardOptions = {
  savedCardId: zId.optional(),
  saveCard: z.boolean().optional(),
};

export async function resolveCardOptions(uid: string, opts: { savedCardId?: string; saveCard?: boolean }) {
  if (opts.savedCardId) {
    await ownCard(uid, opts.savedCardId);
    return { savedCardId: opts.savedCardId, saveCard: false };
  }
  return { saveCard: !!opts.saveCard };
}
