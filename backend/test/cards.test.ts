import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { api, registerUser, resetDb } from "./helpers.ts";
import { prisma } from "../src/lib/prisma.ts";

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

const complete = async (checkoutUrl: string, extra: Record<string, string> = {}) => {
  const ref = checkoutUrl.split("/").pop()!;
  const res = await api()
    .post("/api/payments/mock/complete")
    .type("form")
    .send({ ref, result: "success", ...extra });
  expect(res.status).toBe(303);
};

describe("kayıtlı kartlar", () => {
  it("kart doğrulama ödemesiyle kart eklenir, tutar iade edilir; kart numarası saklanmaz", async () => {
    const u = await registerUser();
    const start = await api().post("/api/cards/verify").set(u.auth).send({});
    expect(start.status).toBe(201);
    expect(start.body.payment).toMatchObject({ purpose: "CARD_VERIFY", amount: 1 });
    await complete(start.body.checkoutUrl, { card: "visa" });

    const list = await api().get("/api/cards").set(u.auth);
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0]).toMatchObject({ last4: "0000", association: "VISA", isDefault: true });
    expect(list.body.items[0].cardToken).toBeUndefined();
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: start.body.payment.id } });
    expect(payment.refundedCents).toBe(100);
    // Kart numarası, SKT veya CVV için bir alan yok: yalnızca sağlayıcı anahtarı ve son 4 hane
    const row = await prisma.savedCard.findFirstOrThrow({ where: { userId: u.user.id } });
    expect(Object.keys(row).sort()).toEqual(
      [
        "alias",
        "association",
        "bankName",
        "cardToken",
        "cardUserKey",
        "createdAt",
        "id",
        "isDefault",
        "last4",
        "provider",
        "userId",
      ].sort(),
    );
  });

  it("kayıtlı kartla bakiye yüklenir; başkasının kartı kullanılamaz; kart silinir", async () => {
    const u = await registerUser();
    const other = await registerUser();
    const start = await api().post("/api/cards/verify").set(u.auth).send({});
    await complete(start.body.checkoutUrl);
    const card = (await api().get("/api/cards").set(u.auth)).body.items[0];

    const topup = await api().post("/api/wallet/topups").set(u.auth).send({ amount: 100, savedCardId: card.id });
    expect(topup.status).toBe(201);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: topup.body.payment.id } })).savedCardId).toBe(
      card.id,
    );
    await complete(topup.body.checkoutUrl);
    expect((await api().get("/api/wallet").set(u.auth)).body.balance).toBe(100);
    // Kayıtlı kartla ödeme yeni kart eklemez
    expect((await api().get("/api/cards").set(u.auth)).body.items).toHaveLength(1);

    const stolen = await api().post("/api/wallet/topups").set(other.auth).send({ amount: 100, savedCardId: card.id });
    expect(stolen.status).toBe(404);

    const renamed = await api().patch(`/api/cards/${card.id}`).set(u.auth).send({ alias: "Maaş kartım" });
    expect(renamed.body.card.alias).toBe("Maaş kartım");
    expect((await api().delete(`/api/cards/${card.id}`).set(other.auth)).status).toBe(404);
    expect((await api().delete(`/api/cards/${card.id}`).set(u.auth)).status).toBe(204);
    expect((await api().get("/api/cards").set(u.auth)).body.items).toHaveLength(0);
  });

  it("yeni kartla ödemede 'kartımı kaydet' seçilirse kart eklenir, seçilmezse eklenmez", async () => {
    const u = await registerUser();
    const a = await api().post("/api/wallet/topups").set(u.auth).send({ amount: 50 });
    await complete(a.body.checkoutUrl);
    expect((await api().get("/api/cards").set(u.auth)).body.items).toHaveLength(0);
    const b = await api().post("/api/wallet/topups").set(u.auth).send({ amount: 50, saveCard: true });
    await complete(b.body.checkoutUrl, { card: "troy" });
    const items = (await api().get("/api/cards").set(u.auth)).body.items;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ association: "TROY", last4: "0796" });
  });
});
