import { randomInt } from "node:crypto";
import { prisma, type Tx } from "../../lib/prisma.ts";
import { AppError } from "../../lib/errors.ts";
import { logger } from "../../lib/logger.ts";
import { notify } from "../notifications/notify.ts";

/**
 * Sadakat programı (Bakımca karşılar):
 *  - Tamamlanan randevu ve teslim edilen sipariş: her 10 TL için 1 puan
 *  - Davet: davet edilen kişinin ilk tamamlanan randevusu/teslim edilen siparişi sonrası iki tarafa 200 puan
 *  - Kullanım: en az 200 puan; 20 puan = 1 TL cüzdan bakiyesi
 */
export const LOYALTY = {
  centsPerPoint: 1000,
  referralPoints: 200,
  minRedeem: 200,
  pointsPerTL: 20,
} as const;

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export async function ensureReferralCode(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { referralCode: true } });
  if (user.referralCode) return user.referralCode;
  for (let i = 0; i < 8; i++) {
    const code = Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
    try {
      await prisma.user.update({ where: { id: userId }, data: { referralCode: code } });
      return code;
    } catch {
      // aynı kod varsa yeniden dene
    }
  }
  throw new AppError(500, "REFERRAL_CODE", "Davet kodu oluşturulamadı");
}

/** Puan ekler; refKey aynı işlem için ikinci kez puan verilmesini engeller. */
async function award(
  tx: Tx,
  userId: string,
  points: number,
  reason: "APPOINTMENT" | "ORDER" | "REFERRAL",
  description: string,
  refKey: string,
) {
  if (points <= 0) return false;
  const exists = await tx.loyaltyTransaction.findUnique({ where: { refKey } });
  if (exists) return false;
  await tx.loyaltyTransaction.create({ data: { userId, points, reason, description, refKey } });
  await tx.user.update({ where: { id: userId }, data: { loyaltyPoints: { increment: points } } });
  return true;
}

/** Davet ödülü: davet edilen kullanıcının ilk ödüllü işleminden sonra bir kez. */
async function rewardReferral(tx: Tx, userId: string) {
  const user = await tx.user.findUnique({ where: { id: userId } });
  if (!user?.referredById || user.referralRewardedAt) return null;
  const claimed = await tx.user.updateMany({
    where: { id: userId, referralRewardedAt: null },
    data: { referralRewardedAt: new Date() },
  });
  if (!claimed.count) return null;
  await award(tx, userId, LOYALTY.referralPoints, "REFERRAL", "Davet ödülü", `ref:${userId}:self`);
  await award(
    tx,
    user.referredById,
    LOYALTY.referralPoints,
    "REFERRAL",
    `${user.name} davetiniz`,
    `ref:${userId}:inviter`,
  );
  return user.referredById;
}

async function earn(
  userId: string | null,
  totalCents: number,
  reason: "APPOINTMENT" | "ORDER",
  description: string,
  refKey: string,
) {
  if (!userId) return;
  try {
    const points = Math.floor(totalCents / LOYALTY.centsPerPoint);
    const result = await prisma.$transaction(async (tx) => {
      const got = await award(tx, userId, points, reason, description, refKey);
      const inviter = await rewardReferral(tx, userId);
      return { got, inviter };
    });
    if (result.got) {
      await notify(userId, {
        type: "loyalty",
        title: `${points} puan kazandınız`,
        body: `${description}. Puanlarınızı Profil > Puanlarım'dan cüzdanınıza aktarabilirsiniz.`,
      });
    }
    if (result.inviter) {
      await notify(result.inviter, {
        type: "loyalty",
        title: `${LOYALTY.referralPoints} davet puanı kazandınız`,
        body: "Davet ettiğiniz arkadaşınız ilk işlemini tamamladı.",
      });
    }
  } catch (err) {
    logger.error({ err, refKey }, "puan verilemedi");
  }
}

export async function onAppointmentCompleted(appointmentId: string) {
  const a = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { salon: { select: { name: true } } },
  });
  if (!a || a.status !== "COMPLETED") return;
  await earn(a.userId, a.totalCents, "APPOINTMENT", `${a.salon.name} randevusu`, `appt:${a.id}`);
}

export async function onOrderDelivered(orderId: string) {
  const o = await prisma.order.findUnique({ where: { id: orderId } });
  if (!o || o.status !== "DELIVERED") return;
  await earn(o.userId, o.subtotalCents, "ORDER", `${o.orderNumber} siparişi`, `order:${o.id}`);
}

/** Puanı cüzdan bakiyesine aktarır. */
export async function redeemPoints(userId: string, points: number) {
  if (points < LOYALTY.minRedeem)
    throw new AppError(400, "MIN_REDEEM", `En az ${LOYALTY.minRedeem} puan kullanılabilir`);
  if (points % LOYALTY.pointsPerTL !== 0) {
    throw new AppError(400, "INVALID_POINTS", `Puan ${LOYALTY.pointsPerTL}'nin katı olmalı`);
  }
  const cents = (points / LOYALTY.pointsPerTL) * 100;
  return prisma.$transaction(async (tx) => {
    const ok = await tx.user.updateMany({
      where: { id: userId, loyaltyPoints: { gte: points } },
      data: { loyaltyPoints: { decrement: points }, walletBalanceCents: { increment: cents } },
    });
    if (!ok.count) throw new AppError(400, "INSUFFICIENT_POINTS", "Yeterli puanınız yok");
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    await tx.loyaltyTransaction.create({
      data: { userId, points: -points, reason: "REDEEM", description: "Cüzdana aktarıldı" },
    });
    await tx.walletTransaction.create({
      data: {
        userId,
        type: "LOYALTY",
        amountCents: cents,
        balanceAfterCents: user.walletBalanceCents,
        description: `${points} puan cüzdana aktarıldı`,
      },
    });
    return { points: user.loyaltyPoints, walletBalanceCents: user.walletBalanceCents, cents };
  });
}
