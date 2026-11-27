import { Router } from "express";
import { prisma } from "../../lib/prisma.ts";
import { parse, zId } from "../../lib/validate.ts";
import { notFound } from "../../lib/errors.ts";
import { sellableProductWhere } from "../../lib/visibility.ts";

/**
 * Mağazalar (satıcı işletmeler). Mağaza sayfasında yalnızca o satıcının ürünleri listelenir.
 * Logo ve tanıtım metnini satıcının kendisi panelden yükler.
 */
export const storesRouter = Router();

const serializeStore = (
  b: {
    id: string;
    displayName: string;
    logoUrl: string | null;
    storeDescription: string | null;
    city: string;
    createdAt: Date;
    verificationStatus: string;
  },
  productCount: number,
) => ({
  id: b.id,
  name: b.displayName,
  logoUrl: b.logoUrl,
  description: b.storeDescription,
  city: b.city,
  productCount,
  verified: b.verificationStatus === "VERIFIED",
  since: b.createdAt.toISOString(),
});

storesRouter.get("/", async (_req, res) => {
  const counts = await prisma.product.groupBy({ by: ["sellerId"], where: sellableProductWhere, _count: true });
  const stores = await prisma.business.findMany({
    where: { id: { in: counts.map((c) => c.sellerId) }, type: "SELLER", status: "ACTIVE" },
  });
  const count = (id: string) => counts.find((c) => c.sellerId === id)?._count ?? 0;
  res.json({
    items: stores
      .map((s) => serializeStore(s, count(s.id)))
      // Logosu olan mağazalar önce, sonra ürün sayısına göre
      .sort((a, b) => Number(!!b.logoUrl) - Number(!!a.logoUrl) || b.productCount - a.productCount),
  });
});

storesRouter.get("/:id", async (req, res) => {
  const id = parse(zId, req.params.id);
  const store = await prisma.business.findFirst({ where: { id, type: "SELLER", status: "ACTIVE" } });
  if (!store) throw notFound("Mağaza bulunamadı");
  const productCount = await prisma.product.count({ where: { ...sellableProductWhere, sellerId: id } });
  res.json({
    store: {
      ...serializeStore(store, productCount),
      shippingFee: store.shippingFeeCents / 100,
      freeShippingThreshold: store.freeShippingThresholdCents / 100,
      returnPolicy: store.returnPolicy,
    },
  });
});
