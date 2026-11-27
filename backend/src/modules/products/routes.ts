import { Router } from "express";
import { sellableProductWhere } from "../../lib/visibility.ts";
import { z } from "zod";
import { prisma } from "../../lib/prisma.ts";
import { pageResult, paginate, parse, zId, zPagination } from "../../lib/validate.ts";
import { AppError, notFound } from "../../lib/errors.ts";
import { optionalAuth, requireAuth, userId } from "../../middleware/auth.ts";
import { productInclude, serializeProduct } from "./serialize.ts";
import { badgesFor, productMetrics } from "./metrics.ts";
import { shortName } from "../../lib/names.ts";
import type { Prisma } from "../../generated/prisma/client.ts";

export const productsRouter = Router();

async function favoriteSet(uid: string | undefined, productIds: string[]) {
  if (!uid || !productIds.length) return undefined;
  const rows = await prisma.favoriteProduct.findMany({
    where: { userId: uid, productId: { in: productIds } },
    select: { productId: true },
  });
  return new Set(rows.map((r) => r.productId));
}

productsRouter.get("/categories", async (_req, res) => {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, slug: true, name: true, _count: { select: { products: { where: sellableProductWhere } } } },
  });
  res.json({
    items: categories.map((c) => ({ id: c.id, slug: c.slug, name: c.name, productCount: c._count.products })),
  });
});

const listSchema = zPagination.extend({
  q: z.string().trim().max(80).optional(),
  category: z.string().trim().max(60).optional(),
  featured: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  inStock: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  sort: z.enum(["newest", "price_asc", "price_desc", "rating", "popular", "best_selling"]).default("newest"),
  seller: zId.optional(),
  brands: z
    .union([z.string(), z.array(z.string())])
    .transform((v) =>
      (Array.isArray(v) ? v : v.split(","))
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 20),
    )
    .optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  onSale: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
});

const ORDER_BY: Record<string, Prisma.ProductOrderByWithRelationInput[]> = {
  newest: [{ createdAt: "desc" }],
  price_asc: [{ priceCents: "asc" }],
  price_desc: [{ priceCents: "desc" }],
  rating: [{ ratingAvg: "desc" }, { ratingCount: "desc" }],
  popular: [{ ratingCount: "desc" }, { ratingAvg: "desc" }],
};

productsRouter.get("/", optionalAuth, async (req, res) => {
  const q = parse(listSchema, req.query);
  const where: Prisma.ProductWhereInput = {
    ...sellableProductWhere,
    category: { isActive: true, ...(q.category ? { slug: q.category } : {}) },
    ...(q.featured !== undefined ? { isFeatured: q.featured } : {}),
    ...(q.inStock ? { stock: { gt: 0 } } : {}),
    ...(q.seller ? { sellerId: q.seller } : {}),
    ...(q.brands?.length ? { brand: { in: q.brands } } : {}),
    ...(q.minPrice !== undefined || q.maxPrice !== undefined
      ? {
          priceCents: {
            ...(q.minPrice !== undefined ? { gte: Math.round(q.minPrice * 100) } : {}),
            ...(q.maxPrice !== undefined ? { lte: Math.round(q.maxPrice * 100) } : {}),
          },
        }
      : {}),
    ...(q.onSale ? { compareAtPriceCents: { not: null } } : {}),
    ...(q.q
      ? {
          OR: [
            { name: { contains: q.q, mode: "insensitive" } },
            { brand: { contains: q.q, mode: "insensitive" } },
            { description: { contains: q.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const metrics = await productMetrics();
  let rows;
  let total: number;
  if (q.sort === "best_selling") {
    // Son 30 günün satış adedine göre: önce sıralanır, sonra sayfa kesilir.
    const all = await prisma.product.findMany({ where, select: { id: true, createdAt: true } });
    total = all.length;
    const { skip, take } = paginate(q.page, q.pageSize);
    const ids = all
      .sort((a, b) => (metrics.sold.get(b.id) ?? 0) - (metrics.sold.get(a.id) ?? 0) || +b.createdAt - +a.createdAt)
      .slice(skip, skip + take)
      .map((p) => p.id);
    const found = await prisma.product.findMany({ where: { id: { in: ids } }, include: productInclude });
    rows = ids.flatMap((id) => found.filter((p) => p.id === id));
  } else {
    [rows, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: productInclude,
        orderBy: [...ORDER_BY[q.sort]!, { id: "asc" }],
        ...paginate(q.page, q.pageSize),
      }),
      prisma.product.count({ where }),
    ]);
  }
  const favs = await favoriteSet(
    req.user?.id,
    rows.map((r) => r.id),
  );
  res.json(
    pageResult(
      rows.map((p) => serializeProduct(p, { isFavorite: favs?.has(p.id), badges: badgesFor(p, metrics) })),
      total,
      q.page,
      q.pageSize,
    ),
  );
});

/** Filtre için markalar (yalnızca satışta ürünü olanlar). */
productsRouter.get("/brands", async (req, res) => {
  const { seller } = parse(z.object({ seller: zId.optional() }), req.query);
  const rows = await prisma.product.groupBy({
    by: ["brand"],
    where: { ...sellableProductWhere, brand: { not: null }, ...(seller ? { sellerId: seller } : {}) },
    _count: true,
  });
  res.json({
    items: rows
      .map((r) => ({ name: r.brand!, productCount: r._count }))
      .sort((a, b) => b.productCount - a.productCount || a.name.localeCompare(b.name, "tr")),
  });
});

productsRouter.get("/:id", optionalAuth, async (req, res) => {
  const id = parse(zId, req.params.id);
  const product = await prisma.product.findFirst({ where: { id, ...sellableProductWhere }, include: productInclude });
  if (!product) throw notFound("Ürün bulunamadı");
  const [favs, metrics] = await Promise.all([favoriteSet(req.user?.id, [id]), productMetrics()]);
  res.json({ product: serializeProduct(product, { isFavorite: favs?.has(id), badges: badgesFor(product, metrics) }) });
});

productsRouter.get("/:id/related", optionalAuth, async (req, res) => {
  const id = parse(zId, req.params.id);
  const product = await prisma.product.findFirst({ where: { id, ...sellableProductWhere } });
  if (!product) throw notFound("Ürün bulunamadı");
  const rows = await prisma.product.findMany({
    where: { ...sellableProductWhere, categoryId: product.categoryId, id: { not: id } },
    include: productInclude,
    orderBy: [{ ratingAvg: "desc" }, { createdAt: "desc" }],
    take: 8,
  });
  const favs = await favoriteSet(
    req.user?.id,
    rows.map((r) => r.id),
  );
  res.json({ items: rows.map((p) => serializeProduct(p, { isFavorite: favs?.has(p.id) })) });
});

productsRouter.get("/:id/reviews", async (req, res) => {
  const id = parse(zId, req.params.id);
  const { page, pageSize } = parse(zPagination, req.query);
  const [rows, total] = await Promise.all([
    prisma.productReview.findMany({
      where: { productId: id },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true, deletedAt: true } } },
      ...paginate(page, pageSize),
    }),
    prisma.productReview.count({ where: { productId: id } }),
  ]);
  res.json(
    pageResult(
      rows.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        authorName: !r.user || r.user.deletedAt ? "Anonim" : shortName(r.user.name),
        createdAt: r.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    ),
  );
});

const reviewSchema = z.object({
  rating: z.number().int().min(1, "Puan 1-5 arası olmalı").max(5, "Puan 1-5 arası olmalı"),
  comment: z.string().trim().max(1000).optional(),
});

// Sahte yorumları önlemek için yalnızca ürünü teslim almış kullanıcılar yorum yapabilir.
productsRouter.post("/:id/reviews", requireAuth, async (req, res) => {
  const productId = parse(zId, req.params.id);
  const body = parse(reviewSchema, req.body);
  const uid = userId(req);

  const purchased = await prisma.orderItem.findFirst({
    where: { productId, order: { userId: uid, status: "DELIVERED" } },
  });
  if (!purchased) {
    throw new AppError(403, "NOT_PURCHASED", "Yalnızca satın alıp teslim aldığınız ürünleri değerlendirebilirsiniz");
  }
  const existing = await prisma.productReview.findUnique({ where: { productId_userId: { productId, userId: uid } } });
  if (existing) throw new AppError(409, "ALREADY_REVIEWED", "Bu ürünü zaten değerlendirdiniz");

  const review = await prisma.$transaction(async (tx) => {
    const created = await tx.productReview.create({ data: { productId, userId: uid, ...body } });
    const agg = await tx.productReview.aggregate({ where: { productId }, _avg: { rating: true }, _count: true });
    await tx.product.update({
      where: { id: productId },
      data: { ratingAvg: agg._avg.rating ?? 0, ratingCount: agg._count },
    });
    return created;
  });
  res.status(201).json({ review: { id: review.id, rating: review.rating, comment: review.comment } });
});
