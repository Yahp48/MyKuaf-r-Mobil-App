import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { api, createProduct, createSeller, registerUser, resetDb } from "./helpers.ts";
import { prisma } from "../src/lib/prisma.ts";

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe("mağazalar ve filtreler", () => {
  it("mağaza listesi ve mağaza sayfası yalnızca o satıcının ürünlerini gösterir", async () => {
    const a = await createSeller();
    const b = await createSeller();
    await prisma.business.update({
      where: { id: a.id },
      data: { logoUrl: "https://example.com/logo.png", storeDescription: "Profesyonel saç bakımı" },
    });
    await createProduct({ sellerId: a.id });
    await createProduct({ sellerId: a.id });
    await createProduct({ sellerId: b.id });

    const stores = await api().get("/api/stores");
    expect(stores.body.items[0]).toMatchObject({ id: a.id, logoUrl: "https://example.com/logo.png", productCount: 2 });
    expect(stores.body.items).toHaveLength(2);

    const store = await api().get(`/api/stores/${a.id}`);
    expect(store.body.store).toMatchObject({ name: "Test Mağaza", description: "Profesyonel saç bakımı" });
    const products = await api().get("/api/products").query({ seller: a.id });
    expect(products.body.total).toBe(2);
    expect(products.body.items.every((p: { seller: { id: string } }) => p.seller.id === a.id)).toBe(true);
  });

  it("marka, fiyat aralığı ve indirim filtreleri uygulanır", async () => {
    const seller = await createSeller();
    const p1 = await createProduct({ sellerId: seller.id, priceCents: 10_000 });
    const p2 = await createProduct({ sellerId: seller.id, priceCents: 30_000 });
    await prisma.product.update({ where: { id: p1.id }, data: { brand: "Aqua" } });
    await prisma.product.update({ where: { id: p2.id }, data: { brand: "Rosa", compareAtPriceCents: 40_000 } });

    expect(
      (await api().get("/api/products").query({ brands: "Aqua" })).body.items.map((p: { id: string }) => p.id),
    ).toEqual([p1.id]);
    expect(
      (await api().get("/api/products").query({ minPrice: 200 })).body.items.map((p: { id: string }) => p.id),
    ).toEqual([p2.id]);
    expect((await api().get("/api/products").query({ onSale: "true" })).body.total).toBe(1);
    const brands = await api().get("/api/products/brands");
    expect(brands.body.items.map((b: { name: string }) => b.name).sort()).toEqual(["Aqua", "Rosa"]);
  });

  it("'Çok satan' rozeti gerçek satışlardan hesaplanır; yeni ürün 'Yeni' rozeti alır", async () => {
    const seller = await createSeller();
    const hot = await createProduct({ sellerId: seller.id });
    const cold = await createProduct({ sellerId: seller.id });
    await prisma.product.update({
      where: { id: cold.id },
      data: { createdAt: new Date(Date.now() - 60 * 86_400_000) },
    });
    const u = await registerUser();
    // 3 adet ödenmiş satış
    await prisma.order.create({
      data: {
        orderNumber: "T-1",
        userId: u.user.id,
        sellerId: seller.id,
        status: "PAID",
        paymentMethod: "WALLET",
        paidAt: new Date(),
        subtotalCents: 30_000,
        shippingCents: 0,
        totalCents: 30_000,
        shippingAddress: {},
        customerEmail: "test@example.com",
        items: {
          create: [
            { productId: hot.id, nameSnapshot: "x", unitPriceCents: 10_000, quantity: 3, lineTotalCents: 30_000 },
          ],
        },
      },
    });
    const res = await api().get("/api/products").query({ sort: "best_selling" });
    expect(res.body.items[0].id).toBe(hot.id);
    expect(res.body.items[0].badges.map((b: { key: string }) => b.key)).toContain("bestseller");
    const coldItem = res.body.items.find((p: { id: string }) => p.id === cold.id);
    expect(coldItem.badges).toEqual([]);
  });
});
