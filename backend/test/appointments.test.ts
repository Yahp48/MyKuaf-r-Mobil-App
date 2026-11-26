import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import { api, createSalon, registerUser, resetDb, tomorrow } from "./helpers.ts";
import { prisma } from "../src/lib/prisma.ts";

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe("müsaitlik", () => {
  it("çalışma saatlerine ve hizmet süresine göre boş saatleri listeler", async () => {
    const salon = await createSalon();
    const res = await api()
      .get(`/api/salons/${salon.id}/availability`)
      .query({ date: tomorrow(), serviceIds: salon.services[1]!.id }); // 90 dk boya
    expect(res.status).toBe(200);
    expect(res.body.durationMinutes).toBe(90);
    const slots: string[] = res.body.staff[0].slots;
    expect(slots[0]).toBe("09:00");
    // 18:00 kapanış: 90 dk hizmet en geç 16:30'da başlar
    expect(slots.at(-1)).toBe("16:30");
  });

  it("başka salonun hizmetini kabul etmez", async () => {
    const a = await createSalon();
    const b = await createSalon();
    const res = await api()
      .get(`/api/salons/${a.id}/availability`)
      .query({ date: tomorrow(), serviceIds: b.services[0]!.id });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_SERVICES");
  });

  it("geçmiş tarih için boş saat vermez", async () => {
    const salon = await createSalon();
    const yesterday = DateTime.now().setZone("Europe/Istanbul").minus({ days: 1 }).toFormat("yyyy-MM-dd");
    const res = await api()
      .get(`/api/salons/${salon.id}/availability`)
      .query({ date: yesterday, serviceIds: salon.services[0]!.id });
    expect(res.body.staff).toEqual([]);
  });
});

describe("randevu alma", () => {
  it("randevu oluşturur; fiyat sunucuda hesaplanır ve saat doluya döner", async () => {
    const salon = await createSalon();
    const u = await registerUser();
    const staff = salon.staff[0]!;
    const res = await api()
      .post("/api/appointments")
      .set(u.auth)
      .send({
        salonId: salon.id,
        staffId: staff.id,
        serviceIds: [salon.services[0]!.id, salon.services[1]!.id],
        date: tomorrow(),
        time: "10:00",
      });
    expect(res.status).toBe(201);
    expect(res.body.appointment.total).toBe(450);
    expect(res.body.appointment.status).toBe("CONFIRMED");
    expect(res.body.appointment.time).toBe("10:00");
    expect(res.body.appointment.code).toMatch(/^RV-/);

    // 10:00-12:00 arası bu personel için dolu
    const avail = await api()
      .get(`/api/salons/${salon.id}/availability`)
      .query({ date: tomorrow(), serviceIds: salon.services[0]!.id, staffId: staff.id });
    const slots: string[] = avail.body.staff[0].slots;
    expect(slots).not.toContain("10:00");
    expect(slots).not.toContain("11:30");
    expect(slots).toContain("12:00");
    expect(slots).toContain("09:30");

    // Bildirim oluşturuldu
    const notes = await api().get("/api/notifications").set(u.auth);
    expect(notes.body.unreadCount).toBe(1);
  });

  it("aynı anda gelen iki istekte yalnızca biri başarılı olur (çift rezervasyon yok)", async () => {
    const salon = await createSalon();
    const [u1, u2] = await Promise.all([registerUser(), registerUser()]);
    const body = {
      salonId: salon.id,
      staffId: salon.staff[0]!.id,
      serviceIds: [salon.services[0]!.id],
      date: tomorrow(),
      time: "14:00",
    };
    const results = await Promise.all([
      api().post("/api/appointments").set(u1.auth).send(body),
      api().post("/api/appointments").set(u2.auth).send(body),
    ]);
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([201, 409]);
    expect(results.find((r) => r.status === 409)!.body.error.code).toBe("SLOT_UNAVAILABLE");
    expect(await prisma.appointment.count()).toBe(1);
  });

  it("personel seçilmezse müsait olan personeli atar", async () => {
    const salon = await createSalon();
    const [u1, u2] = await Promise.all([registerUser(), registerUser()]);
    const body = { salonId: salon.id, serviceIds: [salon.services[0]!.id], date: tomorrow(), time: "15:00" };
    const a = await api().post("/api/appointments").set(u1.auth).send(body);
    const b = await api().post("/api/appointments").set(u2.auth).send(body);
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(a.body.appointment.staff.id).not.toBe(b.body.appointment.staff.id);
  });

  it("başkasının randevusunu göremez ve iptal edemez", async () => {
    const salon = await createSalon();
    const [owner, other] = await Promise.all([registerUser(), registerUser()]);
    const created = await api()
      .post("/api/appointments")
      .set(owner.auth)
      .send({ salonId: salon.id, serviceIds: [salon.services[0]!.id], date: tomorrow(), time: "11:00" });
    const id = created.body.appointment.id;
    expect((await api().get(`/api/appointments/${id}`).set(other.auth)).status).toBe(404);
    expect((await api().post(`/api/appointments/${id}/cancel`).set(other.auth).send({})).status).toBe(404);
  });
});

describe("randevu iptali", () => {
  it("iptal edilen randevunun saati yeniden müsait olur", async () => {
    const salon = await createSalon();
    const u = await registerUser();
    const staffId = salon.staff[0]!.id;
    const created = await api()
      .post("/api/appointments")
      .set(u.auth)
      .send({ salonId: salon.id, staffId, serviceIds: [salon.services[0]!.id], date: tomorrow(), time: "16:00" });
    const id = created.body.appointment.id;

    const cancel = await api().post(`/api/appointments/${id}/cancel`).set(u.auth).send({ reason: "Gelemeyeceğim" });
    expect(cancel.status).toBe(200);
    expect(cancel.body.appointment.status).toBe("CANCELLED");

    const avail = await api()
      .get(`/api/salons/${salon.id}/availability`)
      .query({ date: tomorrow(), serviceIds: salon.services[0]!.id, staffId });
    expect(avail.body.staff[0].slots).toContain("16:00");
  });

  it("iptal süresi geçmişse uygulamadan iptal edilemez", async () => {
    // 48 saatlik iptal kuralı: yarınki randevu artık iptal edilemez
    const salon = await createSalon({ cancellationWindowHours: 48 });
    const u = await registerUser();
    const created = await api()
      .post("/api/appointments")
      .set(u.auth)
      .send({ salonId: salon.id, serviceIds: [salon.services[0]!.id], date: tomorrow(), time: "17:00" });
    expect(created.body.appointment.canCancel).toBe(false);
    const res = await api().post(`/api/appointments/${created.body.appointment.id}/cancel`).set(u.auth).send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("CANNOT_CANCEL");
  });
});
