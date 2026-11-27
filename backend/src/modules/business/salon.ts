import { Router } from "express";
import { z } from "zod";
import { DateTime } from "luxon";
import { prisma, pgErrorCode } from "../../lib/prisma.ts";
import { pageResult, paginate, parse, zId, zName, zPagination, zPhone } from "../../lib/validate.ts";
import { AppError, conflict, notFound } from "../../lib/errors.ts";
import { humanCode } from "../../lib/codes.ts";
import { fromTL, toTL } from "../../lib/money.ts";
import { shortName } from "../../lib/names.ts";
import { requireAuth } from "../../middleware/auth.ts";
import { requireBusiness, salonOf } from "../../middleware/business.ts";
import { broadcast, emitToBusiness, emitToUser } from "../../realtime/socket.ts";
import { notify } from "../notifications/notify.ts";
import { ACTIVE_APPOINTMENT_STATUSES, computeAvailability, resolveServices, salonDay } from "../salons/availability.ts";
import { discountedCents, isoDay, todayIn } from "../salons/discount.ts";
import { serializeSalonProfile } from "./serialize.ts";
import type { Prisma, Salon } from "../../generated/prisma/client.ts";

/** Kuaför işletmesi paneli: /api/business/salon */
export const salonPanelRouter = Router();
salonPanelRouter.use(requireAuth, requireBusiness("SALON"));

const zDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih YYYY-AA-GG biçiminde olmalı");
const zTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Saat SS:DD biçiminde olmalı");
const zMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Ay YYYY-AA biçiminde olmalı");
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const toMinute = (t: string) => {
  const [h, m] = t.split(":").map(Number) as [number, number];
  return h * 60 + m;
};

/** Haritadaki görünürlük salon verisine bağlı: her değişiklikte müşteri uygulamaları tazelenir. */
const salonChanged = (salon: Salon) => broadcast("salons:changed", { salonId: salon.id });

// ───────────── Randevular ─────────────

const apptInclude = {
  staff: { select: { id: true, name: true, title: true } },
  services: true,
  review: { select: { rating: true, comment: true } },
} satisfies Prisma.AppointmentInclude;
type ApptRow = Prisma.AppointmentGetPayload<{ include: typeof apptInclude }>;

function serializeAppt(a: ApptRow, tz: string) {
  const start = DateTime.fromJSDate(a.startsAt).setZone(tz);
  const end = DateTime.fromJSDate(a.endsAt).setZone(tz);
  return {
    id: a.id,
    code: a.code,
    status: a.status,
    source: a.source,
    startsAt: a.startsAt.toISOString(),
    endsAt: a.endsAt.toISOString(),
    date: start.toFormat("yyyy-MM-dd"),
    time: start.toFormat("HH:mm"),
    endTime: end.toFormat("HH:mm"),
    durationMinutes: Math.round((a.endsAt.getTime() - a.startsAt.getTime()) / 60_000),
    total: toTL(a.totalCents),
    customer: { name: a.customerName, phone: a.customerPhone, isAppUser: !!a.userId },
    customerNote: a.customerNote,
    businessNote: a.businessNote,
    staff: a.staff,
    services: a.services.map((s) => ({
      id: s.serviceId,
      name: s.nameSnapshot,
      price: toTL(s.priceCents),
      durationMinutes: s.durationMinutes,
    })),
    review: a.review,
    cancelReason: a.cancelReason,
    cancelledAt: a.cancelledAt?.toISOString() ?? null,
    completedAt: a.completedAt?.toISOString() ?? null,
    createdAt: a.createdAt.toISOString(),
  };
}

const listSchema = z.object({
  from: zDate,
  to: zDate,
  staffId: zId.optional(),
  status: z.enum(["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"]).optional(),
  q: z.string().trim().max(80).optional(),
});

salonPanelRouter.get("/appointments", async (req, res) => {
  const salon = salonOf(req);
  const q = parse(listSchema, req.query);
  const from = salonDay(q.from, salon.timezone);
  const to = salonDay(q.to, salon.timezone).plus({ days: 1 });
  if (to.diff(from, "days").days > 62)
    throw new AppError(400, "RANGE_TOO_LARGE", "En fazla 2 aylık aralık seçilebilir");
  const rows = await prisma.appointment.findMany({
    where: {
      salonId: salon.id,
      startsAt: { gte: from.toJSDate(), lt: to.toJSDate() },
      ...(q.staffId ? { staffId: q.staffId } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.q
        ? {
            OR: [
              { customerName: { contains: q.q, mode: "insensitive" } },
              { customerPhone: { contains: q.q } },
              { code: { contains: q.q.toUpperCase() } },
            ],
          }
        : {}),
    },
    include: apptInclude,
    orderBy: { startsAt: "asc" },
  });
  res.json({ items: rows.map((a) => serializeAppt(a, salon.timezone)) });
});

salonPanelRouter.get("/appointments/:id", async (req, res) => {
  const salon = salonOf(req);
  const a = await prisma.appointment.findFirst({
    where: { id: parse(zId, req.params.id), salonId: salon.id },
    include: apptInclude,
  });
  if (!a) throw notFound("Randevu bulunamadı");
  // Müşterinin bu salondaki geçmişi (aynı uygulama hesabı ya da aynı telefon)
  const history = await prisma.appointment.findMany({
    where: {
      salonId: salon.id,
      id: { not: a.id },
      OR: [
        ...(a.userId ? [{ userId: a.userId }] : []),
        ...(a.customerPhone ? [{ customerPhone: a.customerPhone }] : []),
      ],
    },
    include: apptInclude,
    orderBy: { startsAt: "desc" },
    take: 10,
  });
  res.json({
    appointment: serializeAppt(a, salon.timezone),
    history: a.userId || a.customerPhone ? history.map((h) => serializeAppt(h, salon.timezone)) : [],
  });
});

const availabilitySchema = z.object({
  date: zDate,
  serviceIds: z
    .union([z.string(), z.array(z.string())])
    .transform((v) => (Array.isArray(v) ? v : v.split(",")).filter(Boolean))
    .pipe(z.array(zId).min(1, "En az bir hizmet seçin")),
  staffId: zId.optional(),
  excludeAppointmentId: zId.optional(),
});

salonPanelRouter.get("/availability", async (req, res) => {
  const salon = salonOf(req);
  const q = parse(availabilitySchema, req.query);
  const { durationMinutes } = await resolveServices(salon.id, q.serviceIds);
  const staff = await computeAvailability({
    salon,
    date: q.date,
    durationMinutes,
    staffId: q.staffId,
    excludeAppointmentId: q.excludeAppointmentId,
    skipLeadTime: true,
  });
  res.json({ date: q.date, durationMinutes, staff });
});

const manualSchema = z.object({
  staffId: zId,
  serviceIds: z.array(zId).min(1, "En az bir hizmet seçin").max(10),
  date: zDate,
  time: zTime,
  customerName: zName,
  customerPhone: zPhone,
  businessNote: z.string().trim().max(500).optional(),
});

/** Telefonla veya kapıdan gelen müşteri için salonun kendisinin girdiği randevu. */
salonPanelRouter.post("/appointments", async (req, res) => {
  const salon = salonOf(req);
  const body = parse(manualSchema, req.body);
  const { services, durationMinutes, totalCents } = await resolveServices(salon.id, body.serviceIds, body.date);
  const avail = await computeAvailability({
    salon,
    date: body.date,
    durationMinutes,
    staffId: body.staffId,
    skipLeadTime: true,
  });
  if (!avail[0]?.slots.includes(body.time)) {
    throw conflict("SLOT_UNAVAILABLE", "Bu personel seçilen saatte müsait değil");
  }
  const start = salonDay(body.date, salon.timezone).plus({ minutes: toMinute(body.time) });
  try {
    const a = await prisma.appointment.create({
      data: {
        code: humanCode("RV"),
        salonId: salon.id,
        staffId: body.staffId,
        source: "MANUAL",
        status: "CONFIRMED",
        startsAt: start.toJSDate(),
        endsAt: start.plus({ minutes: durationMinutes }).toJSDate(),
        totalCents,
        customerName: body.customerName,
        customerPhone: body.customerPhone,
        businessNote: body.businessNote,
        services: {
          create: services.map((s) => ({
            serviceId: s.id,
            nameSnapshot: s.name,
            priceCents: s.chargedCents,
            listPriceCents: s.priceCents,
            durationMinutes: s.durationMinutes,
          })),
        },
      },
      include: apptInclude,
    });
    emitToBusiness(salon.businessId!, "appointment:new", { id: a.id });
    res.status(201).json({ appointment: serializeAppt(a, salon.timezone) });
  } catch (err) {
    if (pgErrorCode(err) === "23P01") throw conflict("SLOT_UNAVAILABLE", "Bu saat az önce doldu");
    throw err;
  }
});

// İzin verilen durum geçişleri
const TRANSITIONS: Record<string, string[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["COMPLETED", "NO_SHOW", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: ["COMPLETED"],
};

const statusSchema = z
  .object({
    status: z.enum(["CONFIRMED", "COMPLETED", "NO_SHOW", "CANCELLED"]),
    reason: z.string().trim().max(300).optional(),
  })
  .refine((v) => v.status !== "CANCELLED" || (v.reason && v.reason.length >= 3), {
    message: "İptal sebebi yazın (müşteriye iletilir)",
    path: ["reason"],
  });

salonPanelRouter.post("/appointments/:id/status", async (req, res) => {
  const salon = salonOf(req);
  const id = parse(zId, req.params.id);
  const body = parse(statusSchema, req.body);
  const a = await prisma.appointment.findFirst({ where: { id, salonId: salon.id } });
  if (!a) throw notFound("Randevu bulunamadı");
  if (!TRANSITIONS[a.status]!.includes(body.status)) {
    throw new AppError(400, "INVALID_TRANSITION", "Randevu bu duruma geçirilemez");
  }
  if ((body.status === "COMPLETED" || body.status === "NO_SHOW") && a.startsAt > new Date()) {
    throw new AppError(400, "NOT_STARTED", "Başlamamış randevu tamamlandı veya gelmedi olarak işaretlenemez");
  }
  const updated = await prisma.appointment.update({
    where: { id },
    data: {
      status: body.status,
      ...(body.status === "COMPLETED" ? { completedAt: new Date() } : {}),
      ...(body.status === "CANCELLED" ? { cancelledAt: new Date(), cancelReason: body.reason } : {}),
    },
    include: apptInclude,
  });
  const out = serializeAppt(updated, salon.timezone);
  emitToBusiness(salon.businessId!, "appointment:updated", { id });
  if (a.userId) {
    emitToUser(a.userId, "appointment:updated", { id });
    if (body.status === "CONFIRMED") {
      await notify(a.userId, {
        type: "appointment_confirmed",
        title: "Randevunuz onaylandı",
        body: `${salon.name} · ${out.date} ${out.time}`,
        data: { appointmentId: id },
      });
    } else if (body.status === "CANCELLED") {
      await notify(a.userId, {
        type: "appointment_cancelled",
        title: "Randevunuz salon tarafından iptal edildi",
        body: `${salon.name} · ${out.date} ${out.time}. Sebep: ${body.reason}`,
        data: { appointmentId: id },
      });
    }
  }
  res.json({ appointment: out });
});

const updateSchema = z.object({
  date: zDate.optional(),
  time: zTime.optional(),
  staffId: zId.optional(),
  businessNote: z.string().trim().max(500).nullable().optional(),
});

/** Saat/personel değiştirme ve salon notu. */
salonPanelRouter.patch("/appointments/:id", async (req, res) => {
  const salon = salonOf(req);
  const id = parse(zId, req.params.id);
  const body = parse(updateSchema, req.body);
  const a = await prisma.appointment.findFirst({ where: { id, salonId: salon.id }, include: apptInclude });
  if (!a) throw notFound("Randevu bulunamadı");

  const data: Prisma.AppointmentUpdateInput = {};
  if (body.businessNote !== undefined) data.businessNote = body.businessNote;

  const moving = body.date || body.time || body.staffId;
  if (moving) {
    if (!(ACTIVE_APPOINTMENT_STATUSES as readonly string[]).includes(a.status)) {
      throw new AppError(400, "NOT_ACTIVE", "Yalnızca aktif randevuların saati değiştirilebilir");
    }
    const cur = serializeAppt(a, salon.timezone);
    const date = body.date ?? cur.date;
    const time = body.time ?? cur.time;
    const staffId = body.staffId ?? a.staffId;
    const duration = cur.durationMinutes;
    const avail = await computeAvailability({
      salon,
      date,
      durationMinutes: duration,
      staffId,
      excludeAppointmentId: a.id,
      skipLeadTime: true,
    });
    if (!avail[0]?.slots.includes(time)) throw conflict("SLOT_UNAVAILABLE", "Seçilen personel bu saatte müsait değil");
    const start = salonDay(date, salon.timezone).plus({ minutes: toMinute(time) });
    data.startsAt = start.toJSDate();
    data.endsAt = start.plus({ minutes: duration }).toJSDate();
    data.staff = { connect: { id: staffId } };
  }

  let updated: ApptRow;
  try {
    updated = await prisma.appointment.update({ where: { id }, data, include: apptInclude });
  } catch (err) {
    if (pgErrorCode(err) === "23P01") throw conflict("SLOT_UNAVAILABLE", "Bu saat az önce doldu");
    throw err;
  }
  const out = serializeAppt(updated, salon.timezone);
  emitToBusiness(salon.businessId!, "appointment:updated", { id });
  if (moving && a.userId) {
    emitToUser(a.userId, "appointment:updated", { id });
    await notify(a.userId, {
      type: "appointment_confirmed",
      title: "Randevu saatiniz güncellendi",
      body: `${salon.name} · yeni zaman: ${out.date} ${out.time} · ${out.staff.name}`,
      data: { appointmentId: id },
    });
  }
  res.json({ appointment: out });
});

// ───────────── Özet ─────────────

salonPanelRouter.get("/overview", async (req, res) => {
  const salon = salonOf(req);
  const tz = salon.timezone;
  const now = DateTime.now().setZone(tz);
  const today = now.startOf("day");
  const monthStart = now.startOf("month");
  const seriesStart = today.minus({ days: 13 });

  const [todayAppts, monthCompleted, last30, staffCount, serviceCount, hours, series, pending] = await Promise.all([
    prisma.appointment.findMany({
      where: { salonId: salon.id, startsAt: { gte: today.toJSDate(), lt: today.plus({ days: 1 }).toJSDate() } },
      include: apptInclude,
      orderBy: { startsAt: "asc" },
    }),
    prisma.appointment.aggregate({
      where: { salonId: salon.id, status: "COMPLETED", startsAt: { gte: monthStart.toJSDate() } },
      _sum: { totalCents: true },
      _count: true,
    }),
    prisma.appointment.groupBy({
      by: ["status"],
      where: { salonId: salon.id, startsAt: { gte: today.minus({ days: 30 }).toJSDate(), lt: now.toJSDate() } },
      _count: true,
    }),
    prisma.staff.count({ where: { salonId: salon.id, isActive: true } }),
    prisma.service.count({ where: { salonId: salon.id, isActive: true } }),
    prisma.workingHours.findMany({ where: { salonId: salon.id } }),
    prisma.appointment.findMany({
      where: { salonId: salon.id, status: "COMPLETED", startsAt: { gte: seriesStart.toJSDate() } },
      select: { startsAt: true, totalCents: true },
    }),
    prisma.appointment.count({ where: { salonId: salon.id, status: "PENDING", startsAt: { gte: now.toJSDate() } } }),
  ]);

  const active = todayAppts.filter((a) => a.status !== "CANCELLED");
  const todayHours = hours.find((h) => h.weekday === now.weekday);
  const openMinutes = todayHours && !todayHours.isClosed ? todayHours.closeMinute - todayHours.openMinute : 0;
  const bookedMinutes = active.reduce((n, a) => n + (a.endsAt.getTime() - a.startsAt.getTime()) / 60_000, 0);
  const capacity = openMinutes * staffCount;
  const total30 = last30.reduce((n, g) => n + g._count, 0);
  const cancelled30 = last30
    .filter((g) => g.status === "CANCELLED" || g.status === "NO_SHOW")
    .reduce((n, g) => n + g._count, 0);

  const byDay = new Map<string, number>();
  for (const s of series) {
    const k = DateTime.fromJSDate(s.startsAt).setZone(tz).toFormat("yyyy-MM-dd");
    byDay.set(k, (byDay.get(k) ?? 0) + s.totalCents);
  }

  res.json({
    date: today.toFormat("yyyy-MM-dd"),
    today: {
      appointments: todayAppts.map((a) => serializeAppt(a, tz)),
      count: active.length,
      expectedRevenue: toTL(active.reduce((n, a) => n + a.totalCents, 0)),
      occupancy: capacity ? Math.min(100, Math.round((bookedMinutes / capacity) * 100)) : 0,
    },
    month: { revenue: toTL(monthCompleted._sum.totalCents ?? 0), completed: monthCompleted._count },
    cancellationRate30d: total30 ? Math.round((cancelled30 / total30) * 100) : 0,
    pendingApprovals: pending,
    rating: { value: Math.round(salon.ratingAvg * 10) / 10, count: salon.ratingCount },
    revenueSeries: Array.from({ length: 14 }, (_, i) => {
      const d = seriesStart.plus({ days: i }).toFormat("yyyy-MM-dd");
      return { date: d, value: toTL(byDay.get(d) ?? 0) };
    }),
    setup: {
      hasStaff: staffCount > 0,
      hasServices: serviceCount > 0,
      hasOpenDay: hours.some((h) => !h.isClosed),
      isActive: salon.isActive,
      visibleOnMap: salon.isActive && staffCount > 0 && serviceCount > 0,
    },
  });
});

// ───────────── Personel ─────────────

const staffSchema = z.object({
  name: zName,
  title: z.string().trim().max(60).optional().nullable(),
  avatarUrl: z.string().url().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
});

const serializeStaff = (s: {
  id: string;
  name: string;
  title: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  sortOrder: number;
}) => ({
  id: s.id,
  name: s.name,
  title: s.title,
  avatarUrl: s.avatarUrl,
  isActive: s.isActive,
  sortOrder: s.sortOrder,
});

salonPanelRouter.get("/staff", async (req, res) => {
  const salon = salonOf(req);
  const monthStart = DateTime.now().setZone(salon.timezone).startOf("month").toJSDate();
  const staff = await prisma.staff.findMany({
    where: { salonId: salon.id },
    orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
  });
  const stats = await prisma.appointment.groupBy({
    by: ["staffId"],
    where: { salonId: salon.id, status: "COMPLETED", startsAt: { gte: monthStart } },
    _count: true,
    _sum: { totalCents: true },
  });
  const upcoming = await prisma.appointment.groupBy({
    by: ["staffId"],
    where: { salonId: salon.id, status: { in: [...ACTIVE_APPOINTMENT_STATUSES] }, startsAt: { gte: new Date() } },
    _count: true,
  });
  res.json({
    items: staff.map((s) => {
      const st = stats.find((x) => x.staffId === s.id);
      return {
        ...serializeStaff(s),
        monthCompleted: st?._count ?? 0,
        monthRevenue: toTL(st?._sum.totalCents ?? 0),
        upcomingCount: upcoming.find((x) => x.staffId === s.id)?._count ?? 0,
      };
    }),
  });
});

salonPanelRouter.post("/staff", async (req, res) => {
  const salon = salonOf(req);
  const body = parse(staffSchema, req.body);
  if ((await prisma.staff.count({ where: { salonId: salon.id } })) >= 50) {
    throw new AppError(400, "STAFF_LIMIT", "En fazla 50 personel eklenebilir");
  }
  const staff = await prisma.staff.create({ data: { ...body, salonId: salon.id } });
  salonChanged(salon);
  res.status(201).json({ staff: serializeStaff(staff) });
});

async function ownStaff(salonId: string, id: string) {
  const s = await prisma.staff.findFirst({ where: { id, salonId } });
  if (!s) throw notFound("Personel bulunamadı");
  return s;
}

salonPanelRouter.patch("/staff/:id", async (req, res) => {
  const salon = salonOf(req);
  const id = parse(zId, req.params.id);
  const body = parse(staffSchema.partial(), req.body);
  await ownStaff(salon.id, id);
  if (body.isActive === false) {
    const future = await prisma.appointment.count({
      where: { staffId: id, status: { in: [...ACTIVE_APPOINTMENT_STATUSES] }, startsAt: { gte: new Date() } },
    });
    if (future) {
      throw conflict(
        "STAFF_HAS_APPOINTMENTS",
        `Bu personelin ${future} ileri tarihli randevusu var. Önce randevuları başka personele aktarın veya iptal edin.`,
      );
    }
  }
  const staff = await prisma.staff.update({ where: { id }, data: body });
  salonChanged(salon);
  res.json({ staff: serializeStaff(staff) });
});

/** Randevu geçmişi olan personel silinmez, pasife alınır (geçmiş kayıtlar ve raporlar bozulmasın). */
salonPanelRouter.delete("/staff/:id", async (req, res) => {
  const salon = salonOf(req);
  const id = parse(zId, req.params.id);
  await ownStaff(salon.id, id);
  const future = await prisma.appointment.count({
    where: { staffId: id, status: { in: [...ACTIVE_APPOINTMENT_STATUSES] }, startsAt: { gte: new Date() } },
  });
  if (future) {
    throw conflict(
      "STAFF_HAS_APPOINTMENTS",
      `Bu personelin ${future} ileri tarihli randevusu var. Önce randevuları başka personele aktarın veya iptal edin.`,
    );
  }
  const any = await prisma.appointment.count({ where: { staffId: id } });
  if (any) await prisma.staff.update({ where: { id }, data: { isActive: false } });
  else await prisma.staff.delete({ where: { id } });
  salonChanged(salon);
  res.json({ deleted: !any, deactivated: !!any });
});

const timeOffSchema = z
  .object({
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }),
    reason: z.string().trim().max(120).optional(),
  })
  .refine((v) => new Date(v.endsAt) > new Date(v.startsAt), {
    message: "Bitiş başlangıçtan sonra olmalı",
    path: ["endsAt"],
  });

salonPanelRouter.get("/staff/:id/time-off", async (req, res) => {
  const salon = salonOf(req);
  const id = parse(zId, req.params.id);
  await ownStaff(salon.id, id);
  const rows = await prisma.staffTimeOff.findMany({
    where: { staffId: id, endsAt: { gte: DateTime.now().minus({ days: 30 }).toJSDate() } },
    orderBy: { startsAt: "asc" },
  });
  res.json({
    items: rows.map((t) => ({
      id: t.id,
      startsAt: t.startsAt.toISOString(),
      endsAt: t.endsAt.toISOString(),
      reason: t.reason,
    })),
  });
});

salonPanelRouter.post("/staff/:id/time-off", async (req, res) => {
  const salon = salonOf(req);
  const id = parse(zId, req.params.id);
  const body = parse(timeOffSchema, req.body);
  await ownStaff(salon.id, id);
  const clash = await prisma.appointment.count({
    where: {
      staffId: id,
      status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
      startsAt: { lt: new Date(body.endsAt) },
      endsAt: { gt: new Date(body.startsAt) },
    },
  });
  if (clash) {
    throw conflict(
      "TIME_OFF_CLASH",
      `Bu aralıkta personelin ${clash} randevusu var. Önce randevuları taşıyın veya iptal edin.`,
    );
  }
  const t = await prisma.staffTimeOff.create({
    data: { staffId: id, startsAt: new Date(body.startsAt), endsAt: new Date(body.endsAt), reason: body.reason },
  });
  res.status(201).json({
    timeOff: { id: t.id, startsAt: t.startsAt.toISOString(), endsAt: t.endsAt.toISOString(), reason: t.reason },
  });
});

salonPanelRouter.delete("/staff/:id/time-off/:timeOffId", async (req, res) => {
  const salon = salonOf(req);
  const id = parse(zId, req.params.id);
  await ownStaff(salon.id, id);
  const deleted = await prisma.staffTimeOff.deleteMany({
    where: { id: parse(zId, req.params.timeOffId), staffId: id },
  });
  if (!deleted.count) throw notFound("İzin kaydı bulunamadı");
  res.status(204).end();
});

// ───────────── Hizmetler ─────────────

const zDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih YYYY-AA-GG biçiminde olmalı");

const serviceSchema = z.object({
  name: z.string().trim().min(2, "Hizmet adı gerekli").max(80),
  description: z.string().trim().max(300).optional().nullable(),
  durationMinutes: z.number().int().min(5, "En az 5 dakika").max(600, "En fazla 10 saat"),
  price: z.number().min(0).max(100_000).multipleOf(0.01),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
  // İndirim: üçü birlikte verilir; null → indirimi kaldır
  discountPercent: z
    .number()
    .int()
    .min(5, "İndirim en az %5 olmalı")
    .max(90, "İndirim en fazla %90 olabilir")
    .nullable()
    .optional(),
  discountStartsOn: zDay.nullable().optional(),
  discountEndsOn: zDay.nullable().optional(),
});

const PRICE_RAISE_COOLDOWN_DAYS = 30;
const MAX_DISCOUNT_DAYS = 90;

type ServiceRow = {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  priceCents: number;
  isActive: boolean;
  sortOrder: number;
  discountPercent: number | null;
  discountStartsOn: Date | null;
  discountEndsOn: Date | null;
  priceRaisedAt: Date | null;
};

const serializeSvc = (s: ServiceRow, today: string) => {
  const startsOn = isoDay(s.discountStartsOn);
  const endsOn = isoDay(s.discountEndsOn);
  const hasDiscount = !!(s.discountPercent && startsOn && endsOn);
  return {
    id: s.id,
    name: s.name,
    description: s.description,
    durationMinutes: s.durationMinutes,
    price: toTL(s.priceCents),
    isActive: s.isActive,
    sortOrder: s.sortOrder,
    discount: hasDiscount
      ? {
          percent: s.discountPercent!,
          price: toTL(discountedCents(s.priceCents, s.discountPercent!)),
          startsOn: startsOn!,
          endsOn: endsOn!,
          status: endsOn! < today ? "ENDED" : startsOn! > today ? "SCHEDULED" : "ACTIVE",
        }
      : null,
    // Fiyat artışından sonra indirim başlatılabilecek ilk gün
    discountAllowedFrom:
      s.priceRaisedAt && DateTime.fromJSDate(s.priceRaisedAt).plus({ days: PRICE_RAISE_COOLDOWN_DAYS }) > DateTime.now()
        ? DateTime.fromJSDate(s.priceRaisedAt).plus({ days: PRICE_RAISE_COOLDOWN_DAYS }).toISODate()
        : null,
  };
};

/**
 * İndirim ve fiyat kuralları (Ticari Reklam ve Haksız Ticari Uygulamalar Yönetmeliği'ne uygun, dürüst indirim):
 *  - Son 30 günde fiyatı artırılan hizmette indirim başlatılamaz (önce fiyat şişirilip indirim gösterilemez).
 *  - Süren veya planlanmış indirim varken fiyat artırılamaz.
 *  - İndirim en fazla 90 gün sürer ve geçmişte bitemez.
 */
function applyServiceRules(
  current: ServiceRow | null,
  body: z.infer<typeof serviceSchema> | Partial<z.infer<typeof serviceSchema>>,
  today: string,
) {
  const data: Record<string, unknown> = {};
  const nextPriceCents = body.price !== undefined ? fromTL(body.price) : (current?.priceCents ?? 0);
  const raised = !!current && nextPriceCents > current.priceCents;

  const touchesDiscount =
    body.discountPercent !== undefined || body.discountStartsOn !== undefined || body.discountEndsOn !== undefined;
  let percent = current?.discountPercent ?? null;
  let startsOn = isoDay(current?.discountStartsOn ?? null);
  let endsOn = isoDay(current?.discountEndsOn ?? null);
  if (touchesDiscount) {
    if (body.discountPercent === null) {
      percent = startsOn = endsOn = null;
    } else {
      percent = body.discountPercent ?? percent;
      startsOn = body.discountStartsOn ?? startsOn;
      endsOn = body.discountEndsOn ?? endsOn;
      if (!percent || !startsOn || !endsOn) {
        throw new AppError(400, "DISCOUNT_INCOMPLETE", "İndirim için oran, başlangıç ve bitiş tarihi gerekli");
      }
      if (endsOn < startsOn) throw new AppError(400, "DISCOUNT_DATES", "Bitiş tarihi başlangıçtan önce olamaz");
      if (endsOn < today) throw new AppError(400, "DISCOUNT_DATES", "Bitiş tarihi geçmişte olamaz");
      const days = DateTime.fromISO(endsOn).diff(DateTime.fromISO(startsOn), "days").days;
      if (days > MAX_DISCOUNT_DAYS) {
        throw new AppError(400, "DISCOUNT_TOO_LONG", `Bir indirim en fazla ${MAX_DISCOUNT_DAYS} gün sürebilir`);
      }
      const raisedAt = raised ? new Date() : current?.priceRaisedAt;
      if (raisedAt && DateTime.fromJSDate(raisedAt).plus({ days: PRICE_RAISE_COOLDOWN_DAYS }) > DateTime.now()) {
        throw conflict(
          "PRICE_RECENTLY_RAISED",
          `Son ${PRICE_RAISE_COOLDOWN_DAYS} gün içinde fiyatı artırılan hizmette indirim yapılamaz. İndirim, gerçek bir önceki fiyat üzerinden gösterilmelidir.`,
        );
      }
    }
    data.discountPercent = percent;
    data.discountStartsOn = startsOn ? new Date(`${startsOn}T00:00:00Z`) : null;
    data.discountEndsOn = endsOn ? new Date(`${endsOn}T00:00:00Z`) : null;
  }
  if (raised) {
    if (percent && endsOn && endsOn >= today) {
      throw conflict("DISCOUNT_ACTIVE", "İndirim sürerken fiyat artırılamaz. Önce indirimi kaldırın.");
    }
    data.priceRaisedAt = new Date();
  }
  return data;
}

salonPanelRouter.get("/services", async (req, res) => {
  const salon = salonOf(req);
  const rows = await prisma.service.findMany({
    where: { salonId: salon.id },
    orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
  });
  const today = todayIn(salon.timezone);
  res.json({ items: rows.map((r) => serializeSvc(r, today)) });
});

salonPanelRouter.post("/services", async (req, res) => {
  const salon = salonOf(req);
  const body = parse(serviceSchema, req.body);
  const today = todayIn(salon.timezone);
  const rules = applyServiceRules(null, body, today);
  const { price, discountPercent: _p, discountStartsOn: _s, discountEndsOn: _e, ...rest } = body;
  const svc = await prisma.service.create({
    data: { ...rest, ...rules, priceCents: fromTL(price), salonId: salon.id },
  });
  salonChanged(salon);
  res.status(201).json({ service: serializeSvc(svc, today) });
});

salonPanelRouter.patch("/services/:id", async (req, res) => {
  const salon = salonOf(req);
  const id = parse(zId, req.params.id);
  const body = parse(serviceSchema.partial(), req.body);
  const current = await prisma.service.findFirst({ where: { id, salonId: salon.id } });
  if (!current) throw notFound("Hizmet bulunamadı");
  const today = todayIn(salon.timezone);
  const rules = applyServiceRules(current, body, today);
  const { price, discountPercent: _p, discountStartsOn: _s, discountEndsOn: _e, ...rest } = body;
  // Fiyat değişikliği mevcut randevuları etkilemez (randevuda fiyat sabitlenir).
  const svc = await prisma.service.update({
    where: { id },
    data: { ...rest, ...rules, ...(price !== undefined ? { priceCents: fromTL(price) } : {}) },
  });
  salonChanged(salon);
  res.json({ service: serializeSvc(svc, today) });
});

salonPanelRouter.delete("/services/:id", async (req, res) => {
  const salon = salonOf(req);
  const id = parse(zId, req.params.id);
  if (!(await prisma.service.findFirst({ where: { id, salonId: salon.id } }))) throw notFound("Hizmet bulunamadı");
  const used = await prisma.appointmentService.count({ where: { serviceId: id } });
  if (used) await prisma.service.update({ where: { id }, data: { isActive: false } });
  else await prisma.service.delete({ where: { id } });
  salonChanged(salon);
  res.json({ deleted: !used, deactivated: !!used });
});

// ───────────── Çalışma saatleri ─────────────

salonPanelRouter.get("/hours", async (req, res) => {
  const salon = salonOf(req);
  const rows = await prisma.workingHours.findMany({ where: { salonId: salon.id }, orderBy: { weekday: "asc" } });
  res.json({
    items: Array.from({ length: 7 }, (_, i) => {
      const h = rows.find((r) => r.weekday === i + 1);
      return {
        weekday: i + 1,
        isClosed: h ? h.isClosed : true,
        opens: h ? hhmm(h.openMinute) : "09:00",
        closes: h ? hhmm(h.closeMinute) : "19:00",
      };
    }),
  });
});

const hoursSchema = z.object({
  items: z
    .array(
      z
        .object({ weekday: z.number().int().min(1).max(7), isClosed: z.boolean(), opens: zTime, closes: zTime })
        .refine((h) => h.isClosed || toMinute(h.closes) > toMinute(h.opens), {
          message: "Kapanış saati açılıştan sonra olmalı",
        }),
    )
    .length(7, "7 günün tamamı gönderilmeli"),
});

salonPanelRouter.put("/hours", async (req, res) => {
  const salon = salonOf(req);
  const { items } = parse(hoursSchema, req.body);
  await prisma.$transaction(
    items.map((h) =>
      prisma.workingHours.upsert({
        where: { salonId_weekday: { salonId: salon.id, weekday: h.weekday } },
        create: {
          salonId: salon.id,
          weekday: h.weekday,
          isClosed: h.isClosed,
          openMinute: toMinute(h.opens),
          closeMinute: toMinute(h.closes),
        },
        update: { isClosed: h.isClosed, openMinute: toMinute(h.opens), closeMinute: toMinute(h.closes) },
      }),
    ),
  );
  salonChanged(salon);
  res.json({ items });
});

// ───────────── Salon profili ve randevu kuralları ─────────────

salonPanelRouter.get("/profile", (req, res) => {
  res.json({ salon: serializeSalonProfile(salonOf(req)) });
});

const profileSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    description: z.string().trim().max(1000).nullable(),
    address: z.string().trim().min(10, "Açık adres en az 10 karakter olmalı").max(300),
    city: z.string().trim().min(2).max(60),
    district: z.string().trim().min(2).max(60).nullable(),
    phone: z.string().trim().max(20).nullable(),
    website: z.string().url("Geçerli bir web adresi girin (https://...)").max(200).nullable(),
    latitude: z.number().min(35).max(43),
    longitude: z.number().min(25).max(45),
    coverImageUrl: z.string().url().max(500).nullable(),
    photos: z.array(z.string().url().max(500)).max(12, "En fazla 12 fotoğraf"),
    kind: z.enum(["WOMEN", "MEN", "UNISEX", "BEAUTY"]),
    whatsapp: zPhone.nullable(),
    isActive: z.boolean(),
    slotIntervalMinutes: z.union([z.literal(10), z.literal(15), z.literal(20), z.literal(30), z.literal(60)]),
    bookingLeadMinutes: z
      .number()
      .int()
      .min(0)
      .max(24 * 60),
    bookingHorizonDays: z.number().int().min(1).max(180),
    cancellationWindowHours: z.number().int().min(0).max(72),
    autoConfirm: z.boolean(),
  })
  .partial()
  .strict();

salonPanelRouter.patch("/profile", async (req, res) => {
  const salon = salonOf(req);
  const body = parse(profileSchema, req.body);
  const updated = await prisma.$transaction(async (tx) => {
    // Galerinin ilk fotoğrafı kapak görseli olarak da tutulur (eski istemciler için)
    const data = body.photos ? { ...body, coverImageUrl: body.photos[0] ?? null } : body;
    const s = await tx.salon.update({ where: { id: salon.id }, data });
    if (body.name) await tx.business.update({ where: { id: salon.businessId! }, data: { displayName: body.name } });
    return s;
  });
  salonChanged(updated);
  res.json({ salon: serializeSalonProfile(updated) });
});

// ───────────── Gelir / gider ─────────────

const ledgerSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE"]),
  category: z.string().trim().min(2, "Kategori gerekli").max(40),
  amount: z.number().positive("Tutar sıfırdan büyük olmalı").max(10_000_000).multipleOf(0.01),
  date: zDate,
  description: z.string().trim().max(300).optional().nullable(),
});

const serializeLedger = (e: {
  id: string;
  type: string;
  category: string;
  amountCents: number;
  date: Date;
  description: string | null;
}) => ({
  id: e.id,
  type: e.type,
  category: e.category,
  amount: toTL(e.amountCents),
  date: e.date.toISOString().slice(0, 10),
  description: e.description,
});

salonPanelRouter.get("/finance", async (req, res) => {
  const salon = salonOf(req);
  const { month } = parse(z.object({ month: zMonth }), req.query);
  const start = DateTime.fromISO(`${month}-01`, { zone: salon.timezone });
  const end = start.plus({ months: 1 });
  const [appts, entries] = await Promise.all([
    prisma.appointment.findMany({
      where: { salonId: salon.id, status: "COMPLETED", startsAt: { gte: start.toJSDate(), lt: end.toJSDate() } },
      select: { startsAt: true, totalCents: true, staff: { select: { name: true } } },
    }),
    prisma.ledgerEntry.findMany({
      where: {
        businessId: salon.businessId!,
        date: { gte: new Date(`${month}-01`), lt: new Date(end.toFormat("yyyy-MM-dd")) },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  const days = start.daysInMonth!;
  const daily = Array.from({ length: days }, (_, i) => ({
    date: start.plus({ days: i }).toFormat("yyyy-MM-dd"),
    income: 0,
    expense: 0,
  }));
  for (const a of appts) {
    const d = DateTime.fromJSDate(a.startsAt).setZone(salon.timezone).day - 1;
    daily[d]!.income += a.totalCents;
  }
  for (const e of entries) {
    const d = Number(e.date.toISOString().slice(8, 10)) - 1;
    if (e.type === "INCOME") daily[d]!.income += e.amountCents;
    else daily[d]!.expense += e.amountCents;
  }

  const appointmentIncome = appts.reduce((n, a) => n + a.totalCents, 0);
  const otherIncome = entries.filter((e) => e.type === "INCOME").reduce((n, e) => n + e.amountCents, 0);
  const expenses = entries.filter((e) => e.type === "EXPENSE").reduce((n, e) => n + e.amountCents, 0);
  const byCategory = new Map<string, number>();
  for (const e of entries.filter((x) => x.type === "EXPENSE")) {
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amountCents);
  }
  const byStaff = new Map<string, number>();
  for (const a of appts) byStaff.set(a.staff.name, (byStaff.get(a.staff.name) ?? 0) + a.totalCents);

  res.json({
    month,
    totals: {
      appointmentIncome: toTL(appointmentIncome),
      otherIncome: toTL(otherIncome),
      income: toTL(appointmentIncome + otherIncome),
      expense: toTL(expenses),
      net: toTL(appointmentIncome + otherIncome - expenses),
      completedAppointments: appts.length,
    },
    daily: daily.map((d) => ({ date: d.date, income: toTL(d.income), expense: toTL(d.expense) })),
    expenseByCategory: [...byCategory.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([category, cents]) => ({ category, amount: toTL(cents) })),
    incomeByStaff: [...byStaff.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, cents]) => ({ name, amount: toTL(cents) })),
    entries: entries.map(serializeLedger),
  });
});

salonPanelRouter.post("/ledger", async (req, res) => {
  const salon = salonOf(req);
  const { amount, date, ...rest } = parse(ledgerSchema, req.body);
  const e = await prisma.ledgerEntry.create({
    data: { ...rest, amountCents: fromTL(amount), date: new Date(date), businessId: salon.businessId! },
  });
  res.status(201).json({ entry: serializeLedger(e) });
});

salonPanelRouter.patch("/ledger/:id", async (req, res) => {
  const salon = salonOf(req);
  const id = parse(zId, req.params.id);
  const { amount, date, ...rest } = parse(ledgerSchema.partial(), req.body);
  if (!(await prisma.ledgerEntry.findFirst({ where: { id, businessId: salon.businessId! } })))
    throw notFound("Kayıt bulunamadı");
  const e = await prisma.ledgerEntry.update({
    where: { id },
    data: {
      ...rest,
      ...(amount !== undefined ? { amountCents: fromTL(amount) } : {}),
      ...(date ? { date: new Date(date) } : {}),
    },
  });
  res.json({ entry: serializeLedger(e) });
});

salonPanelRouter.delete("/ledger/:id", async (req, res) => {
  const salon = salonOf(req);
  const deleted = await prisma.ledgerEntry.deleteMany({
    where: { id: parse(zId, req.params.id), businessId: salon.businessId! },
  });
  if (!deleted.count) throw notFound("Kayıt bulunamadı");
  res.status(204).end();
});

// ───────────── Yorumlar ─────────────

salonPanelRouter.get("/reviews", async (req, res) => {
  const salon = salonOf(req);
  const { page, pageSize } = parse(zPagination, req.query);
  const [rows, total, dist] = await Promise.all([
    prisma.salonReview.findMany({
      where: { salonId: salon.id },
      include: {
        user: { select: { name: true, deletedAt: true } },
        appointment: { select: { startsAt: true, staff: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
      ...paginate(page, pageSize),
    }),
    prisma.salonReview.count({ where: { salonId: salon.id } }),
    prisma.salonReview.groupBy({ by: ["rating"], where: { salonId: salon.id }, _count: true }),
  ]);
  res.json({
    ...pageResult(
      rows.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        authorName: !r.user || r.user.deletedAt ? "Anonim" : shortName(r.user.name),
        staffName: r.appointment.staff.name,
        appointmentDate: r.appointment.startsAt.toISOString(),
        createdAt: r.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    ),
    summary: {
      average: Math.round(salon.ratingAvg * 10) / 10,
      count: salon.ratingCount,
      distribution: [5, 4, 3, 2, 1].map((r) => ({ rating: r, count: dist.find((d) => d.rating === r)?._count ?? 0 })),
    },
  });
});
