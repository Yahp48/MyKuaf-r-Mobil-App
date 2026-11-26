import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma, pgErrorCode } from "../src/lib/prisma.ts";
import { createSalon, resetDb } from "./helpers.ts";

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

// Eşzamanlılık testleri yarışı her seferinde tetikleyemediği için veritabanı kısıtları doğrudan sınanır.
describe("veritabanı bütünlük kısıtları", () => {
  it("çakışan randevuyu reddeder ve kod 23P01 olarak okunur", async () => {
    const salon = await createSalon();
    const base = {
      salonId: salon.id,
      staffId: salon.staff[0]!.id,
      startsAt: new Date("2030-01-01T10:00:00Z"),
      endsAt: new Date("2030-01-01T11:00:00Z"),
      status: "CONFIRMED" as const,
      totalCents: 100,
      customerName: "Test",
    };
    await prisma.appointment.create({ data: { ...base, code: "RV-A" } });
    const err = await prisma.appointment
      .create({ data: { ...base, code: "RV-B", startsAt: new Date("2030-01-01T10:30:00Z") } })
      .catch((e: unknown) => e);
    expect(pgErrorCode(err)).toBe("23P01");

    // İptal edilmiş randevu saati bloklamaz; bitişik randevu çakışma sayılmaz
    await prisma.appointment.create({ data: { ...base, code: "RV-C", status: "CANCELLED" } });
    await prisma.appointment.create({
      data: { ...base, code: "RV-D", startsAt: base.endsAt, endsAt: new Date("2030-01-01T11:30:00Z") },
    });
  });

  it("benzersizlik ihlali 23505 olarak okunur", async () => {
    await prisma.user.create({ data: { email: "a@example.com", name: "A" } });
    const err = await prisma.user.create({ data: { email: "a@example.com", name: "B" } }).catch((e: unknown) => e);
    expect(pgErrorCode(err)).toBe("23505");
  });

  it("stok ve cüzdan eksiye düşemez", async () => {
    const u = await prisma.user.create({ data: { email: "b@example.com", name: "B" } });
    const err = await prisma.user
      .update({ where: { id: u.id }, data: { walletBalanceCents: { decrement: 1 } } })
      .catch((e: unknown) => e);
    expect(pgErrorCode(err)).toBe("23514");
  });
});
