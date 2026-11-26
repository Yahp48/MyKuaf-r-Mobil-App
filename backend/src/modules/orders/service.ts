import { prisma } from "../../lib/prisma.ts";
import { AppError, notFound } from "../../lib/errors.ts";
import { formatTL, toTL } from "../../lib/money.ts";
import { paymentProvider } from "../payments/providers.ts";
import { restoreStock, serializePayment } from "../payments/service.ts";
import { notify } from "../notifications/notify.ts";
import { emitToBusiness, emitToUser } from "../../realtime/socket.ts";
import type { Prisma } from "../../generated/prisma/client.ts";

export const orderInclude = {
  items: true,
  payment: true,
  seller: { select: { id: true, displayName: true } },
} satisfies Prisma.OrderInclude;
export type OrderRow = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

// Müşteri, sipariş hazırlanmaya başlamadan iptal edebilir.
export const CUSTOMER_CANCELLABLE = ["PENDING_PAYMENT", "PAID"] as const;
// Satıcı, kargoya vermeden önce iptal edebilir (stok yok, hatalı fiyat vb.).
export const SELLER_CANCELLABLE = ["PAID", "PREPARING"] as const;

export function serializeOrder(o: OrderRow) {
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    paymentMethod: o.paymentMethod,
    subtotal: toTL(o.subtotalCents),
    shipping: toTL(o.shippingCents),
    total: toTL(o.totalCents),
    shippingAddress: o.shippingAddress,
    carrier: o.carrier,
    trackingNumber: o.trackingNumber,
    seller: { id: o.seller.id, name: o.seller.displayName },
    items: o.items.map((i) => ({
      productId: i.productId,
      name: i.nameSnapshot,
      image: i.imageSnapshot,
      unitPrice: toTL(i.unitPriceCents),
      quantity: i.quantity,
      lineTotal: toTL(i.lineTotalCents),
    })),
    itemCount: o.items.reduce((n, i) => n + i.quantity, 0),
    canCancel: (CUSTOMER_CANCELLABLE as readonly string[]).includes(o.status),
    payment: o.payment ? serializePayment(o.payment) : null,
    cancelReason: o.cancelReason,
    paidAt: o.paidAt?.toISOString() ?? null,
    shippedAt: o.shippedAt?.toISOString() ?? null,
    deliveredAt: o.deliveredAt?.toISOString() ?? null,
    cancelledAt: o.cancelledAt?.toISOString() ?? null,
    createdAt: o.createdAt.toISOString(),
  };
}

/** Sipariş değişikliğini müşteriye ve satıcı paneline anında iletir. */
export function publishOrder(o: OrderRow) {
  const data = serializeOrder(o);
  if (o.userId) emitToUser(o.userId, "order:updated", data);
  emitToBusiness(o.sellerId, "order:updated", data);
}

/**
 * Siparişi iptal eder; ödenmişse tutarı iade eder (cüzdana veya karta, kısmi iade desteklenir),
 * stoğu geri yükler. Ödeme bekleyen siparişte aynı ödemeye bağlı tüm siparişler birlikte iptal edilir.
 */
export async function cancelOrder(
  orderId: string,
  opts: { by: "customer" | "seller"; reason: string; allowed: readonly string[] },
) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: orderInclude });
  if (!order) throw notFound("Sipariş bulunamadı");
  if (!opts.allowed.includes(order.status)) {
    throw new AppError(
      400,
      "CANNOT_CANCEL",
      opts.by === "customer"
        ? "Hazırlanmaya başlanan siparişler iptal edilemez, iade için destekle iletişime geçin"
        : "Kargoya verilmiş veya sonuçlanmış sipariş iptal edilemez",
    );
  }

  const payment = order.payment;
  const paid = order.status !== "PENDING_PAYMENT";

  // Kartla ödenmişse iade önce sağlayıcıda yapılır; başarısız olursa hiçbir şey değişmez.
  if (paid && order.paymentMethod === "CARD" && payment?.providerRef) {
    await paymentProvider().refund({ providerRef: payment.providerRef, amountCents: order.totalCents });
  }

  const affectedIds = await prisma.$transaction(async (tx) => {
    const ids =
      !paid && payment
        ? (
            await tx.order.findMany({
              where: { paymentId: payment.id, status: "PENDING_PAYMENT" },
              select: { id: true },
            })
          ).map((o) => o.id)
        : [order.id];

    const changed = await tx.order.updateMany({
      where: { id: { in: ids }, status: { in: [...opts.allowed] as never } },
      data: { status: paid ? "REFUNDED" : "CANCELLED", cancelledAt: new Date(), cancelReason: opts.reason },
    });
    if (changed.count !== ids.length)
      throw new AppError(409, "ORDER_CHANGED", "Sipariş durumu değişti, lütfen yenileyin");
    for (const id of ids) await restoreStock(tx, id);

    if (!paid && payment) {
      await tx.payment.updateMany({
        where: { id: payment.id, status: "PENDING" },
        data: { status: "FAILED", failureReason: "Sipariş iptal edildi", completedAt: new Date() },
      });
    } else if (paid && order.paymentMethod === "WALLET" && order.userId) {
      const user = await tx.user.update({
        where: { id: order.userId },
        data: { walletBalanceCents: { increment: order.totalCents } },
      });
      await tx.walletTransaction.create({
        data: {
          userId: order.userId,
          type: "REFUND",
          amountCents: order.totalCents,
          balanceAfterCents: user.walletBalanceCents,
          description: `Sipariş iadesi (${order.orderNumber})`,
          orderId: order.id,
        },
      });
    }
    if (paid && payment) {
      const p = await tx.payment.update({
        where: { id: payment.id },
        data: { refundedCents: { increment: order.totalCents } },
      });
      if (p.refundedCents >= p.amountCents)
        await tx.payment.update({ where: { id: p.id }, data: { status: "REFUNDED" } });
    }
    return ids;
  });

  const updated = await prisma.order.findMany({ where: { id: { in: affectedIds } }, include: orderInclude });
  for (const o of updated) publishOrder(o);
  if (order.userId) {
    await notify(order.userId, {
      type: "order_status",
      title: opts.by === "seller" ? "Siparişiniz satıcı tarafından iptal edildi" : "Siparişiniz iptal edildi",
      body: paid
        ? `${order.orderNumber}: ${formatTL(order.totalCents)} iadeniz ${order.paymentMethod === "WALLET" ? "cüzdanınıza yüklendi" : "kartınıza yapıldı"}.${opts.by === "seller" ? ` Sebep: ${opts.reason}` : ""}`
        : `${order.orderNumber} numaralı siparişiniz iptal edildi.`,
      data: { orderId: order.id },
    });
  }
  return updated.find((o) => o.id === orderId)!;
}
