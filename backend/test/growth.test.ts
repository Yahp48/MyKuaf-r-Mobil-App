import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { api, createSalon, registerUser, resetDb, tomorrow } from "./helpers.ts";
import { prisma } from "../src/lib/prisma.ts";
import { notifyWaitlist, sendDueReminders } from "../src/modules/appointments/jobs.ts";
import { onAppointmentCompleted } from "../src/modules/loyalty/service.ts";

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

const HOUR = 3_600_000;

async function makeAppointment(opts: { userId: string; startsAt: Date; createdAt?: Date; totalCents?: number }) {
  const salon = await createSalon();
  return prisma.appointment.create({
    data: {
      code: `T${Math.random().toString(36).slice(2, 10)}`,
      userId: opts.userId,
      salonId: salon.id,
      staffId: salon.staff[0]!.id,
      startsAt: opts.startsAt,
      endsAt: new Date(opts.startsAt.getTime() + 30 * 60_000),
      status: "CONFIRMED",
      totalCents: opts.totalCents ?? 15_000,
      customerName: "Test",
      ...(opts.createdAt ? { createdAt: opts.createdAt } : {}),
    },
  });
}

describe("randevu hatırlatmaları", () => {
  it("24 saat ve 2 saat kala bir kez hatırlatır; geç alınan randevuya 24 saat hatırlatması gitmez", async () => {
    const u = await registerUser();
    const now = new Date();
    const early = await makeAppointment({
      userId: u.user.id,
      startsAt: new Date(now.getTime() + 20 * HOUR),
      createdAt: new Date(now.getTime() - 5 * 24 * HOUR),
    });
    const late = await makeAppointment({
      userId: u.user.id,
      startsAt: new Date(now.getTime() + 20 * HOUR),
      createdAt: new Date(now.getTime() - HOUR),
    });

    expect(await sendDueReminders(now)).toBe(1);
    expect(await sendDueReminders(now)).toBe(0);
    const notes = await prisma.notification.findMany({ where: { userId: u.user.id, type: "appointment_reminder" } });
    expect(notes).toHaveLength(1);
    expect(notes[0]!.title).toBe("Yarın randevunuz var");
    expect((await prisma.appointment.findUniqueOrThrow({ where: { id: late.id } })).reminder24SentAt).not.toBeNull();

    // 2 saat kala
    const soon = new Date(early.startsAt.getTime() - 90 * 60_000);
    expect(await sendDueReminders(soon)).toBe(2);
  });
});

describe("bekleme listesi", () => {
  it("iptal edilen randevunun gününde listedeki kullanıcıya bir kez haber verilir", async () => {
    const salon = await createSalon();
    const waiting = await registerUser();
    const add = await api()
      .post(`/api/salons/${salon.id}/waitlist`)
      .set(waiting.auth)
      .send({ date: tomorrow(), serviceIds: [salon.services[0]!.id] });
    expect(add.status).toBe(201);
    expect((await api().get("/api/appointments/waitlist").set(waiting.auth)).body.items).toHaveLength(1);

    const booker = await registerUser();
    const booked = await api()
      .post("/api/appointments")
      .set(booker.auth)
      .send({ salonId: salon.id, serviceIds: [salon.services[0]!.id], date: tomorrow(), time: "15:00" });
    expect(booked.status).toBe(201);
    const cancel = await api().post(`/api/appointments/${booked.body.appointment.id}/cancel`).set(booker.auth).send({});
    expect(cancel.status).toBe(200);

    const notes = await prisma.notification.findMany({ where: { userId: waiting.user.id, type: "waitlist_slot" } });
    expect(notes).toHaveLength(1);
    expect(await notifyWaitlist(salon.id, new Date(booked.body.appointment.startsAt))).toBe(0);
  });
});

describe("sadakat puanı ve davet", () => {
  it("tamamlanan randevu puan kazandırır (bir kez); davet ödülü iki tarafa verilir; puan cüzdana aktarılır", async () => {
    const inviter = await registerUser();
    const code = (await api().get("/api/loyalty").set(inviter.auth)).body.referralCode as string;
    expect(code).toMatch(/^[A-Z0-9]{6}$/);

    const bad = await api()
      .post("/api/auth/register")
      .send({
        name: "Yeni",
        email: `x${Date.now()}@example.com`,
        password: "Sifre12345",
        acceptTerms: true,
        referralCode: "ZZZZZZ",
      });
    expect(bad.status).toBe(400);
    const friend = await registerUser({ referralCode: code });

    const a = await makeAppointment({
      userId: friend.user.id,
      startsAt: new Date(Date.now() - HOUR),
      totalCents: 250_000,
    });
    await prisma.appointment.update({ where: { id: a.id }, data: { status: "COMPLETED", completedAt: new Date() } });
    await onAppointmentCompleted(a.id);
    await onAppointmentCompleted(a.id);

    const mine = await api().get("/api/loyalty").set(friend.auth);
    expect(mine.body.points).toBe(250 + 200); // 2500 TL → 250 puan + davet 200
    const theirs = await api().get("/api/loyalty").set(inviter.auth);
    expect(theirs.body).toMatchObject({ points: 200, invitedCount: 1 });

    const tooFew = await api().post("/api/loyalty/redeem").set(inviter.auth).send({ points: 100 });
    expect(tooFew.status).toBe(400);
    const redeem = await api().post("/api/loyalty/redeem").set(inviter.auth).send({ points: 200 });
    expect(redeem.body).toMatchObject({ points: 0, credited: 10, walletBalance: 10 });
    const wallet = await api().get("/api/wallet").set(inviter.auth);
    expect(wallet.body.transactions.items[0]).toMatchObject({ type: "LOYALTY", amount: 10 });
  });
});
