import { Router } from "express";
import { bookableSalonWhere, visibleSalonWhere } from "../../lib/visibility.ts";
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
  serializePackage,
} from "./serialize.ts";
import { SUMMARY_SERVICE_SELECT, publicDiscount, todayIn } from "./discount.ts";
import { toTL } from "../../lib/money.ts";
import { DateTime } from "luxon";

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
    ...visibleSalonWhere,
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
    const all = await prisma.salon.findMany({
      where,
      include: { workingHours: true, services: { where: { isActive: true }, select: SUMMARY_SERVICE_SELECT } },
    });
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
      include: { workingHours: true, services: { where: { isActive: true }, select: SUMMARY_SERVICE_SELECT } },
      orderBy: [{ ratingAvg: "desc" }, { name: "asc" }],
      ...paginate(query.page, query.pageSize),
    }),
    prisma.salon.count({ where }),
  ]);
  const items = rows.map((s) => serializeSalonSummary(s, { isFavorite: favoriteIds?.has(s.id) }));
  res.json(pageResult(items, total, query.page, query.pageSize));
});

// ───────────── Vitrin: şehre göre haftanın / ayın / yılın kuaförleri ve indirimler ─────────────

/** Salonu olan şehirler (vitrin şehir seçimi için). */
salonsRouter.get("/cities", async (_req, res) => {
  const rows = await prisma.salon.groupBy({ by: ["city"], where: visibleSalonWhere, _count: true });
  res.json({
    items: rows
      .map((r) => ({ city: r.city, salonCount: r._count }))
      .sort((a, b) => b.salonCount - a.salonCount || a.city.localeCompare(b.city, "tr")),
  });
});

const PERIODS = { week: "week", month: "month", year: "year" } as const;
/** Sıralamaya girmek için dönem içinde gereken en az tamamlanmış randevu (tek randevuyla "ayın kuaförü" olunmaz). */
export const FEATURED_MIN_COMPLETED = 3;

const featuredSchema = z.object({
  city: z.string().trim().min(1).max(60),
  period: z.enum(["week", "month", "year"]).default("month"),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});

/**
 * Sıralama tamamen gerçek veriye dayanır: dönem içindeki tamamlanmış randevu sayısı ve dönem içindeki
 * değerlendirmelerin Bayes ortalaması (az yorumlu salonun tek 5 yıldızla öne geçmesini önler).
 * Puan = tamamlanan × (bayesOrtalama / 5). Ücretli öne çıkarma yoktur.
 */
salonsRouter.get("/featured", optionalAuth, async (req, res) => {
  const q = parse(featuredSchema, req.query);
  const tz = "Europe/Istanbul";
  const start = DateTime.now().setZone(tz).startOf(PERIODS[q.period]);
  const where = { ...visibleSalonWhere, city: { equals: q.city, mode: "insensitive" as const } };
  const salons = await prisma.salon.findMany({
    where,
    include: { workingHours: true, services: { where: { isActive: true }, select: SUMMARY_SERVICE_SELECT } },
  });
  const ids = salons.map((s) => s.id);
  const [completed, reviews] = ids.length
    ? await Promise.all([
        prisma.appointment.groupBy({
          by: ["salonId"],
          where: { salonId: { in: ids }, status: "COMPLETED", startsAt: { gte: start.toJSDate(), lte: new Date() } },
          _count: true,
        }),
        prisma.salonReview.groupBy({
          by: ["salonId"],
          where: { salonId: { in: ids }, createdAt: { gte: start.toJSDate() } },
          _count: true,
          _avg: { rating: true },
        }),
      ])
    : [[], []];

  const PRIOR_MEAN = 4;
  const PRIOR_WEIGHT = 3;
  const ranked = salons
    .map((s) => {
      const done = completed.find((c) => c.salonId === s.id)?._count ?? 0;
      const r = reviews.find((x) => x.salonId === s.id);
      const n = r?._count ?? 0;
      const avg = r?._avg.rating ?? 0;
      const bayes = (PRIOR_MEAN * PRIOR_WEIGHT + avg * n) / (PRIOR_WEIGHT + n);
      return { s, done, n, avg, score: done * (bayes / 5) };
    })
    .filter((x) => x.done >= FEATURED_MIN_COMPLETED)
    .sort((a, b) => b.score - a.score || b.s.ratingAvg - a.s.ratingAvg)
    .slice(0, 10);

  const favoriteIds = req.user
    ? new Set(
        (await prisma.favoriteSalon.findMany({ where: { userId: req.user.id }, select: { salonId: true } })).map(
          (f) => f.salonId,
        ),
      )
    : undefined;

  res.json({
    city: q.city,
    period: q.period,
    since: start.toISODate(),
    minCompleted: FEATURED_MIN_COMPLETED,
    items: ranked.map((x, i) => ({
      rank: i + 1,
      stats: {
        completedAppointments: x.done,
        periodReviewCount: x.n,
        periodRating: x.n ? Math.round(x.avg * 10) / 10 : null,
      },
      salon: serializeSalonSummary(x.s, {
        isFavorite: favoriteIds?.has(x.s.id),
        ...(q.lat !== undefined && q.lng !== undefined
          ? { distanceKm: distanceKm(q.lat, q.lng, x.s.latitude, x.s.longitude) }
          : {}),
      }),
    })),
  });
});

const dealsSchema = z.object({
  city: z.string().trim().min(1).max(60).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});

/** Süren veya yaklaşan indirimi olan salonlar ve indirimli hizmetleri. */
salonsRouter.get("/deals", optionalAuth, async (req, res) => {
  const q = parse(dealsSchema, req.query);
  // Saat dilimi farkı için bir gün geriden filtrelenir; kesin kontrol publicDiscount'ta yapılır.
  const floor = new Date(Date.now() - 86_400_000);
  const salons = await prisma.salon.findMany({
    where: {
      ...visibleSalonWhere,
      ...(q.city ? { city: { equals: q.city, mode: "insensitive" as const } } : {}),
      services: { some: { isActive: true, discountPercent: { not: null }, discountEndsOn: { gte: floor } } },
    },
    include: {
      workingHours: true,
      services: { where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] },
    },
  });
  const items = salons
    .map((s) => {
      const today = todayIn(s.timezone);
      const deals = s.services
        .map((svc) => ({ svc, d: publicDiscount(svc, today) }))
        .filter((x) => x.d !== null)
        .map(({ svc, d }) => ({ serviceId: svc.id, name: svc.name, listPrice: toTL(svc.priceCents), ...d! }));
      return {
        salon: serializeSalonSummary(
          s,
          q.lat !== undefined && q.lng !== undefined
            ? { distanceKm: distanceKm(q.lat, q.lng, s.latitude, s.longitude) }
            : {},
        ),
        deals: deals.sort((a, b) => Number(b.activeToday) - Number(a.activeToday) || b.percent - a.percent),
      };
    })
    .filter((x) => x.deals.length)
    .sort(
      (a, b) =>
        Number(b.deals[0]!.activeToday) - Number(a.deals[0]!.activeToday) || b.deals[0]!.percent - a.deals[0]!.percent,
    );
  res.json({ items });
});

async function activeSalon(id: string) {
  const salon = await prisma.salon.findFirst({ where: { id, ...bookableSalonWhere } });
  if (!salon) throw notFound("Salon bulunamadı");
  return salon;
}

salonsRouter.get("/:id", optionalAuth, async (req, res) => {
  const id = parse(zId, req.params.id);
  const salon = await prisma.salon.findFirst({
    where: { id, ...visibleSalonWhere },
    include: {
      workingHours: true,
      staff: { where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] },
      services: { where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] },
      packages: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: { items: { include: { service: true } } },
      },
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
      photos: salon.photos.length ? salon.photos : salon.coverImageUrl ? [salon.coverImageUrl] : [],
      whatsapp: salon.whatsapp,
      firstVisitDiscountPercent: salon.isListing ? null : salon.firstVisitDiscountPercent,
      packages: salon.packages.map(serializePackage).filter((p) => p.services.length >= 2),
      workingHours: serializeWorkingHours(salon.workingHours),
      staff: salon.staff.map(serializeStaff),
      services: salon.services.map((x) => serializeService(x, todayIn(salon.timezone))),
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
  const dist = await prisma.salonReview.groupBy({ by: ["rating"], where: { salonId: salon.id }, _count: true });
  const items = rows.map((r) => ({
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    // Gizlilik: yalnızca ad ve soyadın baş harfi gösterilir.
    authorName: !r.user || r.user.deletedAt ? "Anonim" : shortName(r.user.name),
    createdAt: r.createdAt.toISOString(),
  }));
  res.json({
    ...pageResult(items, total, page, pageSize),
    summary: {
      average: Math.round(salon.ratingAvg * 10) / 10,
      count: salon.ratingCount,
      distribution: [5, 4, 3, 2, 1].map((r) => ({ rating: r, count: dist.find((d) => d.rating === r)?._count ?? 0 })),
    },
  });
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
