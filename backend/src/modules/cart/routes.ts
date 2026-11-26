import { Router } from "express";
import { sellableProductWhere } from "../../lib/visibility.ts";
import { z } from "zod";
import { prisma } from "../../lib/prisma.ts";
import { parse, zId } from "../../lib/validate.ts";
import { AppError, notFound } from "../../lib/errors.ts";
import { requireAuth, userId } from "../../middleware/auth.ts";
import { MAX_QTY_PER_ITEM, loadCart, summarizeCart } from "./service.ts";

export const cartRouter = Router();
cartRouter.use(requireAuth);

async function respond(uid: string) {
  const { totals: _t, ...cart } = summarizeCart(await loadCart(uid));
  return cart;
}

async function sellableProduct(productId: string) {
  const product = await prisma.product.findFirst({ where: { id: productId, ...sellableProductWhere } });
  if (!product) throw notFound("Ürün bulunamadı");
  return product;
}

function checkQuantity(quantity: number, stock: number) {
  if (stock === 0) throw new AppError(409, "OUT_OF_STOCK", "Bu ürün tükendi");
  if (quantity > stock)
    throw new AppError(409, "INSUFFICIENT_STOCK", `Bu üründen en fazla ${stock} adet alabilirsiniz`);
  if (quantity > MAX_QTY_PER_ITEM) {
    throw new AppError(400, "QUANTITY_LIMIT", `Bir üründen en fazla ${MAX_QTY_PER_ITEM} adet alabilirsiniz`);
  }
}

cartRouter.get("/", async (req, res) => {
  res.json(await respond(userId(req)));
});

const addSchema = z.object({ productId: zId, quantity: z.number().int().min(1).max(MAX_QTY_PER_ITEM).default(1) });

cartRouter.post("/items", async (req, res) => {
  const body = parse(addSchema, req.body);
  const uid = userId(req);
  const product = await sellableProduct(body.productId);
  const existing = await prisma.cartItem.findUnique({
    where: { userId_productId: { userId: uid, productId: product.id } },
  });
  const quantity = (existing?.quantity ?? 0) + body.quantity;
  checkQuantity(quantity, product.stock);
  await prisma.cartItem.upsert({
    where: { userId_productId: { userId: uid, productId: product.id } },
    create: { userId: uid, productId: product.id, quantity },
    update: { quantity },
  });
  res.status(201).json(await respond(uid));
});

const setSchema = z.object({ quantity: z.number().int().min(0).max(MAX_QTY_PER_ITEM) });

cartRouter.put("/items/:productId", async (req, res) => {
  const productId = parse(zId, req.params.productId);
  const { quantity } = parse(setSchema, req.body);
  const uid = userId(req);
  if (quantity === 0) {
    await prisma.cartItem.deleteMany({ where: { userId: uid, productId } });
  } else {
    const product = await sellableProduct(productId);
    checkQuantity(quantity, product.stock);
    await prisma.cartItem.upsert({
      where: { userId_productId: { userId: uid, productId } },
      create: { userId: uid, productId, quantity },
      update: { quantity },
    });
  }
  res.json(await respond(uid));
});

cartRouter.delete("/items/:productId", async (req, res) => {
  const productId = parse(zId, req.params.productId);
  const uid = userId(req);
  await prisma.cartItem.deleteMany({ where: { userId: uid, productId } });
  res.json(await respond(uid));
});

cartRouter.delete("/", async (req, res) => {
  const uid = userId(req);
  await prisma.cartItem.deleteMany({ where: { userId: uid } });
  res.json(await respond(uid));
});

// Çevrimdışı/girişten önce oluşturulmuş yerel sepeti sunucudaki sepetle birleştirir.
const mergeSchema = z.object({
  items: z.array(z.object({ productId: zId, quantity: z.number().int().min(1).max(MAX_QTY_PER_ITEM) })).max(50),
});

cartRouter.post("/merge", async (req, res) => {
  const { items } = parse(mergeSchema, req.body);
  const uid = userId(req);
  const products = await prisma.product.findMany({
    where: { id: { in: items.map((i) => i.productId) }, ...sellableProductWhere },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  const current = new Map((await prisma.cartItem.findMany({ where: { userId: uid } })).map((c) => [c.productId, c]));

  await prisma.$transaction(
    items
      .filter((i) => byId.has(i.productId))
      .map((i) => {
        const stock = byId.get(i.productId)!.stock;
        const quantity = Math.min(
          Math.max(current.get(i.productId)?.quantity ?? 0, i.quantity),
          stock,
          MAX_QTY_PER_ITEM,
        );
        return quantity > 0
          ? prisma.cartItem.upsert({
              where: { userId_productId: { userId: uid, productId: i.productId } },
              create: { userId: uid, productId: i.productId, quantity },
              update: { quantity },
            })
          : prisma.cartItem.deleteMany({ where: { userId: uid, productId: i.productId } });
      }),
  );
  res.json(await respond(uid));
});
