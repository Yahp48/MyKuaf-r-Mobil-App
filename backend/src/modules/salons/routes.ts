import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.ts";
import { pageResult, paginate, parse, zId, zPagination } from "../../lib/validate.ts";
import { AppError, notFound } from "../../lib/errors.ts";
import { optionalAuth, requireAuth, userId } from "../../middleware/auth.ts";
import { shortName } from "../../lib/names.ts";
import { computeAvailability, resolveServices } from "./availability.ts";
import {
  distanceKm,
  serializeSalonSummary,
  serializeService,
  serializeStaff,
  serializeWorkingHours,
} from "./serialize.ts";

export const salonsRouter = Router();

const listSchema = zPagination.extend({
  q: z.string().trim().max(80).optional(),
  city: z.string().trim().max(60).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().positive().max(500).optional(),
});

salonsRouter.get("/", optionalAuth, async (req, res) => {
  const query = parse(listSchema, req.query);
  const where = {
    isActive: true,
    ...(query.city ? { city: { equals: query.city, mode: "insensitive" as const } } : {}),
    ...(query.q ? { name: { contains: query.q, mode: "insensitive" as const } } : {}),
  };

  const favoriteIds = req.user
    ? new Set(
        (await prisma.favoriteSalon.findMany({ where: { userId: req.user.id }, select: { salonId: true } })).map(
          (f) => f.salonId,
        ),
      )
    : undefined;

  const hasLocation = query.lat !== undefined && query.lng !== undefined;
  if (hasLocation) {
    // Konuma göre sıralama. Salon sayısı on binleri bulursa PostGIS'e geçilmeli.
    const all = await prisma.salon.findMany({ where, include: { workingHours: true } });
    const withDistance = all
      .map((s) => ({ s, d: distanceKm(query.lat!, query.lng!, s.latitude, s.longitude) }))
      .filter((x) => query.radiusKm === undefined || x.d <= query.radiusKm)
      .sort((a, b) => a.d - b.d);
    const { skip, take } = paginate(query.page, query.pageSize);
    const items = withDistance
      .slice(skip, skip + take)
      .map(({ s, d }) => serializeSalonSummary(s, { distanceKm: d, isFavorite: favoriteIds?.has(s.id) }));
    res.json(pageResult(items, withDistance.length, query.page, query.pageSize));
    return;
  }

  const [rows, total] = await Promise.all([
    prisma.salon.findMany({
      where,
      include: { workingHours: true },
      orderBy: [{ ratingAvg: "desc" }, { name: "asc" }],
      ...paginate(query.page, query.pageSize),
    }),
    prisma.salon.count({ where }),
  ]);
  const items = rows.map((s) => serializeSalonSummary(s, { isFavorite: favoriteIds?.has(s.id) }));
  res.json(pageResult(items, total, query.page, query.pageSize));
});

async function activeSalon(id: string) {
  const salon = await prisma.salon.findFirst({ where: { id, isActive: true } });
  if (!salon) throw notFound("Salon bulunamadı");
  return salon;
}

salonsRouter.get("/:id", optionalAuth, async (req, res) => {
  const id = parse(zId, req.params.id);
  const salon = await prisma.salon.findFirst({
    where: { id, isActive: true },
    include: {
      workingHours: true,
      staff: { where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] },
      services: { where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] },
    },
  });
  if (!salon) throw notFound("Salon bulunamadı");

  const isFavorite = req.user
    ? !!(await prisma.favoriteSalon.findUnique({ where: { userId_salonId: { userId: req.user.id, salonId: id } } }))
    : undefined;

  res.json({
    salon: {
      ...serializeSalonSummary(salon, { isFavorite }),
      description: salon.description,
      workingHours: serializeWorkingHours(salon.workingHours),
      staff: salon.staff.map(serializeStaff),
      services: salon.services.map(serializeService),
      booking: {
        slotIntervalMinutes: salon.slotIntervalMinutes,
        bookingHorizonDays: salon.bookingHorizonDays,
        cancellationWindowHours: salon.cancellationWindowHours,
      },
    },
  });
});

const availabilitySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih YYYY-AA-GG biçiminde olmalı"),
  serviceIds: z
    .union([z.string(), z.array(z.string())])
    .transform((v) => (Array.isArray(v) ? v : v.split(",")).map((s) => s.trim()).filter(Boolean))
    .pipe(z.array(zId).min(1, "En az bir hizmet seçin").max(10)),
  staffId: zId.optional(),
});

salonsRouter.get("/:id/availability", async (req, res) => {
  const salon = await activeSalon(parse(zId, req.params.id));
  const query = parse(availabilitySchema, req.query);
  const { durationMinutes } = await resolveServices(salon.id, query.serviceIds);
  const staff = await computeAvailability({ salon, date: query.date, durationMinutes, staffId: query.staffId });
  res.json({ date: query.date, durationMinutes, staff });
});

salonsRouter.get("/:id/reviews", async (req, res) => {
  const salon = await activeSalon(parse(zId, req.params.id));
  const { page, pageSize } = parse(zPagination, req.query);
  const [rows, total] = await Promise.all([
    prisma.salonReview.findMany({
      where: { salonId: salon.id },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true, deletedAt: true } } },
      ...paginate(page, pageSize),
    }),
    prisma.salonReview.count({ where: { salonId: salon.id } }),
  ]);
  const items = rows.map((r) => ({
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    // Gizlilik: yalnızca ad ve soyadın baş harfi gösterilir.
    authorName: !r.user || r.user.deletedAt ? "Anonim" : shortName(r.user.name),
    createdAt: r.createdAt.toISOString(),
  }));
  res.json(pageResult(items, total, page, pageSize));
});

const reviewSchema = z.object({
  appointmentId: zId,
  rating: z.number().int().min(1, "Puan 1-5 arası olmalı").max(5, "Puan 1-5 arası olmalı"),
  comment: z.string().trim().max(1000).optional(),
});

salonsRouter.post("/:id/reviews", requireAuth, async (req, res) => {
  const salonId = parse(zId, req.params.id);
  const body = parse(reviewSchema, req.body);
  const uid = userId(req);

  const appointment = await prisma.appointment.findFirst({
    where: { id: body.appointmentId, userId: uid, salonId },
    include: { review: true },
  });
  if (!appointment) throw notFound("Randevu bulunamadı");
  if (appointment.status !== "COMPLETED") {
    throw new AppError(400, "APPOINTMENT_NOT_COMPLETED", "Yalnızca tamamlanmış randevular değerlendirilebilir");
  }
  if (appointment.review) throw new AppError(409, "ALREADY_REVIEWED", "Bu randevuyu zaten değerlendirdiniz");

  const review = await prisma.$transaction(async (tx) => {
    const created = await tx.salonReview.create({
      data: { salonId, userId: uid, appointmentId: appointment.id, rating: body.rating, comment: body.comment },
    });
    const agg = await tx.salonReview.aggregate({ where: { salonId }, _avg: { rating: true }, _count: true });
    await tx.salon.update({
      where: { id: salonId },
      data: { ratingAvg: agg._avg.rating ?? 0, ratingCount: agg._count },
    });
    return created;
  });
  res.status(201).json({ review: { id: review.id, rating: review.rating, comment: review.comment } });
});
