import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.ts";
import { pageResult, paginate, parse, zId, zPagination } from "../../lib/validate.ts";
import { AppError, conflict, notFound, unauthorized } from "../../lib/errors.ts";
import { humanCode } from "../../lib/codes.ts";
import { formatTL } from "../../lib/money.ts";
import { requireAuth, userId } from "../../middleware/auth.ts";
import { loadCart, summarizeCart } from "../cart/service.ts";
import { paymentProvider } from "../payments/providers.ts";
import { serializePayment, startCheckout, zReturnUrl } from "../payments/service.ts";
import { notify } from "../notifications/notify.ts";
import { emitToBusiness } from "../../realtime/socket.ts";
import { CUSTOMER_CANCELLABLE, cancelOrder, orderInclude, serializeOrder } from "./service.ts";
import type { Prisma } from "../../generated/prisma/client.ts";

export const ordersRouter = Router();
ordersRouter.use(requireAuth);

const createSchema = z.object({
  addressId: zId,
  paymentMethod: z.enum(["CARD", "WALLET"]),
  returnUrl: zReturnUrl.optional(),
});

/**
 * Sepetten sipariş oluşturur. Fiyatlar ve kargo SUNUCUDA hesaplanır; istemciden gelen tutara güvenilmez.
 * Çok satıcılı sepet satıcı başına ayrı siparişe bölünür, tek ödemeyle alınır.
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
      throw new AppError(
        409,
        "CART_CHANGED",
        "Sepetinizdeki bazı ürünlerde değişiklik var, lütfen kontrol edin",
        cart.warnings,
      );
    }

    // Koşullu düşüm: aynı anda iki sipariş son ürünü alamaz.
    for (const row of rows) {
      const updated = await tx.product.updateMany({
        where: { id: row.productId, isActive: true, stock: { gte: row.quantity } },
        data: { stock: { decrement: row.quantity } },
      });
      if (updated.count === 0) throw conflict("INSUFFICIENT_STOCK", `${row.product.name} için yeterli stok kalmadı`);
    }

    const { totalCents } = cart.totals;
    const payment =
      body.paymentMethod === "CARD"
        ? await tx.payment.create({
            data: {
              userId: uid,
              purpose: "ORDER",
              amountCents: totalCents,
              provider: paymentProvider().name,
              returnUrl: body.returnUrl,
            },
          })
        : null;

    const shippingAddress = {
      title: address.title,
      fullName: address.fullName,
      phone: address.phone,
      city: address.city,
      district: address.district,
      line: address.line,
      postalCode: address.postalCode,
    };
    const orderIds: string[] = [];
    for (const g of cart.groups) {
      const order = await tx.order.create({
        data: {
          orderNumber: humanCode("MK", 10),
          userId: uid,
          sellerId: g.seller.id,
          paymentId: payment?.id,
          paymentMethod: body.paymentMethod,
          subtotalCents: g.subtotalCents,
          shippingCents: g.shippingCents,
          totalCents: g.subtotalCents + g.shippingCents,
          customerEmail: user.email,
          shippingAddress,
          items: {
            create: g.rows.map((r) => ({
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
      orderIds.push(order.id);
    }

    if (body.paymentMethod === "WALLET") {
      const debited = await tx.user.updateMany({
        where: { id: uid, walletBalanceCents: { gte: totalCents } },
        data: { walletBalanceCents: { decrement: totalCents } },
      });
      if (debited.count === 0) {
        throw new AppError(
          409,
          "INSUFFICIENT_BALANCE",
          `Cüzdan bakiyeniz yetersiz. Gereken tutar: ${formatTL(totalCents)}`,
        );
      }
      const after = await tx.user.findUniqueOrThrow({ where: { id: uid }, select: { walletBalanceCents: true } });
      const orders = await tx.order.findMany({ where: { id: { in: orderIds } } });
      let balance = after.walletBalanceCents + totalCents;
      for (const o of orders) {
        balance -= o.totalCents;
        await tx.walletTransaction.create({
          data: {
            userId: uid,
            type: "PAYMENT",
            amountCents: -o.totalCents,
            balanceAfterCents: balance,
            description: `Sipariş ödemesi (${o.orderNumber})`,
            orderId: o.id,
          },
        });
      }
      await tx.order.updateMany({ where: { id: { in: orderIds } }, data: { status: "PAID", paidAt: new Date() } });
      await tx.cartItem.deleteMany({ where: { userId: uid } });
    }
    return { orderIds, paymentId: payment?.id };
  });

  const checkout = result.paymentId ? await startCheckout(result.paymentId) : undefined;
  const orders = await prisma.order.findMany({ where: { id: { in: result.orderIds } }, include: orderInclude });
  if (body.paymentMethod === "WALLET") {
    for (const o of orders) emitToBusiness(o.sellerId, "order:new", serializeOrder(o));
    await notify(uid, {
      type: "order_paid",
      title: "Siparişiniz alındı",
      body:
        orders.length > 1
          ? `${orders.length} ayrı satıcıdan siparişleriniz hazırlanmak üzere sıraya alındı.`
          : `${orders[0]!.orderNumber} numaralı siparişiniz hazırlanmak üzere sıraya alındı.`,
      data: { orderId: orders[0]!.id },
    });
  }
  const payment = result.paymentId ? await prisma.payment.findUnique({ where: { id: result.paymentId } }) : null;
  res.status(201).json({
    orders: orders.map(serializeOrder),
    payment: payment ? serializePayment(payment) : null,
    checkoutUrl: checkout?.checkoutUrl ?? null,
  });
});

const listSchema = zPagination.extend({
  status: z.enum(["PENDING_PAYMENT", "PAID", "PREPARING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"]).optional(),
});

ordersRouter.get("/", async (req, res) => {
  const q = parse(listSchema, req.query);
  const where: Prisma.OrderWhereInput = { userId: userId(req), ...(q.status ? { status: q.status } : {}) };
  const [rows, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: orderInclude,
      orderBy: { createdAt: "desc" },
      ...paginate(q.page, q.pageSize),
    }),
    prisma.order.count({ where }),
  ]);
  res.json(pageResult(rows.map(serializeOrder), total, q.page, q.pageSize));
});

ordersRouter.get("/:id", async (req, res) => {
  const order = await prisma.order.findFirst({
    where: { id: parse(zId, req.params.id), userId: userId(req) },
    include: orderInclude,
  });
  if (!order) throw notFound("Sipariş bulunamadı");
  res.json({ order: serializeOrder(order) });
});

ordersRouter.post("/:id/cancel", async (req, res) => {
  const id = parse(zId, req.params.id);
  const owned = await prisma.order.findFirst({ where: { id, userId: userId(req) }, select: { id: true } });
  if (!owned) throw notFound("Sipariş bulunamadı");
  const order = await cancelOrder(id, { by: "customer", reason: "Müşteri iptal etti", allowed: CUSTOMER_CANCELLABLE });
  res.json({ order: serializeOrder(order) });
});
