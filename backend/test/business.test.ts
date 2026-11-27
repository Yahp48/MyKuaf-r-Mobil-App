import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import { api, createProduct, makeVkn, registerUser, resetDb, tomorrow } from "./helpers.ts";
import { prisma } from "../src/lib/prisma.ts";
import { isValidTckn, isValidTrIban, isValidVkn } from "../src/lib/tax-id.ts";

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

let seq = 0;
function businessBody(type: "SALON" | "SELLER", overrides: Record<string, unknown> = {}) {
  seq += 1;
  return {
    owner: {
      name: "Ayşe Demir",
      email: `isletme${seq}_${Date.now()}@example.com`,
      password: "Sifre12345",
      phone: "05551234567",
    },
    business: {
      type,
      displayName: type === "SALON" ? "Test Kuaför" : "Test Kozmetik",
      legalName: "Ayşe Demir Kuaförlük Hizmetleri",
      taxNumber: makeVkn(),
      taxOffice: "Kırşehir",
      address: "Ahievran Mah. Aşk Paşa Blv. No:29",
      city: "Kırşehir",
      district: "Merkez",
      phone: "0386 213 00 00",
      email: `iletisim${seq}@example.com`,
      iban: "TR33 0006 1005 1978 6457 8413 26",
      ...overrides,
    },
    ...(type === "SALON" ? { salon: { name: "Test Kuaför", latitude: 39.15, longitude: 34.16 } } : {}),
    acceptTerms: true,
  };
}

async function registerBusiness(type: "SALON" | "SELLER") {
  const res = await api().post("/api/business/auth/register").send(businessBody(type));
  expect(res.status).toBe(201);
  return { ...res.body, auth: { Authorization: `Bearer ${res.body.accessToken}` }, cookie: res.headers["set-cookie"] };
}

describe("vergi kimlik doğrulama", () => {
  it("VKN, TCKN ve IBAN algoritmalarını uygular", () => {
    const vkn = makeVkn();
    expect(isValidVkn(vkn)).toBe(true);
    expect(isValidVkn(vkn.slice(0, 9) + ((Number(vkn[9]) + 1) % 10))).toBe(false);
    expect(isValidTckn("10000000146")).toBe(true);
    expect(isValidTckn("10000000147")).toBe(false);
    expect(isValidTrIban("TR330006100519786457841326")).toBe(true);
    expect(isValidTrIban("TR330006100519786457841327")).toBe(false);
  });
});

describe("işletme kaydı ve giriş", () => {
  it("geçersiz vergi numarasını ve IBAN'ı reddeder", async () => {
    const valid = makeVkn();
    const invalid = valid.slice(0, 9) + ((Number(valid[9]) + 1) % 10);
    const badTax = await api()
      .post("/api/business/auth/register")
      .send(businessBody("SELLER", { taxNumber: invalid }));
    expect(badTax.status).toBe(400);
    expect(badTax.body.error.message).toMatch(/Vergi/);
    const badIban = await api()
      .post("/api/business/auth/register")
      .send(businessBody("SELLER", { iban: "TR000000000000000000000000" }));
    expect(badIban.status).toBe(400);
  });

  it("aynı vergi numarasıyla ikinci kaydı reddeder", async () => {
    const body = businessBody("SELLER");
    expect((await api().post("/api/business/auth/register").send(body)).status).toBe(201);
    const again = businessBody("SELLER", { taxNumber: body.business.taxNumber });
    const res = await api().post("/api/business/auth/register").send(again);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("TAX_NUMBER_TAKEN");
  });

  it("kuaför kaydında konum zorunlu", async () => {
    const { salon: _s, ...body } = businessBody("SALON");
    const res = await api().post("/api/business/auth/register").send(body);
    expect(res.status).toBe(400);
  });

  it("panel girişi httpOnly çerezle oturum yeniler; hesap türleri karışmaz", async () => {
    const b = await registerBusiness("SELLER");
    const cookie: string = b.cookie[0];
    expect(cookie).toMatch(/mk_panel_rt=.*HttpOnly.*SameSite=Strict/i);

    const refreshed = await api().post("/api/business/auth/refresh").set("Cookie", cookie.split(";")[0]!);
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.accessToken).toBeTypeOf("string");

    // İşletme hesabı müşteri uygulamasına giremez, müşteri hesabı panele giremez
    const asCustomer = await api().post("/api/auth/login").send({ email: b.owner.email, password: "Sifre12345" });
    expect(asCustomer.status).toBe(403);
    const customer = await registerUser();
    const asBusiness = await api()
      .post("/api/business/auth/login")
      .send({ email: customer.user.email, password: customer.password });
    expect(asBusiness.status).toBe(403);
    expect((await api().get("/api/business/salon/overview").set(customer.auth)).status).toBe(403);
  });

  it("satıcı, kuaför paneline erişemez", async () => {
    const seller = await registerBusiness("SELLER");
    expect((await api().get("/api/business/salon/overview").set(seller.auth)).status).toBe(403);
    expect((await api().get("/api/business/seller/overview").set(seller.auth)).status).toBe(200);
  });
});

describe("kuaför paneli", () => {
  async function readySalon() {
    const b = await registerBusiness("SALON");
    const staff = await api().post("/api/business/salon/staff").set(b.auth).send({ name: "Zeynep", title: "Kuaför" });
    const svc = await api()
      .post("/api/business/salon/services")
      .set(b.auth)
      .send({ name: "Saç Kesimi", durationMinutes: 30, price: 250 });
    expect(staff.status).toBe(201);
    expect(svc.status).toBe(201);
    // Her gün açık olsun
    const hours = Array.from({ length: 7 }, (_, i) => ({
      weekday: i + 1,
      isClosed: false,
      opens: "09:00",
      closes: "18:00",
    }));
    expect((await api().put("/api/business/salon/hours").set(b.auth).send({ items: hours })).status).toBe(200);
    await prisma.salon.update({ where: { id: b.salon.id }, data: { bookingLeadMinutes: 0 } });
    return { ...b, staffId: staff.body.staff.id as string, serviceId: svc.body.service.id as string };
  }

  it("yeni salon, personel ve hizmet ekleyince haritada görünür; kapatınca kaybolur", async () => {
    const b = await registerBusiness("SALON");
    const before = await api().get("/api/salons");
    expect(before.body.items.find((s: { id: string }) => s.id === b.salon.id)).toBeUndefined();

    await api().post("/api/business/salon/staff").set(b.auth).send({ name: "Elif" });
    await api().post("/api/business/salon/services").set(b.auth).send({ name: "Fön", durationMinutes: 30, price: 100 });
    const after = await api().get("/api/salons");
    expect(after.body.items.find((s: { id: string }) => s.id === b.salon.id)?.name).toBe("Test Kuaför");

    const overview = await api().get("/api/business/salon/overview").set(b.auth);
    expect(overview.body.setup.visibleOnMap).toBe(true);

    await api().patch("/api/business/salon/profile").set(b.auth).send({ isActive: false });
    const hidden = await api().get("/api/salons");
    expect(hidden.body.items.find((s: { id: string }) => s.id === b.salon.id)).toBeUndefined();
  });

  it("müşteri randevusu panele düşer; salon iptal edince müşteri bilgilendirilir", async () => {
    const b = await readySalon();
    const customer = await registerUser();
    const booked = await api()
      .post("/api/appointments")
      .set(customer.auth)
      .send({ salonId: b.salon.id, serviceIds: [b.serviceId], date: tomorrow(), time: "11:00" });
    expect(booked.status).toBe(201);

    const list = await api()
      .get("/api/business/salon/appointments")
      .set(b.auth)
      .query({ from: tomorrow(), to: tomorrow() });
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0].customer).toMatchObject({ name: "Test Kullanıcı", isAppUser: true });

    const id = booked.body.appointment.id;
    // Başlamamış randevu "tamamlandı" yapılamaz
    const early = await api()
      .post(`/api/business/salon/appointments/${id}/status`)
      .set(b.auth)
      .send({ status: "COMPLETED" });
    expect(early.status).toBe(400);
    // İptalde sebep zorunlu
    const noReason = await api()
      .post(`/api/business/salon/appointments/${id}/status`)
      .set(b.auth)
      .send({ status: "CANCELLED" });
    expect(noReason.status).toBe(400);
    const cancel = await api()
      .post(`/api/business/salon/appointments/${id}/status`)
      .set(b.auth)
      .send({ status: "CANCELLED", reason: "Personel rahatsızlandı" });
    expect(cancel.status).toBe(200);

    const notes = await api().get("/api/notifications").set(customer.auth);
    expect(notes.body.items[0].body).toContain("Personel rahatsızlandı");
  });

  it("telefonla randevu girer, çakışmayı engeller, saati taşır", async () => {
    const b = await readySalon();
    const body = {
      staffId: b.staffId,
      serviceIds: [b.serviceId],
      date: tomorrow(),
      time: "14:00",
      customerName: "Fatma Kaya",
      customerPhone: "05559876543",
    };
    const first = await api().post("/api/business/salon/appointments").set(b.auth).send(body);
    expect(first.status).toBe(201);
    expect(first.body.appointment.source).toBe("MANUAL");
    const clash = await api().post("/api/business/salon/appointments").set(b.auth).send(body);
    expect(clash.status).toBe(409);

    const moved = await api()
      .patch(`/api/business/salon/appointments/${first.body.appointment.id}`)
      .set(b.auth)
      .send({ time: "15:00", businessNote: "Müşteri erken gelecek" });
    expect(moved.status).toBe(200);
    expect(moved.body.appointment).toMatchObject({ time: "15:00", businessNote: "Müşteri erken gelecek" });
    expect((await api().post("/api/business/salon/appointments").set(b.auth).send(body)).status).toBe(201);
  });

  it("başka salonun randevusunu göremez", async () => {
    const a = await readySalon();
    const other = await readySalon();
    const appt = await api()
      .post("/api/business/salon/appointments")
      .set(a.auth)
      .send({
        staffId: a.staffId,
        serviceIds: [a.serviceId],
        date: tomorrow(),
        time: "10:00",
        customerName: "Fatma Kaya",
        customerPhone: "05559876543",
      });
    const id = appt.body.appointment.id;
    expect((await api().get(`/api/business/salon/appointments/${id}`).set(other.auth)).status).toBe(404);
    expect(
      (await api().post(`/api/business/salon/appointments/${id}/status`).set(other.auth).send({ status: "CONFIRMED" }))
        .status,
    ).toBe(404);
  });

  it("gelecek randevusu olan personel pasife alınamaz", async () => {
    const b = await readySalon();
    await api()
      .post("/api/business/salon/appointments")
      .set(b.auth)
      .send({
        staffId: b.staffId,
        serviceIds: [b.serviceId],
        date: tomorrow(),
        time: "10:00",
        customerName: "Fatma Kaya",
        customerPhone: "05559876543",
      });
    const res = await api().delete(`/api/business/salon/staff/${b.staffId}`).set(b.auth);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("STAFF_HAS_APPOINTMENTS");
  });

  it("galeri, salon türü ve WhatsApp müşteri kartında görünür", async () => {
    const b = await readySalon();
    const photos = ["https://example.com/a.jpg", "https://example.com/b.jpg"];
    const res = await api()
      .patch("/api/business/salon/profile")
      .set(b.auth)
      .send({ photos, kind: "BEAUTY", whatsapp: "0555 123 45 67" });
    expect(res.status).toBe(200);
    expect(res.body.salon).toMatchObject({ photos, kind: "BEAUTY", whatsapp: "05551234567" });

    const pub = await api().get(`/api/salons/${b.salon.id}`);
    expect(pub.body.salon).toMatchObject({
      photos,
      photo: photos[0],
      kindLabel: "Güzellik salonu",
      whatsapp: "05551234567",
      priceRange: { min: 250, max: 250 },
    });
    const reviews = await api().get(`/api/salons/${b.salon.id}/reviews`);
    expect(reviews.body.summary).toMatchObject({ count: 0, distribution: expect.any(Array) });
  });

  it("gelir-gider kaydı aylık özete yansır", async () => {
    const b = await readySalon();
    const month = tomorrow().slice(0, 7);
    await api()
      .post("/api/business/salon/ledger")
      .set(b.auth)
      .send({ type: "EXPENSE", category: "Kira", amount: 12000, date: `${month}-01` });
    await api()
      .post("/api/business/salon/ledger")
      .set(b.auth)
      .send({ type: "INCOME", category: "Ürün satışı", amount: 850.5, date: `${month}-02` });
    const fin = await api().get("/api/business/salon/finance").set(b.auth).query({ month });
    expect(fin.body.totals).toMatchObject({ otherIncome: 850.5, expense: 12000, net: -11149.5 });
    expect(fin.body.expenseByCategory[0]).toEqual({ category: "Kira", amount: 12000 });
  });
});

describe("satıcı paneli ve çok satıcılı sepet", () => {
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
    return { ...u, addressId: addr.body.address.id as string };
  }

  it("satıcının eklediği ürün mağazada anında görünür", async () => {
    const s = await registerBusiness("SELLER");
    const category = await prisma.category.create({ data: { slug: `kat-${Date.now()}`, name: "Bakım" } });
    const created = await api()
      .post("/api/business/seller/products")
      .set(s.auth)
      .send({
        name: "Argan Yağı Serumu",
        categoryId: category.id,
        price: 149.9,
        compareAtPrice: 199.9,
        stock: 12,
        images: ["https://example.com/argan.jpg"],
      });
    expect(created.status).toBe(201);
    const shop = await api().get("/api/products").query({ q: "Argan" });
    expect(shop.body.items[0]).toMatchObject({
      name: "Argan Yağı Serumu",
      price: 149.9,
      seller: { name: "Test Kozmetik" },
    });

    const badDiscount = await api()
      .patch(`/api/business/seller/products/${created.body.product.id}`)
      .set(s.auth)
      .send({ compareAtPrice: 100 });
    expect(badDiscount.status).toBe(400);
  });

  it("iki satıcılı sepet iki siparişe bölünür; her satıcı kendi siparişini yönetir", async () => {
    const [a, b] = [await registerBusiness("SELLER"), await registerBusiness("SELLER")];
    const pa = await createProduct({ sellerId: a.business.id, priceCents: 20_000, stock: 5 });
    const pb = await createProduct({ sellerId: b.business.id, priceCents: 60_000, stock: 5 });
    const u = await userWithAddress();
    await api().post("/api/cart/items").set(u.auth).send({ productId: pa.id, quantity: 1 });
    const cart = await api().post("/api/cart/items").set(u.auth).send({ productId: pb.id, quantity: 1 });
    // A: 200 TL + 29,99 kargo, B: 600 TL ücretsiz kargo
    expect(cart.body.summary).toMatchObject({ subtotal: 800, shipping: 29.99, total: 829.99 });
    expect(cart.body.summary.sellers).toHaveLength(2);

    const res = await api().post("/api/orders").set(u.auth).send({ addressId: u.addressId, paymentMethod: "CARD" });
    expect(res.status).toBe(201);
    expect(res.body.orders).toHaveLength(2);
    expect(res.body.payment.amount).toBe(829.99);

    // Ödenmemiş sipariş satıcıya görünmez
    expect((await api().get("/api/business/seller/orders").set(a.auth)).body.items).toHaveLength(0);
    const ref = res.body.checkoutUrl.split("/").pop();
    await api().post("/api/payments/mock/complete").type("form").send({ ref, result: "success" });

    const aOrders = await api().get("/api/business/seller/orders").set(a.auth);
    expect(aOrders.body.items).toHaveLength(1);
    expect(aOrders.body.items[0].total).toBe(229.99);
    const orderA = aOrders.body.items[0].id;
    // Başka satıcının siparişine erişemez
    expect((await api().get(`/api/business/seller/orders/${orderA}`).set(b.auth)).status).toBe(404);

    // Kargo: takip numarası zorunlu
    const noTracking = await api()
      .post(`/api/business/seller/orders/${orderA}/status`)
      .set(a.auth)
      .send({ status: "SHIPPED" });
    expect(noTracking.status).toBe(400);
    const shipped = await api()
      .post(`/api/business/seller/orders/${orderA}/status`)
      .set(a.auth)
      .send({ status: "SHIPPED", carrier: "Yurtiçi Kargo", trackingNumber: "YK123456789" });
    expect(shipped.status).toBe(200);
    // Kargodaki sipariş satıcı tarafından iptal edilemez
    expect(
      (await api().post(`/api/business/seller/orders/${orderA}/cancel`).set(a.auth).send({ reason: "Stok hatası" }))
        .status,
    ).toBe(400);

    // B satıcısı siparişi iptal eder: yalnızca kendi tutarı iade edilir
    const orderB = (await api().get("/api/business/seller/orders").set(b.auth)).body.items[0].id;
    const cancelled = await api()
      .post(`/api/business/seller/orders/${orderB}/cancel`)
      .set(b.auth)
      .send({ reason: "Ürün hasarlı geldi" });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.order.status).toBe("REFUNDED");
    const payment = await prisma.payment.findFirstOrThrow({ where: { userId: u.user.id } });
    expect(payment).toMatchObject({ refundedCents: 60_000, status: "SUCCEEDED" });
    expect((await prisma.product.findUniqueOrThrow({ where: { id: pb.id } })).stock).toBe(5);

    const mine = await api().get(`/api/orders/${orderA}`).set(u.auth);
    expect(mine.body.order).toMatchObject({
      status: "SHIPPED",
      carrier: "Yurtiçi Kargo",
      trackingNumber: "YK123456789",
    });

    const overview = await api().get("/api/business/seller/overview").set(a.auth);
    expect(overview.body.kpis.revenueToday).toBe(229.99);
  });

  it("askıya alınan satıcının ürünleri satıştan kalkar ve panele giremez", async () => {
    const s = await registerBusiness("SELLER");
    const p = await createProduct({ sellerId: s.business.id });
    expect((await api().get(`/api/products/${p.id}`)).status).toBe(200);
    await prisma.business.update({ where: { id: s.business.id }, data: { status: "SUSPENDED" } });
    expect((await api().get(`/api/products/${p.id}`)).status).toBe(404);
    const res = await api().get("/api/business/seller/overview").set(s.auth);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("BUSINESS_SUSPENDED");
  });
});

describe("hizmet indirimleri ve vitrin", () => {
  const day = (offset: number) =>
    DateTime.now().setZone("Europe/Istanbul").plus({ days: offset }).toFormat("yyyy-MM-dd");

  async function salonWithService() {
    const b = await registerBusiness("SALON");
    await api().post("/api/business/salon/staff").set(b.auth).send({ name: "Zeynep" });
    const svc = await api()
      .post("/api/business/salon/services")
      .set(b.auth)
      .send({ name: "Boya", durationMinutes: 60, price: 1000 });
    const hours = Array.from({ length: 7 }, (_, i) => ({
      weekday: i + 1,
      isClosed: false,
      opens: "09:00",
      closes: "18:00",
    }));
    await api().put("/api/business/salon/hours").set(b.auth).send({ items: hours });
    await prisma.salon.update({ where: { id: b.salon.id }, data: { bookingLeadMinutes: 0 } });
    return { ...b, serviceId: svc.body.service.id as string };
  }

  it("indirim yalnızca tarih aralığındaki randevulara uygulanır ve müşteriye gösterilir", async () => {
    const b = await salonWithService();
    const set = await api()
      .patch(`/api/business/salon/services/${b.serviceId}`)
      .set(b.auth)
      .send({ discountPercent: 20, discountStartsOn: day(1), discountEndsOn: day(2) });
    expect(set.status).toBe(200);
    expect(set.body.service.discount).toMatchObject({ percent: 20, price: 800, status: "SCHEDULED" });

    const detail = await api().get(`/api/salons/${b.salon.id}`);
    expect(detail.body.salon.services[0].discount).toMatchObject({ percent: 20, price: 800, activeToday: false });
    expect(detail.body.salon.discount).toMatchObject({ maxPercent: 20 });

    const customer = await registerUser();
    const inWindow = await api()
      .post("/api/appointments")
      .set(customer.auth)
      .send({ salonId: b.salon.id, serviceIds: [b.serviceId], date: day(1), time: "10:00" });
    expect(inWindow.status).toBe(201);
    expect(inWindow.body.appointment.total).toBe(800);
    const outside = await api()
      .post("/api/appointments")
      .set(customer.auth)
      .send({ salonId: b.salon.id, serviceIds: [b.serviceId], date: day(3), time: "10:00" });
    expect(outside.status).toBe(201);
    expect(outside.body.appointment.total).toBe(1000);

    const deals = await api().get("/api/salons/deals").query({ city: "Kırşehir" });
    expect(deals.body.items[0].salon.id).toBe(b.salon.id);
    expect(deals.body.items[0].deals[0]).toMatchObject({ name: "Boya", percent: 20, listPrice: 1000, price: 800 });
  });

  it("fiyat artırılan hizmette 30 gün indirim yapılamaz; indirim sürerken fiyat artırılamaz", async () => {
    const b = await salonWithService();
    const raise = await api().patch(`/api/business/salon/services/${b.serviceId}`).set(b.auth).send({ price: 1200 });
    expect(raise.status).toBe(200);
    expect(raise.body.service.discountAllowedFrom).toBeTruthy();
    const blocked = await api()
      .patch(`/api/business/salon/services/${b.serviceId}`)
      .set(b.auth)
      .send({ discountPercent: 30, discountStartsOn: day(0), discountEndsOn: day(5) });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe("PRICE_RECENTLY_RAISED");

    await prisma.service.update({ where: { id: b.serviceId }, data: { priceRaisedAt: null } });
    const ok = await api()
      .patch(`/api/business/salon/services/${b.serviceId}`)
      .set(b.auth)
      .send({ discountPercent: 30, discountStartsOn: day(0), discountEndsOn: day(5) });
    expect(ok.status).toBe(200);
    const raiseDuring = await api()
      .patch(`/api/business/salon/services/${b.serviceId}`)
      .set(b.auth)
      .send({ price: 1500 });
    expect(raiseDuring.status).toBe(409);
    expect(raiseDuring.body.error.code).toBe("DISCOUNT_ACTIVE");
    const lower = await api().patch(`/api/business/salon/services/${b.serviceId}`).set(b.auth).send({ price: 900 });
    expect(lower.status).toBe(200);
    const removed = await api()
      .patch(`/api/business/salon/services/${b.serviceId}`)
      .set(b.auth)
      .send({ discountPercent: null });
    expect(removed.body.service.discount).toBeNull();
  });

  it("ayın kuaförleri gerçek tamamlanmış randevulara göre sıralanır; eşik altı listelenmez", async () => {
    const b = await salonWithService();
    const other = await salonWithService();
    const staff = await prisma.staff.findFirstOrThrow({ where: { salonId: b.salon.id } });
    const otherStaff = await prisma.staff.findFirstOrThrow({ where: { salonId: other.salon.id } });
    const now = DateTime.now().setZone("Europe/Istanbul");
    // Bu ay: b → 3 tamamlanan, other → 1 (eşik altı)
    const mk = (salonId: string, staffId: string, minutesAgo: number) =>
      prisma.appointment.create({
        data: {
          code: `T${Math.random().toString(36).slice(2, 10)}`,
          salonId,
          staffId,
          startsAt: now.minus({ minutes: minutesAgo + 5 }).toJSDate(),
          endsAt: now.minus({ minutes: minutesAgo }).toJSDate(),
          status: "COMPLETED",
          totalCents: 100000,
          customerName: "Test",
        },
      });
    for (const m of [1, 10, 20]) await mk(b.salon.id, staff.id, m);
    await mk(other.salon.id, otherStaff.id, 1);

    const res = await api().get("/api/salons/featured").query({ city: "Kırşehir", period: "month" });
    expect(res.status).toBe(200);
    const ids = res.body.items.map((x: { salon: { id: string } }) => x.salon.id);
    expect(ids).toContain(b.salon.id);
    expect(ids).not.toContain(other.salon.id);
    expect(res.body.items[0]).toMatchObject({ rank: 1, stats: { completedAppointments: 3 } });

    const cities = await api().get("/api/salons/cities");
    expect(cities.body.items[0]).toMatchObject({ city: "Kırşehir" });
  });
});

describe("paketler, uzmanlıklar ve ilk ziyaret indirimi", () => {
  async function salonReady() {
    const b = await registerBusiness("SALON");
    const st = await api()
      .post("/api/business/salon/staff")
      .set(b.auth)
      .send({ name: "Zeynep", specialties: ["Balyaj", "Gelin saçı"], bio: "10 yıllık deneyim" });
    expect(st.body.staff.specialties).toEqual(["Balyaj", "Gelin saçı"]);
    const s1 = await api()
      .post("/api/business/salon/services")
      .set(b.auth)
      .send({ name: "Saç", durationMinutes: 60, price: 600 });
    const s2 = await api()
      .post("/api/business/salon/services")
      .set(b.auth)
      .send({ name: "Makyaj", durationMinutes: 60, price: 400 });
    const hours = Array.from({ length: 7 }, (_, i) => ({
      weekday: i + 1,
      isClosed: false,
      opens: "09:00",
      closes: "18:00",
    }));
    await api().put("/api/business/salon/hours").set(b.auth).send({ items: hours });
    await prisma.salon.update({ where: { id: b.salon.id }, data: { bookingLeadMinutes: 0 } });
    return { ...b, s1: s1.body.service.id as string, s2: s2.body.service.id as string };
  }

  it("paket fiyatı hizmet toplamını aşamaz; paketle randevu paket fiyatından alınır", async () => {
    const b = await salonReady();
    const tooHigh = await api()
      .post("/api/business/salon/packages")
      .set(b.auth)
      .send({ name: "Gelin paketi", price: 1200, serviceIds: [b.s1, b.s2] });
    expect(tooHigh.status).toBe(400);
    const pkg = await api()
      .post("/api/business/salon/packages")
      .set(b.auth)
      .send({ name: "Gelin paketi", price: 850, serviceIds: [b.s1, b.s2] });
    expect(pkg.status).toBe(201);

    const detail = await api().get(`/api/salons/${b.salon.id}`);
    expect(detail.body.salon.packages[0]).toMatchObject({
      name: "Gelin paketi",
      price: 850,
      listPrice: 1000,
      saving: 150,
      durationMinutes: 120,
    });
    expect(detail.body.salon.staff[0]).toMatchObject({
      specialties: ["Balyaj", "Gelin saçı"],
      bio: "10 yıllık deneyim",
    });

    const u = await registerUser();
    const booked = await api()
      .post("/api/appointments")
      .set(u.auth)
      .send({ salonId: b.salon.id, packageId: pkg.body.package.id, date: tomorrow(), time: "10:00" });
    expect(booked.status).toBe(201);
    expect(booked.body.appointment).toMatchObject({ total: 850, isPackage: true });
    expect(booked.body.appointment.services).toHaveLength(2);
  });

  it("ilk ziyaret indirimi yalnızca salondaki ilk randevuya uygulanır", async () => {
    const b = await salonReady();
    await api().patch("/api/business/salon/profile").set(b.auth).send({ firstVisitDiscountPercent: 20 });
    expect((await api().get(`/api/salons/${b.salon.id}`)).body.salon.firstVisitDiscountPercent).toBe(20);
    const u = await registerUser();
    const first = await api()
      .post("/api/appointments")
      .set(u.auth)
      .send({ salonId: b.salon.id, serviceIds: [b.s1], date: tomorrow(), time: "10:00" });
    expect(first.body.appointment).toMatchObject({ total: 480, discount: 120 });
    const second = await api()
      .post("/api/appointments")
      .set(u.auth)
      .send({ salonId: b.salon.id, serviceIds: [b.s1], date: tomorrow(), time: "12:00" });
    expect(second.body.appointment).toMatchObject({ total: 600, discount: 0 });
  });
});
