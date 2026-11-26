import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.ts";
import { pageResult, paginate, parse, zId, zPagination } from "../../lib/validate.ts";
import { AppError, conflict, notFound, unauthorized } from "../../lib/errors.ts";
import { humanCode } from "../../lib/codes.ts";
import { formatTL, toTL } from "../../lib/money.ts";
import { requireAuth, userId } from "../../middleware/auth.ts";
import { loadCart, summarizeCart } from "../cart/service.ts";
import { paymentProvider } from "../payments/providers.ts";
import { restoreStock, serializePayment, startCheckout } from "../payments/service.ts";
import { notify } from "../notifications/notify.ts";
import type { Prisma } from "../../generated/prisma/client.ts";

export const ordersRouter = Router();
ordersRouter.use(requireAuth);

const include = {
  items: true,
  payments: { orderBy: { createdAt: "desc" }, take: 1 },
} satisfies Prisma.OrderInclude;
type OrderRow = Prisma.OrderGetPayload<{ include: typeof include }>;

// Müşteri, sipariş hazırlanmaya başlamadan iptal edebilir.
const CANCELLABLE = ["PENDING_PAYMENT", "PAID"] as const;

function serialize(o: OrderRow) {
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    paymentMethod: o.paymentMethod,
    subtotal: toTL(o.subtotalCents),
    shipping: toTL(o.shippingCents),
    total: toTL(o.totalCents),
    shippingAddress: o.shippingAddress,
    trackingNumber: o.trackingNumber,
    items: o.items.map((i) => ({
      productId: i.productId,
      name: i.nameSnapshot,
      image: i.imageSnapshot,
      unitPrice: toTL(i.unitPriceCents),
      quantity: i.quantity,
      lineTotal: toTL(i.lineTotalCents),
    })),
    itemCount: o.items.reduce((n, i) => n + i.quantity, 0),
    canCancel: (CANCELLABLE as readonly string[]).includes(o.status),
    payment: o.payments[0] ? serializePayment(o.payments[0]) : null,
    paidAt: o.paidAt?.toISOString() ?? null,
    cancelledAt: o.cancelledAt?.toISOString() ?? null,
    createdAt: o.createdAt.toISOString(),
  };
}

const createSchema = z.object({
  addressId: zId,
  paymentMethod: z.enum(["CARD", "WALLET"]),
});

/**
 * Sepetten sipariş oluşturur. Fiyatlar ve kargo SUNUCUDA hesaplanır; istemciden gelen tutara güvenilmez.
 * Stok sipariş anında ayrılır; ödeme başarısız olursa veya zaman aşımına uğrarsa geri bırakılır.
 */
ordersRouter.post("/", async (req, res) => {
  const body = parse(createSchema, req.body);
  const uid = userId(req);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: uid } });
    if (user.deletedAt) throw unauthorized();
    const address = await tx.address.findFirst({ where: { id: body.addressId, userId: uid } });
    if (!address) throw notFound("Teslimat adresi bulunamadı");

    const rows = await loadCart(uid, tx);
    const cart = summarizeCart(rows);
    if (cart.items.length === 0) throw new AppError(400, "EMPTY_CART", "Sepetiniz boş");
    if (cart.warnings.length) {
      throw new AppError(409, "CART_CHANGED", "Sepetinizdeki bazı ürünlerde değişiklik var, lütfen kontrol edin", cart.warnings);
    }

    // Koşullu düşüm: aynı anda iki sipariş son ürünü alamaz.
    for (const row of rows) {
      const updated = await tx.product.updateMany({
        where: { id: row.productId, isActive: true, stock: { gte: row.quantity } },
        data: { stock: { decrement: row.quantity } },
      });
      if (updated.count === 0) throw conflict("INSUFFICIENT_STOCK", `${row.product.name} için yeterli stok kalmadı`);
    }

    const { subtotalCents, shippingCents, totalCents } = cart.totals;
    const order = await tx.order.create({
      data: {
        orderNumber: humanCode("MK", 10),
        userId: uid,
        paymentMethod: body.paymentMethod,
        subtotalCents,
        shippingCents,
        totalCents,
        customerEmail: user.email,
        shippingAddress: {
          title: address.title,
          fullName: address.fullName,
          phone: address.phone,
          city: address.city,
          district: address.district,
          line: address.line,
          postalCode: address.postalCode,
        },
        items: {
          create: rows.map((r) => ({
            productId: r.productId,
            nameSnapshot: r.product.name,
            imageSnapshot: r.product.images[0] ?? null,
            unitPriceCents: r.product.priceCents,
            quantity: r.quantity,
            lineTotalCents: r.product.priceCents * r.quantity,
          })),
        },
      },
    });

    if (body.paymentMethod === "WALLET") {
      const debited = await tx.user.updateMany({
        where: { id: uid, walletBalanceCents: { gte: totalCents } },
        data: { walletBalanceCents: { decrement: totalCents } },
      });
      if (debited.count === 0) {
        throw new AppError(409, "INSUFFICIENT_BALANCE", `Cüzdan bakiyeniz yetersiz. Gereken tutar: ${formatTL(totalCents)}`);
      }
      const after = await tx.user.findUniqueOrThrow({ where: { id: uid }, select: { walletBalanceCents: true } });
      await tx.walletTransaction.create({
        data: {
          userId: uid,
          type: "PAYMENT",
          amountCents: -totalCents,
          balanceAfterCents: after.walletBalanceCents,
          description: `Sipariş ödemesi (${order.orderNumber})`,
          orderId: order.id,
        },
      });
      await tx.order.update({ where: { id: order.id }, data: { status: "PAID", paidAt: new Date() } });
      await tx.cartItem.deleteMany({ where: { userId: uid } });
      return { orderId: order.id, paymentId: undefined };
    }

    const payment = await tx.payment.create({
      data: {
        userId: uid,
        purpose: "ORDER",
        orderId: order.id,
        amountCents: totalCents,
        provider: paymentProvider().name,
      },
    });
    return { orderId: order.id, paymentId: payment.id };
  });

  const checkout = result.paymentId ? await startCheckout(result.paymentId) : undefined;
  const order = await prisma.order.findUniqueOrThrow({ where: { id: result.orderId }, include });
  if (order.status === "PAID") {
    await notify(uid, {
      type: "order_paid",
      title: "Siparişiniz alındı",
      body: `${order.orderNumber} numaralı siparişiniz hazırlanmak üzere sıraya alındı.`,
      data: { orderId: order.id },
    });
  }
  res.status(201).json({ order: serialize(order), checkoutUrl: checkout?.checkoutUrl ?? null });
});

const listSchema = zPagination.extend({
  status: z.enum(["PENDING_PAYMENT", "PAID", "PREPARING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"]).optional(),
});

ordersRouter.get("/", async (req, res) => {
  const q = parse(listSchema, req.query);
  const where: Prisma.OrderWhereInput = { userId: userId(req), ...(q.status ? { status: q.status } : {}) };
  const [rows, total] = await Promise.all([
    prisma.order.findMany({ where, include, orderBy: { createdAt: "desc" }, ...paginate(q.page, q.pageSize) }),
    prisma.order.count({ where }),
  ]);
  res.json(pageResult(rows.map(serialize), total, q.page, q.pageSize));
});

ordersRouter.get("/:id", async (req, res) => {
  const order = await prisma.order.findFirst({ where: { id: parse(zId, req.params.id), userId: userId(req) }, include });
  if (!order) throw notFound("Sipariş bulunamadı");
  res.json({ order: serialize(order) });
});

ordersRouter.post("/:id/cancel", async (req, res) => {
  const id = parse(zId, req.params.id);
  const uid = userId(req);
  const order = await prisma.order.findFirst({ where: { id, userId: uid }, include });
  if (!order) throw notFound("Sipariş bulunamadı");
  if (!(CANCELLABLE as readonly string[]).includes(order.status)) {
    throw new AppError(400, "CANNOT_CANCEL", "Hazırlanmaya başlanan siparişler iptal edilemez, iade için destekle iletişime geçin");
  }

  // Kartla ödenmiş siparişin iadesi önce sağlayıcıda yapılır; başarısız olursa sipariş değişmez.
  const cardPayment = order.payments.find((p) => p.status === "SUCCEEDED");
  if (order.status === "PAID" && order.paymentMethod === "CARD" && cardPayment?.providerRef) {
    await paymentProvider().refund({ providerRef: cardPayment.providerRef, amountCents: cardPayment.amountCents });
  }

  await prisma.$transaction(async (tx) => {
    const changed = await tx.order.updateMany({
      where: { id, status: { in: [...CANCELLABLE] } },
      data: { status: order.status === "PAID" ? "REFUNDED" : "CANCELLED", cancelledAt: new Date() },
    });
    if (changed.count === 0) throw new AppError(409, "ORDER_CHANGED", "Sipariş durumu değişti, lütfen yenileyin");
    await restoreStock(tx, id);

    if (order.status === "PENDING_PAYMENT") {
      await tx.payment.updateMany({
        where: { orderId: id, status: "PENDING" },
        data: { status: "FAILED", failureReason: "Sipariş iptal edildi", completedAt: new Date() },
      });
    } else if (order.paymentMethod === "WALLET") {
      const user = await tx.user.update({
        where: { id: uid },
        data: { walletBalanceCents: { increment: order.totalCents } },
      });
      await tx.walletTransaction.create({
        data: {
          userId: uid,
          type: "REFUND",
          amountCents: order.totalCents,
          balanceAfterCents: user.walletBalanceCents,
          description: `Sipariş iadesi (${order.orderNumber})`,
          orderId: id,
        },
      });
    } else if (cardPayment) {
      await tx.payment.update({ where: { id: cardPayment.id }, data: { status: "REFUNDED" } });
    }
  });

  const updated = await prisma.order.findUniqueOrThrow({ where: { id }, include });
  await notify(uid, {
    type: "order_status",
    title: "Siparişiniz iptal edildi",
    body:
      order.status === "PAID"
        ? `${order.orderNumber}: ${formatTL(order.totalCents)} iadeniz ${order.paymentMethod === "WALLET" ? "cüzdanınıza yüklendi" : "kartınıza yapıldı"}.`
        : `${order.orderNumber} numaralı siparişiniz iptal edildi.`,
    data: { orderId: id },
  });
  res.json({ order: serialize(updated) });
});
