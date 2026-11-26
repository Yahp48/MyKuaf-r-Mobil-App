import { prisma, type Tx } from "../../lib/prisma.ts";
import { AppError, notFound } from "../../lib/errors.ts";
import { formatTL, toTL } from "../../lib/money.ts";
import { logger } from "../../lib/logger.ts";
import { notify } from "../notifications/notify.ts";
import { emitToUser } from "../../realtime/socket.ts";
import { paymentProvider } from "./providers.ts";
import type { Payment } from "../../generated/prisma/client.ts";

// Ödeme sayfasında bu süreden uzun bekleyen işlemler iptal edilir, ayrılan stok serbest bırakılır.
export const PAYMENT_TIMEOUT_MS = 30 * 60_000;

export function serializePayment(p: Payment) {
  return {
    id: p.id,
    purpose: p.purpose,
    status: p.status,
    amount: toTL(p.amountCents),
    orderId: p.orderId,
    failureReason: p.failureReason,
    completedAt: p.completedAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
  };
}

/** Ödeme kaydını sağlayıcıda başlatır ve kullanıcıya açılacak güvenli ödeme sayfası adresini döner. */
export async function startCheckout(paymentId: string) {
  const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId }, include: { user: true } });
  if (!payment.user) throw notFound("Kullanıcı bulunamadı");
  try {
    const session = await paymentProvider().createCheckout({
      paymentId: payment.id,
      amountCents: payment.amountCents,
      description: payment.purpose === "ORDER" ? "MyKuaför sipariş ödemesi" : "MyKuaför cüzdan yükleme",
      buyer: { id: payment.user.id, name: payment.user.name, email: payment.user.email, phone: payment.user.phone },
    });
    await prisma.payment.update({ where: { id: payment.id }, data: { providerRef: session.providerRef } });
    return session;
  } catch (err) {
    await finalizePayment(payment.id, { ok: false, reason: "Ödeme başlatılamadı" });
    throw err;
  }
}

/** Siparişteki ürünlerin stoğunu geri yükler. */
export async function restoreStock(tx: Tx, orderId: string) {
  const items = await tx.orderItem.findMany({ where: { orderId } });
  for (const item of items) {
    await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
  }
}

type Outcome = { ok: true } | { ok: false; reason: string };

/**
 * Ödemeyi sonuçlandırır. Aynı ödeme için birden çok kez çağrılabilir (sağlayıcı geri çağrısı tekrar edebilir);
 * yalnızca ilk çağrı etkili olur.
 */
export async function finalizePayment(paymentId: string, outcome: Outcome) {
  const result = await prisma.$transaction(async (tx) => {
    const claimed = await tx.payment.updateMany({
      where: { id: paymentId, status: "PENDING" },
      data: outcome.ok
        ? { status: "SUCCEEDED", completedAt: new Date() }
        : { status: "FAILED", completedAt: new Date(), failureReason: outcome.reason },
    });
    const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
    if (claimed.count === 0) return { payment, changed: false as const };

    if (payment.purpose === "ORDER" && payment.orderId) {
      if (outcome.ok) {
        const order = await tx.order.update({
          where: { id: payment.orderId },
          data: { status: "PAID", paidAt: new Date() },
          include: { items: true },
        });
        if (order.userId) {
          await tx.cartItem.deleteMany({
            where: { userId: order.userId, productId: { in: order.items.map((i) => i.productId) } },
          });
        }
      } else {
        const cancelled = await tx.order.updateMany({
          where: { id: payment.orderId, status: "PENDING_PAYMENT" },
          data: { status: "CANCELLED", cancelledAt: new Date() },
        });
        if (cancelled.count) await restoreStock(tx, payment.orderId);
      }
    }

    if (payment.purpose === "WALLET_TOPUP" && outcome.ok && payment.userId) {
      const user = await tx.user.update({
        where: { id: payment.userId },
        data: { walletBalanceCents: { increment: payment.amountCents } },
      });
      await tx.walletTransaction.create({
        data: {
          userId: payment.userId,
          type: "TOPUP",
          amountCents: payment.amountCents,
          balanceAfterCents: user.walletBalanceCents,
          description: "Cüzdana bakiye yükleme",
          paymentId: payment.id,
        },
      });
    }
    return { payment, changed: true as const };
  });

  const { payment } = result;
  if (result.changed && payment.userId) {
    emitToUser(payment.userId, "payment:updated", serializePayment(payment));
    if (outcome.ok) {
      await notify(payment.userId, {
        type: payment.purpose === "ORDER" ? "order_paid" : "wallet_topup",
        title: payment.purpose === "ORDER" ? "Siparişiniz alındı" : "Bakiye yüklendi",
        body:
          payment.purpose === "ORDER"
            ? `${formatTL(payment.amountCents)} tutarındaki ödemeniz başarıyla alındı.`
            : `Cüzdanınıza ${formatTL(payment.amountCents)} yüklendi.`,
        data: payment.orderId ? { orderId: payment.orderId } : { paymentId: payment.id },
      });
    }
  }
  return payment;
}

export async function finalizeByProviderRef(providerRef: string, outcome: Outcome) {
  const payment = await prisma.payment.findUnique({ where: { providerRef } });
  if (!payment) throw new AppError(404, "PAYMENT_NOT_FOUND", "Ödeme bulunamadı");
  return finalizePayment(payment.id, outcome);
}

/** Zaman aşımına uğramış bekleyen ödemeleri iptal eder (sunucu periyodik çalıştırır). */
export async function expireStalePayments(now = new Date()) {
  const stale = await prisma.payment.findMany({
    where: { status: "PENDING", createdAt: { lt: new Date(now.getTime() - PAYMENT_TIMEOUT_MS) } },
    select: { id: true },
    take: 200,
  });
  for (const p of stale) {
    try {
      await finalizePayment(p.id, { ok: false, reason: "Ödeme süresi doldu" });
    } catch (err) {
      logger.error({ err, paymentId: p.id }, "Zaman aşımı işlenemedi");
    }
  }
  return stale.length;
}
