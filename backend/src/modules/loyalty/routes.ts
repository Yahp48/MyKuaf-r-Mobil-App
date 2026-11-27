import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.ts";
import { parse } from "../../lib/validate.ts";
import { toTL } from "../../lib/money.ts";
import { requireAuth, userId } from "../../middleware/auth.ts";
import { ensureReferralCode, LOYALTY, redeemPoints } from "./service.ts";

export const loyaltyRouter = Router();
loyaltyRouter.use(requireAuth);

loyaltyRouter.get("/", async (req, res) => {
  const uid = userId(req);
  const code = await ensureReferralCode(uid);
  const [user, history, invited] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: uid }, select: { loyaltyPoints: true } }),
    prisma.loyaltyTransaction.findMany({ where: { userId: uid }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.user.count({ where: { referredById: uid } }),
  ]);
  res.json({
    points: user.loyaltyPoints,
    value: toTL(Math.floor(user.loyaltyPoints / LOYALTY.pointsPerTL) * 100),
    rules: {
      tlPerPoint: LOYALTY.centsPerPoint / 100,
      referralPoints: LOYALTY.referralPoints,
      minRedeem: LOYALTY.minRedeem,
      pointsPerTL: LOYALTY.pointsPerTL,
    },
    referralCode: code,
    invitedCount: invited,
    history: history.map((h) => ({
      id: h.id,
      points: h.points,
      reason: h.reason,
      description: h.description,
      createdAt: h.createdAt.toISOString(),
    })),
  });
});

loyaltyRouter.post("/redeem", async (req, res) => {
  const { points } = parse(z.object({ points: z.number().int().positive() }), req.body);
  const r = await redeemPoints(userId(req), points);
  res.json({ points: r.points, walletBalance: toTL(r.walletBalanceCents), credited: toTL(r.cents) });
});
