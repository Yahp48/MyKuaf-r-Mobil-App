import { priceOn } from "./discount.ts";
import { DateTime } from "luxon";
import { prisma } from "../../lib/prisma.ts";
import { AppError, notFound } from "../../lib/errors.ts";

export const ACTIVE_APPOINTMENT_STATUSES = ["PENDING", "CONFIRMED"] as const;

export interface SalonForAvailability {
  id: string;
  timezone: string;
  slotIntervalMinutes: number;
  bookingLeadMinutes: number;
  bookingHorizonDays: number;
}

interface Interval {
  start: number; // epoch ms
  end: number;
}

const overlaps = (a: Interval, b: Interval) => a.start < b.end && b.start < a.end;

/** "YYYY-MM-DD" tarihini salonun saat diliminde gün başlangıcı olarak yorumlar. */
export function salonDay(date: string, timezone: string): DateTime {
  const day = DateTime.fromISO(date, { zone: timezone });
  if (!day.isValid) throw new AppError(400, "INVALID_DATE", "Geçersiz tarih");
  return day.startOf("day");
}

/**
 * Belirtilen gün için her personelin boş başlangıç saatlerini hesaplar.
 * Çalışma saatleri, personel izinleri, mevcut randevular, hazırlık süresi ve rezervasyon ufku dikkate alınır.
 */
export async function computeAvailability(params: {
  salon: SalonForAvailability;
  date: string;
  durationMinutes: number;
  staffId?: string;
  now?: Date;
  /** Saat değiştirmede randevunun kendi aralığı dolu sayılmaz. */
  excludeAppointmentId?: string;
  /** Salon kendisi randevu girerken hazırlık süresi kuralı uygulanmaz. */
  skipLeadTime?: boolean;
}): Promise<{ staffId: string; slots: string[] }[]> {
  const { salon, date, durationMinutes } = params;
  const now = DateTime.fromJSDate(params.now ?? new Date());
  const day = salonDay(date, salon.timezone);

  const horizonEnd = now.setZone(salon.timezone).startOf("day").plus({ days: salon.bookingHorizonDays });
  if (day < now.setZone(salon.timezone).startOf("day") || day > horizonEnd) return [];

  const hours = await prisma.workingHours.findUnique({
    where: { salonId_weekday: { salonId: salon.id, weekday: day.weekday } },
  });
  if (!hours || hours.isClosed) return [];

  const staff = await prisma.staff.findMany({
    where: { salonId: salon.id, isActive: true, ...(params.staffId ? { id: params.staffId } : {}) },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true },
  });
  if (params.staffId && staff.length === 0) throw notFound("Personel bulunamadı");
  if (!staff.length) return [];

  const dayStart = day.toJSDate();
  const dayEnd = day.plus({ days: 1 }).toJSDate();
  const staffIds = staff.map((s) => s.id);

  const [appointments, timeOff] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        staffId: { in: staffIds },
        status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
        ...(params.excludeAppointmentId ? { id: { not: params.excludeAppointmentId } } : {}),
        startsAt: { lt: dayEnd },
        endsAt: { gt: dayStart },
      },
      select: { staffId: true, startsAt: true, endsAt: true },
    }),
    prisma.staffTimeOff.findMany({
      where: { staffId: { in: staffIds }, startsAt: { lt: dayEnd }, endsAt: { gt: dayStart } },
      select: { staffId: true, startsAt: true, endsAt: true },
    }),
  ]);

  const busy = new Map<string, Interval[]>();
  for (const b of [...appointments, ...timeOff]) {
    const list = busy.get(b.staffId) ?? [];
    list.push({ start: b.startsAt.getTime(), end: b.endsAt.getTime() });
    busy.set(b.staffId, list);
  }

  const earliest = now.plus({ minutes: params.skipLeadTime ? 0 : salon.bookingLeadMinutes }).toMillis();
  const step = salon.slotIntervalMinutes;

  return staffIds.map((staffId) => {
    const slots: string[] = [];
    const blocked = busy.get(staffId) ?? [];
    for (let m = hours.openMinute; m + durationMinutes <= hours.closeMinute; m += step) {
      const start = day.plus({ minutes: m });
      const slot = { start: start.toMillis(), end: start.plus({ minutes: durationMinutes }).toMillis() };
      if (slot.start < earliest) continue;
      if (blocked.some((b) => overlaps(slot, b))) continue;
      slots.push(start.toFormat("HH:mm"));
    }
    return { staffId, slots };
  });
}

/** Seçilen hizmetleri doğrular, toplam süre ve fiyatı hesaplar. */
/**
 * Seçilen hizmetleri doğrular. `day` (YYYY-MM-DD) verilirse o günün indirimli fiyatı `chargedCents` olarak döner.
 */
export async function resolveServices(salonId: string, serviceIds: string[], day?: string) {
  const unique = [...new Set(serviceIds)];
  const services = await prisma.service.findMany({
    where: { id: { in: unique }, salonId, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  if (services.length !== unique.length) {
    throw new AppError(400, "INVALID_SERVICES", "Seçilen hizmetlerden biri bu salonda bulunmuyor");
  }
  const priced = services.map((s) => ({ ...s, chargedCents: day ? priceOn(s, day) : s.priceCents }));
  return {
    services: priced,
    durationMinutes: priced.reduce((sum, s) => sum + s.durationMinutes, 0),
    totalCents: priced.reduce((sum, s) => sum + s.chargedCents, 0),
  };
}
