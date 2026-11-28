import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { api, createProduct, registerUser, resetDb } from "./helpers.ts";
import { prisma } from "../src/lib/prisma.ts";
import { hashPassword } from "../src/lib/password.ts";

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

async function adminAuth() {
  const email = `admin${Date.now()}@example.com`;
  await prisma.user.create({
    data: { email, name: "Yönetici", role: "ADMIN", passwordHash: await hashPassword("Sifre12345") },
  });
  const login = await api().post("/api/business/auth/login").send({ email, password: "Sifre12345" });
  expect(login.status).toBe(200);
  return { Authorization: `Bearer ${login.body.accessToken}` };
}

/** İşlem geçmişi yanıttan sonra yazılır; kısa bir an bekle. */
const settle = () => new Promise((r) => setTimeout(r, 50));

describe("yönetim merkezi", () => {
  it("müşteriyi bulur, askıya alır (giriş ve oturum yenileme kapanır) ve işlem geçmişine yazar", async () => {
    const admin = await adminAuth();
    const c = await registerUser({ name: "Ayşe Yılmaz" });

    const list = await api().get("/api/admin/users").set(admin).query({ q: "ayşe" });
    expect(list.status).toBe(200);
    expect(list.body.items.map((u: { id: string }) => u.id)).toContain(c.user.id);

    const detail = await api().get(`/api/admin/users/${c.user.id}`).set(admin);
    expect(detail.body.user).toMatchObject({ name: "Ayşe Yılmaz", suspendedAt: null, counts: { orders: 0 } });

    expect((await api().post(`/api/admin/users/${c.user.id}/status`).set(admin).send({ suspended: true })).status).toBe(
      400,
    );
    const s = await api()
      .post(`/api/admin/users/${c.user.id}/status`)
      .set(admin)
      .send({ suspended: true, reason: "Sahte yorumlar" });
    expect(s.status).toBe(200);

    const login = await api().post("/api/auth/login").send({ email: c.user.email, password: c.password });
    expect(login.status).toBe(403);
    expect(login.body.error.code).toBe("ACCOUNT_SUSPENDED");
    expect((await api().post("/api/auth/refresh").send({ refreshToken: c.refreshToken })).status).toBe(401);

    await api().post(`/api/admin/users/${c.user.id}/status`).set(admin).send({ suspended: false });
    expect((await api().post("/api/auth/login").send({ email: c.user.email, password: c.password })).status).toBe(200);

    await settle();
    const activity = await api().get("/api/admin/activity").set(admin);
    expect(activity.body.items.map((a: { action: string }) => a.action)).toEqual(["user.activate", "user.suspend"]);
    expect(activity.body.items[1].summary).toContain("Sahte yorumlar");
  });

  it("ürünü yayından kaldırınca mağazadan ve sepetten düşer, satıcı açamaz", async () => {
    const admin = await adminAuth();
    const p = await createProduct();
    expect((await api().get(`/api/products/${p.id}`)).status).toBe(200);

    const b = await api()
      .post(`/api/admin/products/${p.id}/block`)
      .set(admin)
      .send({ blocked: true, reason: "Sahte ürün şüphesi" });
    expect(b.status).toBe(200);
    expect((await api().get(`/api/products/${p.id}`)).status).toBe(404);
    const c = await registerUser();
    expect((await api().post("/api/cart/items").set(c.auth).send({ productId: p.id, quantity: 1 })).status).toBe(404);

    const blocked = await api().get("/api/admin/products").set(admin).query({ status: "blocked" });
    expect(blocked.body.items[0]).toMatchObject({ id: p.id, blockReason: "Sahte ürün şüphesi" });

    await api().post(`/api/admin/products/${p.id}/block`).set(admin).send({ blocked: false });
    expect((await api().get(`/api/products/${p.id}`)).status).toBe(200);
  });

  it("özet sayılar, 14 günlük akış, randevu/sipariş/ödeme listeleri", async () => {
    const admin = await adminAuth();
    await registerUser();
    const m = await api().get("/api/admin/overview/metrics").set(admin);
    expect(m.status).toBe(200);
    expect(m.body.series).toHaveLength(14);
    expect(m.body.series.at(-1).customers).toBe(1);
    expect(m.body).toMatchObject({ newCustomers7d: 1, failedPayments7d: 0, blockedProducts: 0 });

    for (const path of ["appointments", "orders", "payments"]) {
      const r = await api().get(`/api/admin/${path}`).set(admin);
      expect(r.status).toBe(200);
      expect(r.body).toMatchObject({ items: [], total: 0 });
    }
  });

  it("müşteri ve işletme hesapları yönetim uçlarına giremez", async () => {
    const c = await registerUser();
    for (const path of ["users", "appointments", "orders", "payments", "products", "activity", "overview/metrics"]) {
      expect((await api().get(`/api/admin/${path}`).set(c.auth)).status).toBe(403);
    }
  });
});
