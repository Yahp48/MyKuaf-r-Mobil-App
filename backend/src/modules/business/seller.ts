import { Router } from "express";
import { z } from "zod";
import { DateTime } from "luxon";
import { prisma } from "../../lib/prisma.ts";
import { pageResult, paginate, parse, zId, zPagination } from "../../lib/validate.ts";
import { AppError, notFound } from "../../lib/errors.ts";
import { fromTL, toTL } from "../../lib/money.ts";
import { shortName } from "../../lib/names.ts";
import { requireAuth } from "../../middleware/auth.ts";
import { businessOf, requireBusiness } from "../../middleware/business.ts";
import { broadcast } from "../../realtime/socket.ts";
import { notify } from "../notifications/notify.ts";
import { SELLER_CANCELLABLE, cancelOrder, orderInclude, publishOrder, serializeOrder } from "../orders/service.ts";
import type { Prisma } from "../../generated/prisma/client.ts";

/** Ürün satıcısı paneli: /api/business/seller */
export const sellerPanelRouter = Router();
sellerPanelRouter.use(requireAuth, requireBusiness("SELLER"));

const TZ = "Europe/Istanbul";
const LOW_STOCK = 5;
// Ciroya sayılan siparişler (ödenmiş ve iade edilmemiş)
const REVENUE_STATUSES = ["PAID", "PREPARING", "SHIPPED", "DELIVERED"] as const;

const catalogChanged = (productId: string) => broadcast("catalog:changed", { productId });

// ───────────── Özet ─────────────

sellerPanelRouter.get("/overview", async (req, res) => {
  const b = businessOf(req);
  const now = DateTime.now().setZone(TZ);
  const today = now.startOf("day");
  const start30 = today.minus({ days: 29 });

  const [orders30, toShip, lowStock, topItems, statusCounts, productCount] = await Promise.all([
    prisma.order.findMany({
      where: { sellerId: b.id, status: { in: [...REVENUE_STATUSES] }, paidAt: { gte: start30.toJSDate() } },
      select: { paidAt: true, totalCents: true },
    }),
    prisma.order.count({ where: { sellerId: b.id, status: { in: ["PAID", "PREPARING"] } } }),
    prisma.product.findMany({
      where: { sellerId: b.id, isActive: true, stock: { lte: LOW_STOCK } },
      orderBy: { stock: "asc" },
      take: 8,
      select: { id: true, name: true, stock: true, images: true },
    }),
    prisma.orderItem.groupBy({
      by: ["productId", "nameSnapshot"],
      where: { order: { sellerId: b.id, status: { in: [...REVENUE_STATUSES] }, paidAt: { gte: start30.toJSDate() } } },
      _sum: { quantity: true, lineTotalCents: true },
      orderBy: { _sum: { lineTotalCents: "desc" } },
      take: 5,
    }),
    prisma.order.groupBy({ by: ["status"], where: { sellerId: b.id }, _count: true }),
    prisma.product.count({ where: { sellerId: b.id, isActive: true } }),
  ]);

  const byDay = new Map<string, { revenue: number; orders: number }>();
  for (const o of orders30) {
    const k = DateTime.fromJSDate(o.paidAt!).setZone(TZ).toFormat("yyyy-MM-dd");
    const cur = byDay.get(k) ?? { revenue: 0, orders: 0 };
    cur.revenue += o.totalCents;
    cur.orders += 1;
    byDay.set(k, cur);
  }
  const series = Array.from({ length: 30 }, (_, i) => {
    const d = start30.plus({ days: i }).toFormat("yyyy-MM-dd");
    return { date: d, revenue: toTL(byDay.get(d)?.revenue ?? 0), orders: byDay.get(d)?.orders ?? 0 };
  });
  const sum = (from: DateTime) =>
    orders30.filter((o) => o.paidAt! >= from.toJSDate()).reduce((n, o) => n + o.totalCents, 0);
  const revenue30 = sum(start30);
  const count30 = orders30.length;

  res.json({
    kpis: {
      revenueToday: toTL(sum(today)),
      revenue7d: toTL(sum(today.minus({ days: 6 }))),
      revenue30d: toTL(revenue30),
      orders30d: count30,
      averageOrder: toTL(count30 ? Math.round(revenue30 / count30) : 0),
      toShip,
      activeProducts: productCount,
    },
    series,
    statusCounts: Object.fromEntries(statusCounts.map((s) => [s.status, s._count])),
    lowStock: lowStock.map((p) => ({ id: p.id, name: p.name, stock: p.stock, image: p.images[0] ?? null })),
    topProducts: topItems.map((t) => ({
      productId: t.productId,
      name: t.nameSnapshot,
      quantity: t._sum.quantity ?? 0,
      revenue: toTL(t._sum.lineTotalCents ?? 0),
    })),
  });
});

// ───────────── Siparişler ─────────────

const ordersQuery = zPagination.extend({
  status: z.enum(["PENDING_PAYMENT", "PAID", "PREPARING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"]).optional(),
  tab: z.enum(["action", "shipped", "closed", "all"]).default("all"),
  q: z.string().trim().max(80).optional(),
});

sellerPanelRouter.get("/orders", async (req, res) => {
  const b = businessOf(req);
  const q = parse(ordersQuery, req.query);
  const tabStatuses: Record<string, Prisma.OrderWhereInput> = {
    action: { status: { in: ["PAID", "PREPARING"] } },
    shipped: { status: "SHIPPED" },
    closed: { status: { in: ["DELIVERED", "CANCELLED", "REFUNDED"] } },
    // Ödemesi tamamlanmamış siparişler satıcıya gösterilmez (stok ayrıldı ama satış kesin değil)
    all: { status: { not: "PENDING_PAYMENT" } },
  };
  const where: Prisma.OrderWhereInput = {
    sellerId: b.id,
    ...(q.status ? { status: q.status } : tabStatuses[q.tab]),
    ...(q.q
      ? {
          OR: [
            { orderNumber: { contains: q.q.toUpperCase() } },
            { customerEmail: { contains: q.q, mode: "insensitive" } },
            { items: { some: { nameSnapshot: { contains: q.q, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };
  const [rows, total, counts] = await Promise.all([
    prisma.order.findMany({
      where,
      include: orderInclude,
      orderBy: [{ paidAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      ...paginate(q.page, q.pageSize),
    }),
    prisma.order.count({ where }),
    prisma.order.groupBy({ by: ["status"], where: { sellerId: b.id }, _count: true }),
  ]);
  const c = Object.fromEntries(counts.map((x) => [x.status, x._count])) as Record<string, number>;
  res.json({
    ...pageResult(rows.map(serializeOrder), total, q.page, q.pageSize),
    tabCounts: {
      action: (c.PAID ?? 0) + (c.PREPARING ?? 0),
      shipped: c.SHIPPED ?? 0,
      closed: (c.DELIVERED ?? 0) + (c.CANCELLED ?? 0) + (c.REFUNDED ?? 0),
    },
  });
});

async function ownOrder(sellerId: string, id: string) {
  const o = await prisma.order.findFirst({ where: { id, sellerId }, include: orderInclude });
  if (!o) throw notFound("Sipariş bulunamadı");
  return o;
}

sellerPanelRouter.get("/orders/:id", async (req, res) => {
  const b = businessOf(req);
  const o = await ownOrder(b.id, parse(zId, req.params.id));
  if (o.status === "PENDING_PAYMENT") throw notFound("Sipariş bulunamadı");
  res.json({ order: { ...serializeOrder(o), customerEmail: o.customerEmail } });
});

const CARRIERS = [
  "Yurtiçi Kargo",
  "Aras Kargo",
  "MNG Kargo",
  "PTT Kargo",
  "Sürat Kargo",
  "UPS",
  "DHL",
  "Trendyol Express",
  "HepsiJET",
  "Diğer",
] as const;

const statusSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("PREPARING") }),
  z.object({
    status: z.literal("SHIPPED"),
    carrier: z.enum(CARRIERS, { message: "Kargo firması seçin" }),
    trackingNumber: z.string().trim().min(5, "Takip numarası en az 5 karakter").max(40),
  }),
  z.object({ status: z.literal("DELIVERED") }),
]);

const NEXT: Record<string, string[]> = {
  PAID: ["PREPARING", "SHIPPED"],
  PREPARING: ["SHIPPED"],
  SHIPPED: ["DELIVERED"],
};

sellerPanelRouter.post("/orders/:id/status", async (req, res) => {
  const b = businessOf(req);
  const id = parse(zId, req.params.id);
  const body = parse(statusSchema, req.body);
  const o = await ownOrder(b.id, id);
  if (!NEXT[o.status]?.includes(body.status))
    throw new AppError(400, "INVALID_TRANSITION", "Sipariş bu duruma geçirilemez");

  const changed = await prisma.order.updateMany({
    where: { id, status: o.status },
    data: {
      status: body.status,
      ...(body.status === "SHIPPED"
        ? { carrier: body.carrier, trackingNumber: body.trackingNumber, shippedAt: new Date() }
        : {}),
      ...(body.status === "DELIVERED" ? { deliveredAt: new Date() } : {}),
    },
  });
  if (!changed.count) throw new AppError(409, "ORDER_CHANGED", "Sipariş durumu değişti, lütfen yenileyin");
  const updated = await ownOrder(b.id, id);
  publishOrder(updated);
  if (o.userId) {
    const msg = {
      PREPARING: {
        title: "Siparişiniz hazırlanıyor",
        body: `${o.orderNumber} · ${b.displayName} siparişinizi hazırlıyor.`,
      },
      SHIPPED: {
        title: "Siparişiniz kargoya verildi",
        body: `${o.orderNumber} · ${updated.carrier} takip no: ${updated.trackingNumber}`,
      },
      DELIVERED: { title: "Siparişiniz teslim edildi", body: `${o.orderNumber} · Ürünleri değerlendirmeyi unutmayın.` },
    }[body.status];
    await notify(o.userId, { type: "order_status", ...msg, data: { orderId: id } });
  }
  res.json({ order: serializeOrder(updated) });
});

const cancelSchema = z.object({ reason: z.string().trim().min(3, "İptal sebebi yazın (müşteriye iletilir)").max(300) });

sellerPanelRouter.post("/orders/:id/cancel", async (req, res) => {
  const b = businessOf(req);
  const id = parse(zId, req.params.id);
  const { reason } = parse(cancelSchema, req.body);
  await ownOrder(b.id, id);
  const order = await cancelOrder(id, { by: "seller", reason, allowed: SELLER_CANCELLABLE });
  res.json({ order: serializeOrder(order) });
});

sellerPanelRouter.get("/carriers", (_req, res) => {
  res.json({ items: CARRIERS });
});

// ───────────── Ürünler ─────────────

const productSchema = z.object({
  name: z.string().trim().min(3, "Ürün adı en az 3 karakter").max(150),
  description: z.string().trim().max(5000).nullable().optional(),
  brand: z.string().trim().max(60).nullable().optional(),
  sku: z.string().trim().max(60).nullable().optional(),
  categoryId: zId,
  price: z.number().positive("Fiyat sıfırdan büyük olmalı").max(1_000_000).multipleOf(0.01),
  compareAtPrice: z.number().positive().max(1_000_000).multipleOf(0.01).nullable().optional(),
  stock: z.number().int().min(0).max(1_000_000),
  images: z.array(z.string().url().max(500)).max(8, "En fazla 8 görsel").default([]),
  features: z.array(z.string().trim().min(1).max(120)).max(12).default([]),
  isActive: z.boolean().default(true),
});

const sellerProductInclude = { category: { select: { id: true, name: true } } } as const;
type SellerProduct = Prisma.ProductGetPayload<{ include: typeof sellerProductInclude }>;

const serializeSellerProduct = (p: SellerProduct, sold?: number) => ({
  id: p.id,
  name: p.name,
  description: p.description,
  brand: p.brand,
  sku: p.sku,
  category: p.category,
  price: toTL(p.priceCents),
  compareAtPrice: p.compareAtPriceCents ? toTL(p.compareAtPriceCents) : null,
  stock: p.stock,
  images: p.images,
  features: p.features,
  isActive: p.isActive,
  rating: Math.round(p.ratingAvg * 10) / 10,
  ratingCount: p.ratingCount,
  ...(sold !== undefined ? { sold30d: sold } : {}),
  createdAt: p.createdAt.toISOString(),
  updatedAt: p.updatedAt.toISOString(),
});

function slugify(s: string) {
  const map: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" };
  return s
    .toLocaleLowerCase("tr-TR")
    .replace(/[çğıöşü]/g, (c) => map[c]!)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function priceData(p: { price?: number; compareAtPrice?: number | null }) {
  if (p.compareAtPrice != null && p.price !== undefined && p.compareAtPrice <= p.price) {
    throw new AppError(400, "INVALID_COMPARE_PRICE", "İndirim öncesi fiyat, satış fiyatından yüksek olmalı");
  }
  return {
    ...(p.price !== undefined ? { priceCents: fromTL(p.price) } : {}),
    ...(p.compareAtPrice !== undefined
      ? { compareAtPriceCents: p.compareAtPrice === null ? null : fromTL(p.compareAtPrice) }
      : {}),
  };
}

sellerPanelRouter.get("/categories", async (_req, res) => {
  const rows = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  res.json({ items: rows.map((c) => ({ id: c.id, name: c.name })) });
});

const productsQuery = zPagination.extend({
  q: z.string().trim().max(80).optional(),
  filter: z.enum(["all", "active", "inactive", "low", "out"]).default("all"),
  sort: z.enum(["updated", "name", "stock", "price"]).default("updated"),
});

sellerPanelRouter.get("/products", async (req, res) => {
  const b = businessOf(req);
  const q = parse(productsQuery, req.query);
  const filters: Record<string, Prisma.ProductWhereInput> = {
    all: {},
    active: { isActive: true },
    inactive: { isActive: false },
    low: { isActive: true, stock: { gt: 0, lte: LOW_STOCK } },
    out: { stock: 0 },
  };
  const where: Prisma.ProductWhereInput = {
    sellerId: b.id,
    ...filters[q.filter],
    ...(q.q
      ? {
          OR: [
            { name: { contains: q.q, mode: "insensitive" } },
            { sku: { contains: q.q, mode: "insensitive" } },
            { brand: { contains: q.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const orderBy: Prisma.ProductOrderByWithRelationInput = {
    updated: { updatedAt: "desc" as const },
    name: { name: "asc" as const },
    stock: { stock: "asc" as const },
    price: { priceCents: "desc" as const },
  }[q.sort];
  const [rows, total] = await Promise.all([
    prisma.product.findMany({ where, include: sellerProductInclude, orderBy, ...paginate(q.page, q.pageSize) }),
    prisma.product.count({ where }),
  ]);
  const sold = await prisma.orderItem.groupBy({
    by: ["productId"],
    where: {
      productId: { in: rows.map((r) => r.id) },
      order: { status: { in: [...REVENUE_STATUSES] }, paidAt: { gte: DateTime.now().minus({ days: 30 }).toJSDate() } },
    },
    _sum: { quantity: true },
  });
  res.json(
    pageResult(
      rows.map((p) => serializeSellerProduct(p, sold.find((s) => s.productId === p.id)?._sum.quantity ?? 0)),
      total,
      q.page,
      q.pageSize,
    ),
  );
});

async function ownProduct(sellerId: string, id: string) {
  const p = await prisma.product.findFirst({ where: { id, sellerId }, include: sellerProductInclude });
  if (!p) throw notFound("Ürün bulunamadı");
  return p;
}

sellerPanelRouter.get("/products/:id", async (req, res) => {
  const b = businessOf(req);
  res.json({ product: serializeSellerProduct(await ownProduct(b.id, parse(zId, req.params.id))) });
});

sellerPanelRouter.post("/products", async (req, res) => {
  const b = businessOf(req);
  const { price, compareAtPrice, ...rest } = parse(productSchema, req.body);
  if (!(await prisma.category.findFirst({ where: { id: rest.categoryId, isActive: true } })))
    throw notFound("Kategori bulunamadı");
  const p = await prisma.product.create({
    data: {
      ...rest,
      ...priceData({ price, compareAtPrice }),
      priceCents: fromTL(price),
      sellerId: b.id,
      slug: `${slugify(rest.name)}-${Date.now().toString(36)}`,
    },
    include: sellerProductInclude,
  });
  catalogChanged(p.id);
  res.status(201).json({ product: serializeSellerProduct(p) });
});

sellerPanelRouter.patch("/products/:id", async (req, res) => {
  const b = businessOf(req);
  const id = parse(zId, req.params.id);
  const { price, compareAtPrice, ...rest } = parse(productSchema.partial(), req.body);
  const current = await ownProduct(b.id, id);
  if (rest.categoryId && !(await prisma.category.findFirst({ where: { id: rest.categoryId, isActive: true } }))) {
    throw notFound("Kategori bulunamadı");
  }
  const p = await prisma.product.update({
    where: { id },
    data: {
      ...rest,
      ...priceData({
        price: price ?? toTL(current.priceCents),
        compareAtPrice: compareAtPrice === undefined ? undefined : compareAtPrice,
      }),
    },
    include: sellerProductInclude,
  });
  catalogChanged(p.id);
  res.json({ product: serializeSellerProduct(p) });
});

const stockSchema = z.object({ stock: z.number().int().min(0).max(1_000_000) });

sellerPanelRouter.patch("/products/:id/stock", async (req, res) => {
  const b = businessOf(req);
  const id = parse(zId, req.params.id);
  const { stock } = parse(stockSchema, req.body);
  await ownProduct(b.id, id);
  const p = await prisma.product.update({ where: { id }, data: { stock }, include: sellerProductInclude });
  catalogChanged(p.id);
  res.json({ product: serializeSellerProduct(p) });
});

/** Satılmış ürün silinmez (sipariş geçmişi), satıştan kaldırılır. */
sellerPanelRouter.delete("/products/:id", async (req, res) => {
  const b = businessOf(req);
  const id = parse(zId, req.params.id);
  await ownProduct(b.id, id);
  const sold = await prisma.orderItem.count({ where: { productId: id } });
  if (sold) await prisma.product.update({ where: { id }, data: { isActive: false } });
  else await prisma.product.delete({ where: { id } });
  catalogChanged(id);
  res.json({ deleted: !sold, deactivated: !!sold });
});

// ───────────── Yorumlar ─────────────

sellerPanelRouter.get("/reviews", async (req, res) => {
  const b = businessOf(req);
  const { page, pageSize } = parse(zPagination, req.query);
  const where = { product: { sellerId: b.id } };
  const [rows, total, agg] = await Promise.all([
    prisma.productReview.findMany({
      where,
      include: { user: { select: { name: true, deletedAt: true } }, product: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      ...paginate(page, pageSize),
    }),
    prisma.productReview.count({ where }),
    prisma.productReview.aggregate({ where, _avg: { rating: true } }),
  ]);
  res.json({
    ...pageResult(
      rows.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        product: r.product,
        authorName: !r.user || r.user.deletedAt ? "Anonim" : shortName(r.user.name),
        createdAt: r.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    ),
    average: Math.round((agg._avg.rating ?? 0) * 10) / 10,
  });
});

// ───────────── Finans ─────────────

sellerPanelRouter.get("/finance", async (req, res) => {
  const b = businessOf(req);
  const { month } = parse(z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) }), req.query);
  const start = DateTime.fromISO(`${month}-01`, { zone: TZ });
  const end = start.plus({ months: 1 });
  const orders = await prisma.order.findMany({
    where: { sellerId: b.id, paidAt: { gte: start.toJSDate(), lt: end.toJSDate() } },
    select: {
      orderNumber: true,
      status: true,
      totalCents: true,
      shippingCents: true,
      subtotalCents: true,
      paidAt: true,
    },
    orderBy: { paidAt: "desc" },
  });
  const gross = orders.reduce((n, o) => n + o.totalCents, 0);
  const refunded = orders.filter((o) => o.status === "REFUNDED").reduce((n, o) => n + o.totalCents, 0);
  const shipping = orders.filter((o) => o.status !== "REFUNDED").reduce((n, o) => n + o.shippingCents, 0);
  const days = start.daysInMonth!;
  const daily = Array.from({ length: days }, (_, i) => ({
    date: start.plus({ days: i }).toFormat("yyyy-MM-dd"),
    sales: 0,
    refunds: 0,
  }));
  for (const o of orders) {
    const d = DateTime.fromJSDate(o.paidAt!).setZone(TZ).day - 1;
    if (o.status === "REFUNDED") daily[d]!.refunds += o.totalCents;
    else daily[d]!.sales += o.totalCents;
  }
  res.json({
    month,
    totals: {
      gross: toTL(gross),
      refunded: toTL(refunded),
      net: toTL(gross - refunded),
      shippingCollected: toTL(shipping),
      orderCount: orders.length,
      refundCount: orders.filter((o) => o.status === "REFUNDED").length,
    },
    daily: daily.map((d) => ({ date: d.date, sales: toTL(d.sales), refunds: toTL(d.refunds) })),
    orders: orders.slice(0, 100).map((o) => ({
      orderNumber: o.orderNumber,
      status: o.status,
      total: toTL(o.totalCents),
      paidAt: o.paidAt!.toISOString(),
    })),
  });
});
