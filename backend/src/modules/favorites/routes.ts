import { Router } from "express";
import { sellableProductWhere, visibleSalonWhere } from "../../lib/visibility.ts";
import { prisma } from "../../lib/prisma.ts";
import { parse, zId } from "../../lib/validate.ts";
import { notFound } from "../../lib/errors.ts";
import { requireAuth, userId } from "../../middleware/auth.ts";
import { productInclude, serializeProduct } from "../products/serialize.ts";
import { serializeSalonSummary } from "../salons/serialize.ts";

export const favoritesRouter = Router();
favoritesRouter.use(requireAuth);

favoritesRouter.get("/", async (req, res) => {
  const uid = userId(req);
  const [products, salons] = await Promise.all([
    prisma.favoriteProduct.findMany({
      where: { userId: uid, product: sellableProductWhere },
      include: { product: { include: productInclude } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.favoriteSalon.findMany({
      where: { userId: uid, salon: visibleSalonWhere },
      include: { salon: { include: { workingHours: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  res.json({
    products: products.map((f) => serializeProduct(f.product, { isFavorite: true })),
    salons: salons.map((f) => serializeSalonSummary(f.salon, { isFavorite: true })),
  });
});

favoritesRouter.put("/products/:id", async (req, res) => {
  const productId = parse(zId, req.params.id);
  const uid = userId(req);
  if (!(await prisma.product.findFirst({ where: { id: productId, ...sellableProductWhere } })))
    throw notFound("Ürün bulunamadı");
  await prisma.favoriteProduct.upsert({
    where: { userId_productId: { userId: uid, productId } },
    create: { userId: uid, productId },
    update: {},
  });
  res.status(204).end();
});

favoritesRouter.delete("/products/:id", async (req, res) => {
  await prisma.favoriteProduct.deleteMany({ where: { userId: userId(req), productId: parse(zId, req.params.id) } });
  res.status(204).end();
});

favoritesRouter.put("/salons/:id", async (req, res) => {
  const salonId = parse(zId, req.params.id);
  const uid = userId(req);
  if (!(await prisma.salon.findFirst({ where: { id: salonId, ...visibleSalonWhere } })))
    throw notFound("Salon bulunamadı");
  await prisma.favoriteSalon.upsert({
    where: { userId_salonId: { userId: uid, salonId } },
    create: { userId: uid, salonId },
    update: {},
  });
  res.status(204).end();
});

favoritesRouter.delete("/salons/:id", async (req, res) => {
  await prisma.favoriteSalon.deleteMany({ where: { userId: userId(req), salonId: parse(zId, req.params.id) } });
  res.status(204).end();
});
