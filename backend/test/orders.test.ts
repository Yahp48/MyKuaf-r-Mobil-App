import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { api, createProduct, registerUser, resetDb } from "./helpers.ts";
import { prisma } from "../src/lib/prisma.ts";
import { expireStalePayments, PAYMENT_TIMEOUT_MS } from "../src/modules/payments/service.ts";

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

async function userWithAddress() {
  const u = await registerUser();
  const addr = await api().post("/api/users/me/addresses").set(u.auth).send({
    title: "Ev",
    fullName: "Ayşe Yılmaz",
    phone: "05551234567",
    city: "Kırşehir",
    district: "Merkez",
    line: "Ahievran Mah. Aşk Paşa Blv. No:29 D:3",
  });
  expect(addr.status).toBe(201);
  return { ...u, addressId: addr.body.address.id as string };
}

/** Sahte ödeme sayfasındaki "onayla/reddet" düğmesini taklit eder. */
async function completeMockPayment(checkoutUrl: string, result: "success" | "fail") {
  const ref = checkoutUrl.split("/").pop()!;
  const res = await api().post("/api/payments/mock/complete").type("form").send({ ref, result });
  expect(res.status).toBe(303);
  expect(res.headers.location).toMatch(/^mykuafor:\/\/payment-result\?paymentId=/);
}

describe("sepet", () => {
  it("fiyatı ve kargoyu sunucuda hesaplar, stoktan fazlasına izin vermez", async () => {
    const u = await registerUser();
    const p = await createProduct({ stock: 3, priceCents: 12_550 });

    const add = await api().post("/api/cart/items").set(u.auth).send({ productId: p.id, quantity: 2 });
    expect(add.status).toBe(201);
    expect(add.body.summary).toMatchObject({ itemCount: 2, subtotal: 251, shipping: 29.99, total: 280.99 });

    const tooMany = await api().put(`/api/cart/items/${p.id}`).set(u.auth).send({ quantity: 4 });
    expect(tooMany.status).toBe(409);
    expect(tooMany.body.error.code).toBe("INSUFFICIENT_STOCK");
  });

  it("500 TL ve üzeri siparişte kargo ücretsiz", async () => {
    const u = await registerUser();
    const p = await createProduct({ stock: 10, priceCents: 25_000 });
    const res = await api().post("/api/cart/items").set(u.auth).send({ productId: p.id, quantity: 2 });
    expect(res.body.summary).toMatchObject({ subtotal: 500, shipping: 0, total: 500 });
  });
});

describe("kartla sipariş", () => {
  it("ödeme başarılı olunca sipariş PAID olur, stok düşer, sepet boşalır", async () => {
    const u = await userWithAddress();
    const p = await createProduct({ stock: 5, priceCents: 10_000 });
    await api().post("/api/cart/items").set(u.auth).send({ productId: p.id, quantity: 2 });

    const res = await api().post("/api/orders").set(u.auth).send({ addressId: u.addressId, paymentMethod: "CARD" });
    expect(res.status).toBe(201);
    expect(res.body.order.status).toBe("PENDING_PAYMENT");
    expect(res.body.order.total).toBe(229.99);
    expect(res.body.checkoutUrl).toContain("/api/payments/mock/checkout/");
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).stock).toBe(3);

    await completeMockPayment(res.body.checkoutUrl, "success");
    // Sağlayıcı geri çağrısı tekrar gelirse etkisiz olmalı
    await completeMockPayment(res.body.checkoutUrl, "success");

    const order = await api().get(`/api/orders/${res.body.order.id}`).set(u.auth);
    expect(order.body.order.status).toBe("PAID");
    expect(order.body.order.payment.status).toBe("SUCCEEDED");
    expect((await api().get("/api/cart").set(u.auth)).body.items).toHaveLength(0);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).stock).toBe(3);
  });

  it("ödeme reddedilirse sipariş iptal olur, stok geri gelir, sepet korunur", async () => {
    const u = await userWithAddress();
    const p = await createProduct({ stock: 5 });
    await api().post("/api/cart/items").set(u.auth).send({ productId: p.id, quantity: 1 });
    const res = await api().post("/api/orders").set(u.auth).send({ addressId: u.addressId, paymentMethod: "CARD" });

    await completeMockPayment(res.body.checkoutUrl, "fail");

    const order = await api().get(`/api/orders/${res.body.order.id}`).set(u.auth);
    expect(order.body.order.status).toBe("CANCELLED");
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).stock).toBe(5);
    expect((await api().get("/api/cart").set(u.auth)).body.items).toHaveLength(1);
  });

  it("yarım bırakılan ödeme zaman aşımında iptal edilir ve stok serbest kalır", async () => {
    const u = await userWithAddress();
    const p = await createProduct({ stock: 1 });
    await api().post("/api/cart/items").set(u.auth).send({ productId: p.id, quantity: 1 });
    const res = await api().post("/api/orders").set(u.auth).send({ addressId: u.addressId, paymentMethod: "CARD" });
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).stock).toBe(0);

    const expired = await expireStalePayments(new Date(Date.now() + PAYMENT_TIMEOUT_MS + 1000));
    expect(expired).toBe(1);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: res.body.order.id } })).status).toBe("CANCELLED");
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).stock).toBe(1);
  });

  it("son ürünü aynı anda iki kişi alamaz", async () => {
    const [a, b] = await Promise.all([userWithAddress(), userWithAddress()]);
    const p = await createProduct({ stock: 1 });
    await api().post("/api/cart/items").set(a.auth).send({ productId: p.id, quantity: 1 });
    await api().post("/api/cart/items").set(b.auth).send({ productId: p.id, quantity: 1 });

    const results = await Promise.all([
      api().post("/api/orders").set(a.auth).send({ addressId: a.addressId, paymentMethod: "CARD" }),
      api().post("/api/orders").set(b.auth).send({ addressId: b.addressId, paymentMethod: "CARD" }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).stock).toBe(0);
  });

  it("başkasının adresiyle sipariş veremez", async () => {
    const [a, b] = await Promise.all([userWithAddress(), userWithAddress()]);
    const p = await createProduct();
    await api().post("/api/cart/items").set(a.auth).send({ productId: p.id, quantity: 1 });
    const res = await api().post("/api/orders").set(a.auth).send({ addressId: b.addressId, paymentMethod: "CARD" });
    expect(res.status).toBe(404);
  });
});

describe("cüzdan", () => {
  it("bakiye yükler, cüzdanla öder, iptalde iade eder", async () => {
    const u = await userWithAddress();
    const p = await createProduct({ stock: 5, priceCents: 10_000 });
    await api().post("/api/cart/items").set(u.auth).send({ productId: p.id, quantity: 1 });

    // Bakiye yok: cüzdanla ödeme reddedilir, stok değişmez
    const poor = await api().post("/api/orders").set(u.auth).send({ addressId: u.addressId, paymentMethod: "WALLET" });
    expect(poor.status).toBe(409);
    expect(poor.body.error.code).toBe("INSUFFICIENT_BALANCE");
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).stock).toBe(5);

    const topup = await api().post("/api/wallet/topups").set(u.auth).send({ amount: 200 });
    expect(topup.status).toBe(201);
    await completeMockPayment(topup.body.checkoutUrl, "success");
    expect((await api().get("/api/wallet").set(u.auth)).body.balance).toBe(200);

    const paid = await api().post("/api/orders").set(u.auth).send({ addressId: u.addressId, paymentMethod: "WALLET" });
    expect(paid.status).toBe(201);
    expect(paid.body.order.status).toBe("PAID");
    expect((await api().get("/api/wallet").set(u.auth)).body.balance).toBe(70.01);

    const cancel = await api().post(`/api/orders/${paid.body.order.id}/cancel`).set(u.auth);
    expect(cancel.status).toBe(200);
    expect(cancel.body.order.status).toBe("REFUNDED");
    const wallet = await api().get("/api/wallet").set(u.auth);
    expect(wallet.body.balance).toBe(200);
    expect(wallet.body.transactions.items.map((t: { type: string }) => t.type)).toEqual(["REFUND", "PAYMENT", "TOPUP"]);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).stock).toBe(5);
  });

  it("limit dışı yükleme tutarını reddeder", async () => {
    const u = await registerUser();
    const res = await api().post("/api/wallet/topups").set(u.auth).send({ amount: 10 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_AMOUNT");
  });

  it("bakiyesi olan hesap silinemez (önce iade)", async () => {
    const u = await registerUser();
    const topup = await api().post("/api/wallet/topups").set(u.auth).send({ amount: 100 });
    await completeMockPayment(topup.body.checkoutUrl, "success");
    const res = await api().delete("/api/users/me").set(u.auth).send({ password: u.password });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("WALLET_NOT_EMPTY");
  });
});
