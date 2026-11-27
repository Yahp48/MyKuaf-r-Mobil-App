import { Router } from "express";
import { z } from "zod";
import { DateTime } from "luxon";
import { prisma } from "../../lib/prisma.ts";
import { pageResult, paginate, parse, zPagination } from "../../lib/validate.ts";
import { AppError } from "../../lib/errors.ts";
import { formatTL, fromTL, toTL } from "../../lib/money.ts";
import { env } from "../../config/env.ts";
import { requireAuth, userId } from "../../middleware/auth.ts";
import { paymentProvider } from "../payments/providers.ts";
import { serializePayment, startCheckout, zReturnUrl } from "../payments/service.ts";

export const walletRouter = Router();
walletRouter.use(requireAuth);

const listSchema = zPagination.extend({ type: z.enum(["TOPUP", "PAYMENT", "REFUND"]).optional() });

walletRouter.get("/", async (req, res) => {
  const uid = userId(req);
  const { page, pageSize, type } = parse(listSchema, req.query);
  const where = { userId: uid, ...(type ? { type } : {}) };
  const monthStart = DateTime.now().setZone("Europe/Istanbul").startOf("month").toJSDate();
  const [user, rows, total, month] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: uid }, select: { walletBalanceCents: true } }),
    prisma.walletTransaction.findMany({ where, orderBy: { createdAt: "desc" }, ...paginate(page, pageSize) }),
    prisma.walletTransaction.count({ where }),
    prisma.walletTransaction.groupBy({
      by: ["type"],
      where: { userId: uid, createdAt: { gte: monthStart } },
      _sum: { amountCents: true },
    }),
  ]);
  const sum = (t: "TOPUP" | "PAYMENT" | "REFUND") => Math.abs(month.find((m) => m.type === t)?._sum.amountCents ?? 0);
  res.json({
    balance: toTL(user.walletBalanceCents),
    // Bu ayın özeti (İstanbul saatine göre)
    month: { spent: toTL(sum("PAYMENT")), loaded: toTL(sum("TOPUP")), refunded: toTL(sum("REFUND")) },
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
  returnUrl: zReturnUrl.optional(),
});

walletRouter.post("/topups", async (req, res) => {
  const { amount, returnUrl } = parse(topupSchema, req.body);
  const cents = fromTL(amount);
  if (cents < env.WALLET_MIN_TOPUP_CENTS || cents > env.WALLET_MAX_TOPUP_CENTS) {
    throw new AppError(
      400,
      "INVALID_AMOUNT",
      `Yükleme tutarı ${formatTL(env.WALLET_MIN_TOPUP_CENTS)} ile ${formatTL(env.WALLET_MAX_TOPUP_CENTS)} arasında olmalı`,
    );
  }
  const payment = await prisma.payment.create({
    data: {
      userId: userId(req),
      purpose: "WALLET_TOPUP",
      amountCents: cents,
      provider: paymentProvider().name,
      returnUrl,
    },
  });
  const checkout = await startCheckout(payment.id);
  const fresh = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
  res.status(201).json({ payment: serializePayment(fresh), checkoutUrl: checkout.checkoutUrl });
});
