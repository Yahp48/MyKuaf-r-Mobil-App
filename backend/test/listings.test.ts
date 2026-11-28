import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { api, createSalon, registerUser, resetDb, tomorrow } from "./helpers.ts";
import { prisma } from "../src/lib/prisma.ts";

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

async function createListing() {
  return prisma.salon.create({
    data: {
      slug: `rehber-${Date.now()}`,
      name: "Rehber Kuaför",
      address: "Moda Cad. No:1, Kadıköy/İstanbul",
      city: "İstanbul",
      district: "Kadıköy",
      latitude: 40.98,
      longitude: 29.02,
      phone: "+902160000000",
      isListing: true,
      dataSource: "OpenStreetMap",
      sourceRef: "node/1",
    },
  });
}

describe("rehber kayıtları (gerçek salon, online randevu yok)", () => {
  it("haritada görünür; randevu alınamaz, saat bilgisi yoksa açık/kapalı uydurulmaz", async () => {
    const listing = await createListing();
    const bookable = await createSalon();

    const list = await api().get("/api/salons");
    const l = list.body.items.find((s: { id: string }) => s.id === listing.id);
    expect(l).toMatchObject({
      bookable: false,
      isOpenNow: null,
      nextOpen: null,
      source: { name: "OpenStreetMap", ref: "node/1" },
    });
    expect(list.body.items.find((s: { id: string }) => s.id === bookable.id)).toMatchObject({
      bookable: true,
      source: null,
    });

    const detail = await api().get(`/api/salons/${listing.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.salon.services).toEqual([]);

    const availability = await api()
      .get(`/api/salons/${listing.id}/availability`)
      .query({ date: tomorrow(), serviceIds: bookable.services[0]!.id });
    expect(availability.status).toBe(404);

    const u = await registerUser();
    const booking = await api()
      .post("/api/appointments")
      .set(u.auth)
      .send({ salonId: listing.id, serviceIds: [bookable.services[0]!.id], date: tomorrow(), time: "10:00" });
    expect(booking.status).toBe(404);
  });

  it("işletmesi askıya alınmış salon görünmez; rehber kaydı işletmeye bağlıysa normal kurallara tabidir", async () => {
    const listing = await createListing();
    const biz = await prisma.business.create({
      data: {
        type: "SALON",
        status: "SUSPENDED",
        displayName: "X",
        legalName: "X",
        taxNumber: "11111111110",
        taxOffice: "Kadıköy",
        address: "x",
        city: "İstanbul",
        district: "Kadıköy",
        phone: "02160000000",
        email: "x@example.com",
      },
    });
    await prisma.salon.update({ where: { id: listing.id }, data: { businessId: biz.id } });
    const list = await api().get("/api/salons");
    expect(list.body.items.find((s: { id: string }) => s.id === listing.id)).toBeUndefined();
  });
});

describe("şirket bilgisi", () => {
  it("platformu işleten şirketi yalnızca dolu alanlarla döner", async () => {
    const res = await api().get("/api/meta/company").expect(200);
    expect(res.body.company).toMatchObject({ legalName: "Test Platform A.Ş.", email: "destek@example.test", address: null });
  });
});
