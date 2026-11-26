import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.ts";
import { pageResult, paginate, parse, zPagination } from "../../lib/validate.ts";
import { AppError } from "../../lib/errors.ts";
import { formatTL, fromTL, toTL } from "../../lib/money.ts";
import { env } from "../../config/env.ts";
import { requireAuth, userId } from "../../middleware/auth.ts";
import { paymentProvider } from "../payments/providers.ts";
import { serializePayment, startCheckout } from "../payments/service.ts";

export const walletRouter = Router();
walletRouter.use(requireAuth);

walletRouter.get("/", async (req, res) => {
  const uid = userId(req);
  const { page, pageSize } = parse(zPagination, req.query);
  const [user, rows, total] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: uid }, select: { walletBalanceCents: true } }),
    prisma.walletTransaction.findMany({
      where: { userId: uid },
      orderBy: { createdAt: "desc" },
      ...paginate(page, pageSize),
    }),
    prisma.walletTransaction.count({ where: { userId: uid } }),
  ]);
  res.json({
    balance: toTL(user.walletBalanceCents),
    limits: { minTopup: toTL(env.WALLET_MIN_TOPUP_CENTS), maxTopup: toTL(env.WALLET_MAX_TOPUP_CENTS) },
    transactions: pageResult(
      rows.map((t) => ({
        id: t.id,
        type: t.type,
        amount: toTL(t.amountCents),
        balanceAfter: toTL(t.balanceAfterCents),
        description: t.description,
        orderId: t.orderId,
        createdAt: t.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    ),
  });
});

const topupSchema = z.object({
  // TL cinsinden, en fazla 2 ondalık
  amount: z.number().positive("Tutar sıfırdan büyük olmalı").multipleOf(0.01, "En fazla 2 ondalık basamak"),
});

walletRouter.post("/topups", async (req, res) => {
  const { amount } = parse(topupSchema, req.body);
  const cents = fromTL(amount);
  if (cents < env.WALLET_MIN_TOPUP_CENTS || cents > env.WALLET_MAX_TOPUP_CENTS) {
    throw new AppError(
      400,
      "INVALID_AMOUNT",
      `Yükleme tutarı ${formatTL(env.WALLET_MIN_TOPUP_CENTS)} ile ${formatTL(env.WALLET_MAX_TOPUP_CENTS)} arasında olmalı`,
    );
  }
  const payment = await prisma.payment.create({
    data: { userId: userId(req), purpose: "WALLET_TOPUP", amountCents: cents, provider: paymentProvider().name },
  });
  const checkout = await startCheckout(payment.id);
  const fresh = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
  res.status(201).json({ payment: serializePayment(fresh), checkoutUrl: checkout.checkoutUrl });
});
