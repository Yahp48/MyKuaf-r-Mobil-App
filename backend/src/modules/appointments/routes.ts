import { Router } from "express";
import { z } from "zod";
import { DateTime } from "luxon";
import { prisma, pgErrorCode } from "../../lib/prisma.ts";
import { pageResult, paginate, parse, zId, zPagination, zPhone } from "../../lib/validate.ts";
import { AppError, conflict, notFound, unauthorized } from "../../lib/errors.ts";
import { humanCode } from "../../lib/codes.ts";
import { toTL } from "../../lib/money.ts";
import { requireAuth, userId } from "../../middleware/auth.ts";
import { ACTIVE_APPOINTMENT_STATUSES, computeAvailability, resolveServices, salonDay } from "../salons/availability.ts";
import { notify } from "../notifications/notify.ts";
import { emitToUser } from "../../realtime/socket.ts";
import type { Prisma } from "../../generated/prisma/client.ts";

export const appointmentsRouter = Router();
appointmentsRouter.use(requireAuth);

const include = {
  salon: {
    select: { id: true, name: true, address: true, phone: true, timezone: true, cancellationWindowHours: true },
  },
  staff: { select: { id: true, name: true, title: true, avatarUrl: true } },
  services: true,
  review: { select: { id: true } },
} satisfies Prisma.AppointmentInclude;

type AppointmentRow = Prisma.AppointmentGetPayload<{ include: typeof include }>;

function canCancel(a: AppointmentRow, now = new Date()) {
  if (!ACTIVE_APPOINTMENT_STATUSES.includes(a.status as (typeof ACTIVE_APPOINTMENT_STATUSES)[number])) return false;
  return a.startsAt.getTime() - now.getTime() >= a.salon.cancellationWindowHours * 3_600_000;
}

function serialize(a: AppointmentRow) {
  const local = DateTime.fromJSDate(a.startsAt).setZone(a.salon.timezone);
  return {
    id: a.id,
    code: a.code,
    status: a.status,
    startsAt: a.startsAt.toISOString(),
    endsAt: a.endsAt.toISOString(),
    date: local.toFormat("yyyy-MM-dd"),
    time: local.toFormat("HH:mm"),
    total: toTL(a.totalCents),
    customerPhone: a.customerPhone,
    customerNote: a.customerNote,
    salon: { id: a.salon.id, name: a.salon.name, address: a.salon.address, phone: a.salon.phone },
    staff: a.staff,
    services: a.services.map((s) => ({
      id: s.serviceId,
      name: s.nameSnapshot,
      price: toTL(s.priceCents),
      durationMinutes: s.durationMinutes,
    })),
    canCancel: canCancel(a),
    canReview: a.status === "COMPLETED" && !a.review,
    cancelledAt: a.cancelledAt?.toISOString() ?? null,
    cancelReason: a.cancelReason,
    createdAt: a.createdAt.toISOString(),
  };
}

const createSchema = z.object({
  salonId: zId,
  // Boş bırakılırsa o saatte müsait ilk personel atanır.
  staffId: zId.optional(),
  serviceIds: z.array(zId).min(1, "En az bir hizmet seçin").max(10),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih YYYY-AA-GG biçiminde olmalı"),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Saat SS:DD biçiminde olmalı"),
  phone: zPhone.optional(),
  note: z.string().trim().max(500).optional(),
});

appointmentsRouter.post("/", async (req, res) => {
  const body = parse(createSchema, req.body);
  const uid = userId(req);

  const [user, salon] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: uid } }),
    prisma.salon.findFirst({ where: { id: body.salonId, isActive: true } }),
  ]);
  if (user.deletedAt) throw unauthorized();
  if (!salon) throw notFound("Salon bulunamadı");

  const phone = body.phone ?? user.phone;
  if (!phone) throw new AppError(400, "PHONE_REQUIRED", "Randevu için telefon numarası gerekli");

  const { services, durationMinutes, totalCents } = await resolveServices(salon.id, body.serviceIds);
  const availability = await computeAvailability({ salon, date: body.date, durationMinutes, staffId: body.staffId });
  const staffId = availability.find((s) => s.slots.includes(body.time))?.staffId;
  if (!staffId) throw conflict("SLOT_UNAVAILABLE", "Seçtiğiniz saat artık müsait değil, lütfen başka bir saat seçin");

  const [h, m] = body.time.split(":").map(Number) as [number, number];
  const startsAt = salonDay(body.date, salon.timezone).set({ hour: h, minute: m });
  const endsAt = startsAt.plus({ minutes: durationMinutes });

  let appointment: AppointmentRow;
  try {
    appointment = await prisma.appointment.create({
      data: {
        code: humanCode("RV"),
        userId: uid,
        salonId: salon.id,
        staffId,
        startsAt: startsAt.toJSDate(),
        endsAt: endsAt.toJSDate(),
        status: salon.autoConfirm ? "CONFIRMED" : "PENDING",
        totalCents,
        customerName: user.name,
        customerPhone: phone,
        customerNote: body.note,
        services: {
          create: services.map((s) => ({
            serviceId: s.id,
            nameSnapshot: s.name,
            priceCents: s.priceCents,
            durationMinutes: s.durationMinutes,
          })),
        },
      },
      include,
    });
  } catch (err) {
    // Aynı anda gelen iki istek: veritabanındaki çakışma kısıtı ikinciyi reddeder.
    if (pgErrorCode(err) === "23P01") {
      throw conflict("SLOT_UNAVAILABLE", "Seçtiğiniz saat az önce doldu, lütfen başka bir saat seçin");
    }
    throw err;
  }

  const out = serialize(appointment);
  await notify(uid, {
    type: "appointment_confirmed",
    title: appointment.status === "CONFIRMED" ? "Randevunuz onaylandı" : "Randevu talebiniz alındı",
    body: `${salon.name} · ${out.date} ${out.time} · ${appointment.staff.name}`,
    data: { appointmentId: appointment.id },
  });
  res.status(201).json({ appointment: out });
});

const listSchema = zPagination.extend({ scope: z.enum(["upcoming", "past", "all"]).default("all") });

appointmentsRouter.get("/", async (req, res) => {
  const { scope, page, pageSize } = parse(listSchema, req.query);
  const now = new Date();
  const where: Prisma.AppointmentWhereInput = {
    userId: userId(req),
    ...(scope === "upcoming"
      ? { endsAt: { gt: now }, status: { in: [...ACTIVE_APPOINTMENT_STATUSES] } }
      : scope === "past"
        ? { OR: [{ endsAt: { lte: now } }, { status: { notIn: [...ACTIVE_APPOINTMENT_STATUSES] } }] }
        : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.appointment.findMany({
      where,
      include,
      orderBy: { startsAt: scope === "upcoming" ? "asc" : "desc" },
      ...paginate(page, pageSize),
    }),
    prisma.appointment.count({ where }),
  ]);
  res.json(pageResult(rows.map(serialize), total, page, pageSize));
});

appointmentsRouter.get("/:id", async (req, res) => {
  const a = await prisma.appointment.findFirst({
    where: { id: parse(zId, req.params.id), userId: userId(req) },
    include,
  });
  if (!a) throw notFound("Randevu bulunamadı");
  res.json({ appointment: serialize(a) });
});

const cancelSchema = z.object({ reason: z.string().trim().max(300).optional() });

appointmentsRouter.post("/:id/cancel", async (req, res) => {
  const id = parse(zId, req.params.id);
  const { reason } = parse(cancelSchema, req.body ?? {});
  const uid = userId(req);

  const a = await prisma.appointment.findFirst({ where: { id, userId: uid }, include });
  if (!a) throw notFound("Randevu bulunamadı");
  if (!canCancel(a)) {
    throw new AppError(
      400,
      "CANNOT_CANCEL",
      `Randevuya ${a.salon.cancellationWindowHours} saatten az kaldığı için uygulamadan iptal edilemez. Lütfen salonu arayın.`,
    );
  }

  const updated = await prisma.appointment.update({
    where: { id },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason ?? "Müşteri iptal etti" },
    include,
  });
  const out = serialize(updated);
  emitToUser(uid, "appointment:updated", out);
  await notify(uid, {
    type: "appointment_cancelled",
    title: "Randevunuz iptal edildi",
    body: `${a.salon.name} · ${out.date} ${out.time}`,
    data: { appointmentId: id },
  });
  res.json({ appointment: out });
});
