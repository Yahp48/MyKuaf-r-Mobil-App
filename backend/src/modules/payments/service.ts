import { prisma, type Tx } from "../../lib/prisma.ts";
import { AppError, notFound } from "../../lib/errors.ts";
import { formatTL, toTL } from "../../lib/money.ts";
import { logger } from "../../lib/logger.ts";
import { notify } from "../notifications/notify.ts";
import { z } from "zod";
import { emitToAdmins, emitToBusiness, emitToUser } from "../../realtime/socket.ts";
import { env, isProd } from "../../config/env.ts";
import { paymentProvider, type StoredCardInfo } from "./providers.ts";
import type { Payment } from "../../generated/prisma/client.ts";

/**
 * Ödeme bitince yönlendirilecek uygulama adresi. Açık yönlendirme (open redirect) olmaması için
 * yalnızca uygulamanın kendi şeması; geliştirmede Expo Go adresleri (exp://) kabul edilir.
 */
export const zReturnUrl = z
  .string()
  .max(300)
  .refine(
    (u) => u.startsWith(`${env.APP_DEEP_LINK_SCHEME}://`) || (!isProd && /^exps?:\/\//.test(u)),
    "Geçersiz dönüş adresi",
  );

// Ödeme sayfasında bu süreden uzun bekleyen işlemler iptal edilir, ayrılan stok serbest bırakılır.
export const PAYMENT_TIMEOUT_MS = 30 * 60_000;

export const PURPOSE_LABEL = {
  ORDER: "MyKuaför sipariş ödemesi",
  WALLET_TOPUP: "MyKuaför cüzdan yükleme",
  CARD_VERIFY: "Kart doğrulama (hemen iade edilir)",
} as const;

/** Kart doğrulama tutarı: başarılı olunca anında iade edilir. */
export const CARD_VERIFY_CENTS = 100;

export function serializePayment(p: Payment) {
  return {
    id: p.id,
    purpose: p.purpose,
    status: p.status,
    amount: toTL(p.amountCents),
    refunded: toTL(p.refundedCents),
    failureReason: p.failureReason,
    completedAt: p.completedAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
  };
}

/** Ödeme kaydını sağlayıcıda başlatır ve kullanıcıya açılacak güvenli ödeme sayfası adresini döner. */
export async function startCheckout(paymentId: string) {
  const payment = await prisma.payment.findUniqueOrThrow({
    where: { id: paymentId },
    include: { user: true, savedCard: true },
  });
  if (!payment.user) throw notFound("Kullanıcı bulunamadı");
  try {
    const session = await paymentProvider().createCheckout({
      paymentId: payment.id,
      amountCents: payment.amountCents,
      description: PURPOSE_LABEL[payment.purpose],
      buyer: { id: payment.user.id, name: payment.user.name, email: payment.user.email, phone: payment.user.phone },
      savedCard: payment.savedCard
        ? { cardUserKey: payment.savedCard.cardUserKey, cardToken: payment.savedCard.cardToken }
        : undefined,
      registerCard: payment.saveCard && !payment.savedCard,
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

type Outcome = { ok: true; card?: StoredCardInfo } | { ok: false; reason: string };

/** Ödeme sağlayıcısının sakladığı kartı kullanıcının kartlarına ekler (aynı kart tekrar eklenmez). */
async function storeCard(tx: Tx, payment: Payment, card: StoredCardInfo) {
  if (!payment.userId) return;
  const count = await tx.savedCard.count({ where: { userId: payment.userId } });
  const brand = card.association ? card.association.replace("_", " ").toLowerCase() : "kart";
  await tx.savedCard.upsert({
    where: { cardToken: card.cardToken },
    update: {},
    create: {
      userId: payment.userId,
      provider: payment.provider,
      cardUserKey: card.cardUserKey,
      cardToken: card.cardToken,
      alias: `${brand.charAt(0).toLocaleUpperCase("tr-TR")}${brand.slice(1)} •••• ${card.last4}`,
      association: card.association,
      bankName: card.bankName,
      last4: card.last4,
      isDefault: count === 0,
    },
  });
}

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
    if (claimed.count === 0) return { payment, changed: false as const, orderIds: [] as string[] };

    let orderIds: string[] = [];
    if (payment.purpose === "ORDER") {
      const orders = await tx.order.findMany({
        where: { paymentId: payment.id, status: "PENDING_PAYMENT" },
        include: { items: true },
      });
      orderIds = orders.map((o) => o.id);
      if (outcome.ok) {
        await tx.order.updateMany({ where: { id: { in: orderIds } }, data: { status: "PAID", paidAt: new Date() } });
        if (payment.userId) {
          await tx.cartItem.deleteMany({
            where: {
              userId: payment.userId,
              productId: { in: orders.flatMap((o) => o.items.map((i) => i.productId)) },
            },
          });
        }
      } else {
        await tx.order.updateMany({
          where: { id: { in: orderIds } },
          data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: outcome.reason },
        });
        for (const id of orderIds) await restoreStock(tx, id);
      }
    }

    if (outcome.ok && outcome.card && payment.saveCard) await storeCard(tx, payment, outcome.card);

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
    return { payment, changed: true as const, orderIds };
  });

  const { payment } = result;
  if (result.changed && result.orderIds.length) {
    // Sipariş paneline anında düşer (ödenen) veya listeden çıkar (iptal).
    const { orderInclude, serializeOrder, publishOrder } = await import("../orders/service.ts");
    const orders = await prisma.order.findMany({ where: { id: { in: result.orderIds } }, include: orderInclude });
    for (const o of orders) {
      if (outcome.ok) {
        emitToBusiness(o.sellerId, "order:new", serializeOrder(o));
        emitToAdmins("order.paid", `${o.orderNumber} numaralı sipariş ödendi`);
      }
      publishOrder(o);
    }
  }
  // Kart doğrulama ödemesi: kart kaydedildikten sonra tutar hemen iade edilir.
  if (result.changed && outcome.ok && payment.purpose === "CARD_VERIFY" && payment.providerRef) {
    try {
      await paymentProvider().refund({ providerRef: payment.providerRef, amountCents: payment.amountCents });
      await prisma.payment.update({ where: { id: payment.id }, data: { refundedCents: payment.amountCents } });
    } catch (err) {
      logger.error({ err, paymentId: payment.id }, "kart doğrulama iadesi başarısız");
    }
  }

  if (result.changed && payment.userId) {
    emitToUser(payment.userId, "payment:updated", serializePayment(payment));
    if (outcome.ok && payment.purpose === "CARD_VERIFY") {
      await notify(payment.userId, {
        type: "card_saved",
        title: "Kartınız kaydedildi",
        body: `Doğrulama için çekilen ${formatTL(payment.amountCents)} kartınıza iade edildi.`,
        data: { paymentId: payment.id },
      });
    } else if (outcome.ok) {
      await notify(payment.userId, {
        type: payment.purpose === "ORDER" ? "order_paid" : "wallet_topup",
        title: payment.purpose === "ORDER" ? "Siparişiniz alındı" : "Bakiye yüklendi",
        body:
          payment.purpose === "ORDER"
            ? `${formatTL(payment.amountCents)} tutarındaki ödemeniz başarıyla alındı.`
            : `Cüzdanınıza ${formatTL(payment.amountCents)} yüklendi.`,
        data: result.orderIds[0] ? { orderId: result.orderIds[0] } : { paymentId: payment.id },
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
