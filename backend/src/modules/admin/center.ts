import type { NextFunction, Request, Response, Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.ts";
import { pageResult, paginate, parse, zId, zPagination } from "../../lib/validate.ts";
import { AppError, notFound } from "../../lib/errors.ts";
import { broadcast, emitToBusiness } from "../../realtime/socket.ts";
import type { Prisma } from "../../generated/prisma/client.ts";

/**
 * Yönetim merkezinin geniş görünümü: müşteriler, tüm randevular, siparişler, ödemeler, ürün denetimi,
 * işlem geçmişi ve platform özeti. Yetki kontrolü adminRouter'da (yalnızca ADMIN).
 */

const tl = (cents: number) => Math.round(cents) / 100;
/** Hesabını silen müşterinin anonimleştirilmiş adresi gösterilmez. */
const who = (u: { name: string; email: string } | null | undefined, fallback?: string | null) =>
  !u ? (fallback ?? null) : u.email.endsWith("@deleted.invalid") ? "Silinmiş hesap" : `${u.name} · ${u.email}`;
const DAY = 86_400_000;
// Türkiye 2016'dan beri sabit UTC+3 (yaz saati yok).
const TR_OFFSET = 3 * 3_600_000;
const startOfTodayTR = () => {
  const now = Date.now() + TR_OFFSET;
  return new Date(now - (now % DAY) - TR_OFFSET);
};

// ───────────── İşlem geçmişi (denetim izi) ─────────────

export interface AuditEntry {
  action: string;
  targetType: string;
  targetId?: string | null;
  summary: string;
}

/** Yönetici işlemi başarıyla bitince res.locals.audit'teki kaydı yazar. */
export function auditMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.method === "GET") return next();
  res.on("finish", () => {
    const a = res.locals.audit as AuditEntry | undefined;
    if (!a || res.statusCode >= 400) return;
    prisma.adminAction
      .create({ data: { adminId: req.user?.id ?? null, ...a, targetId: a.targetId ?? null } })
      .catch(() => {});
  });
  next();
}

export const audit = (res: Response, entry: AuditEntry) => {
  res.locals.audit = entry;
};

export function registerCenterRoutes(r: Router) {
  // ───────────── Platform özeti (canlı sayılar ve 14 günlük akış) ─────────────
  r.get("/overview/metrics", async (_req, res) => {
    const today = startOfTodayTR();
    const d7 = new Date(Date.now() - 7 * DAY);
    const d30 = new Date(Date.now() - 30 * DAY);
    const d14 = new Date(today.getTime() - 13 * DAY);
    const [
      appointmentsToday,
      upcoming,
      salesAgg,
      serviceAgg,
      newCustomers7d,
      failedPayments7d,
      ordersToShip,
      aiToday,
      suspendedUsers,
      blockedProducts,
      apptSeries,
      orderSeries,
      userSeries,
    ] = await Promise.all([
      prisma.appointment.count({ where: { startsAt: { gte: today, lt: new Date(today.getTime() + DAY) } } }),
      prisma.appointment.count({ where: { startsAt: { gte: new Date() }, status: { in: ["PENDING", "CONFIRMED"] } } }),
      prisma.payment.aggregate({
        where: { purpose: "ORDER", status: { in: ["SUCCEEDED", "REFUNDED"] }, completedAt: { gte: d30 } },
        _sum: { amountCents: true, refundedCents: true },
        _count: true,
      }),
      prisma.appointment.aggregate({
        where: { status: "COMPLETED", completedAt: { gte: d30 } },
        _sum: { totalCents: true },
        _count: true,
      }),
      prisma.user.count({ where: { role: "CUSTOMER", deletedAt: null, createdAt: { gte: d7 } } }),
      prisma.payment.count({ where: { status: "FAILED", createdAt: { gte: d7 } } }),
      prisma.order.count({ where: { status: { in: ["PAID", "PREPARING"] } } }),
      prisma.aiTryonRequest.count({ where: { createdAt: { gte: today } } }),
      prisma.user.count({ where: { suspendedAt: { not: null } } }),
      prisma.product.count({ where: { blockedAt: { not: null } } }),
      prisma.$queryRaw<{ d: Date; n: bigint }[]>`
        SELECT date_trunc('day', "createdAt" AT TIME ZONE 'Europe/Istanbul') AS d, count(*) AS n
        FROM "Appointment" WHERE "createdAt" >= ${d14} GROUP BY 1`,
      prisma.$queryRaw<{ d: Date; n: bigint }[]>`
        SELECT date_trunc('day', "paidAt" AT TIME ZONE 'Europe/Istanbul') AS d, count(*) AS n
        FROM "Order" WHERE "paidAt" >= ${d14} GROUP BY 1`,
      prisma.$queryRaw<{ d: Date; n: bigint }[]>`
        SELECT date_trunc('day', "createdAt" AT TIME ZONE 'Europe/Istanbul') AS d, count(*) AS n
        FROM "User" WHERE "createdAt" >= ${d14} AND role = 'CUSTOMER' GROUP BY 1`,
    ]);
    const key = (d: Date) => d.toISOString().slice(0, 10);
    const toMap = (rows: { d: Date; n: bigint }[]) => new Map(rows.map((x) => [key(x.d), Number(x.n)]));
    const [am, om, um] = [toMap(apptSeries), toMap(orderSeries), toMap(userSeries)];
    const series = Array.from({ length: 14 }, (_, i) => {
      const day = key(new Date(today.getTime() + TR_OFFSET + (i - 13) * DAY));
      return { day, appointments: am.get(day) ?? 0, orders: om.get(day) ?? 0, customers: um.get(day) ?? 0 };
    });
    res.json({
      appointmentsToday,
      upcomingAppointments: upcoming,
      productSales30d: tl((salesAgg._sum.amountCents ?? 0) - (salesAgg._sum.refundedCents ?? 0)),
      paidOrders30d: salesAgg._count,
      serviceRevenue30d: tl(serviceAgg._sum.totalCents ?? 0),
      completedAppointments30d: serviceAgg._count,
      newCustomers7d,
      failedPayments7d,
      ordersToShip,
      aiTryonsToday: aiToday,
      suspendedUsers,
      blockedProducts,
      series,
    });
  });

  // ───────────── Müşteriler ─────────────
  const userList = zPagination.extend({
    q: z.string().trim().max(80).optional(),
    status: z.enum(["active", "suspended"]).optional(),
  });

  r.get("/users", async (req, res) => {
    const q = parse(userList, req.query);
    const where: Prisma.UserWhereInput = {
      role: "CUSTOMER",
      deletedAt: null,
      ...(q.status === "suspended"
        ? { suspendedAt: { not: null } }
        : q.status === "active"
          ? { suspendedAt: null }
          : {}),
      ...(q.q
        ? {
            OR: [
              { name: { contains: q.q, mode: "insensitive" } },
              { email: { contains: q.q, mode: "insensitive" } },
              { phone: { contains: q.q } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { appointments: true, orders: true } } },
        ...paginate(q.page, q.pageSize),
      }),
      prisma.user.count({ where }),
    ]);
    res.json(
      pageResult(
        rows.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          phone: u.phone,
          createdAt: u.createdAt.toISOString(),
          suspendedAt: u.suspendedAt?.toISOString() ?? null,
          appointments: u._count.appointments,
          orders: u._count.orders,
        })),
        total,
        q.page,
        q.pageSize,
      ),
    );
  });

  r.get("/users/:id", async (req, res) => {
    const id = parse(zId, req.params.id);
    const u = await prisma.user.findFirst({
      where: { id, role: "CUSTOMER" },
      include: {
        _count: {
          select: { appointments: true, orders: true, salonReviews: true, productReviews: true, supportTickets: true },
        },
        appointments: { orderBy: { startsAt: "desc" }, take: 8, include: { salon: { select: { name: true } } } },
        orders: { orderBy: { createdAt: "desc" }, take: 8, include: { seller: { select: { displayName: true } } } },
      },
    });
    if (!u) throw notFound("Müşteri bulunamadı");
    res.json({
      user: {
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        createdAt: u.createdAt.toISOString(),
        deleted: !!u.deletedAt,
        suspendedAt: u.suspendedAt?.toISOString() ?? null,
        suspendReason: u.suspendReason,
        walletBalance: tl(u.walletBalanceCents),
        loyaltyPoints: u.loyaltyPoints,
        marketingOptIn: u.marketingOptIn,
        counts: {
          appointments: u._count.appointments,
          orders: u._count.orders,
          reviews: u._count.salonReviews + u._count.productReviews,
          tickets: u._count.supportTickets,
        },
        appointments: u.appointments.map((a) => ({
          id: a.id,
          code: a.code,
          salon: a.salon.name,
          startsAt: a.startsAt.toISOString(),
          status: a.status,
          total: tl(a.totalCents),
        })),
        orders: u.orders.map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          seller: o.seller.displayName,
          status: o.status,
          total: tl(o.totalCents),
          createdAt: o.createdAt.toISOString(),
        })),
      },
    });
  });

  r.post("/users/:id/status", async (req, res) => {
    const id = parse(zId, req.params.id);
    const body = parse(
      z.object({ suspended: z.boolean(), reason: z.string().trim().min(3, "Sebep yazın").max(300).optional() }),
      req.body,
    );
    if (body.suspended && !body.reason) throw new AppError(400, "REASON_REQUIRED", "Askıya alma sebebini yazın");
    const u = await prisma.user.findFirst({ where: { id, role: "CUSTOMER" } });
    if (!u) throw notFound("Müşteri bulunamadı");
    await prisma.$transaction([
      prisma.user.update({
        where: { id },
        data: body.suspended
          ? { suspendedAt: new Date(), suspendReason: body.reason }
          : { suspendedAt: null, suspendReason: null },
      }),
      // Askıya alınan hesabın tüm oturumları kapanır (erişim token'ı en geç süresi dolunca düşer).
      ...(body.suspended
        ? [prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } })]
        : []),
    ]);
    audit(res, {
      action: body.suspended ? "user.suspend" : "user.activate",
      targetType: "user",
      targetId: id,
      summary: `${u.name} (${u.email}) ${body.suspended ? `askıya alındı: ${body.reason}` : "yeniden etkinleştirildi"}`,
    });
    res.json({ ok: true });
  });

  // ───────────── Tüm randevular ─────────────
  const apptList = zPagination.extend({
    q: z.string().trim().max(80).optional(),
    status: z.enum(["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"]).optional(),
    when: z.enum(["upcoming", "past", "today"]).optional(),
  });
  r.get("/appointments", async (req, res) => {
    const q = parse(apptList, req.query);
    const today = startOfTodayTR();
    const where: Prisma.AppointmentWhereInput = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.when === "upcoming"
        ? { startsAt: { gte: new Date() } }
        : q.when === "past"
          ? { startsAt: { lt: new Date() } }
          : q.when === "today"
            ? { startsAt: { gte: today, lt: new Date(today.getTime() + DAY) } }
            : {}),
      ...(q.q
        ? {
            OR: [
              { code: { contains: q.q.toUpperCase() } },
              { customerName: { contains: q.q, mode: "insensitive" } },
              { salon: { name: { contains: q.q, mode: "insensitive" } } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        orderBy: { startsAt: q.when === "past" ? "desc" : q.when ? "asc" : "desc" },
        include: { salon: { select: { name: true, district: true } }, staff: { select: { name: true } } },
        ...paginate(q.page, q.pageSize),
      }),
      prisma.appointment.count({ where }),
    ]);
    res.json(
      pageResult(
        rows.map((a) => ({
          id: a.id,
          code: a.code,
          salon: a.salon.name,
          district: a.salon.district,
          staff: a.staff.name,
          customer: a.customerName,
          userId: a.userId,
          startsAt: a.startsAt.toISOString(),
          status: a.status,
          source: a.source,
          total: tl(a.totalCents),
        })),
        total,
        q.page,
        q.pageSize,
      ),
    );
  });

  // ───────────── Tüm siparişler ─────────────
  const orderList = zPagination.extend({
    q: z.string().trim().max(80).optional(),
    status: z
      .enum(["PENDING_PAYMENT", "PAID", "PREPARING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"])
      .optional(),
  });
  r.get("/orders", async (req, res) => {
    const q = parse(orderList, req.query);
    const where: Prisma.OrderWhereInput = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.q
        ? {
            OR: [
              { orderNumber: { contains: q.q.toUpperCase() } },
              { customerEmail: { contains: q.q, mode: "insensitive" } },
              { seller: { displayName: { contains: q.q, mode: "insensitive" } } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          seller: { select: { displayName: true } },
          user: { select: { name: true, email: true } },
          _count: { select: { items: true } },
        },
        ...paginate(q.page, q.pageSize),
      }),
      prisma.order.count({ where }),
    ]);
    res.json(
      pageResult(
        rows.map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          seller: o.seller.displayName,
          customer: o.user
            ? who(o.user)
            : o.customerEmail.endsWith("@deleted.invalid")
              ? "Silinmiş hesap"
              : o.customerEmail,
          userId: o.userId,
          items: o._count.items,
          status: o.status,
          paymentMethod: o.paymentMethod,
          total: tl(o.totalCents),
          createdAt: o.createdAt.toISOString(),
          carrier: o.carrier,
          trackingNumber: o.trackingNumber,
        })),
        total,
        q.page,
        q.pageSize,
      ),
    );
  });

  // ───────────── Ödemeler ─────────────
  const payList = zPagination.extend({
    status: z.enum(["PENDING", "SUCCEEDED", "FAILED", "REFUNDED"]).optional(),
    purpose: z.enum(["ORDER", "WALLET_TOPUP", "CARD_VERIFY"]).optional(),
  });
  r.get("/payments", async (req, res) => {
    const q = parse(payList, req.query);
    const where: Prisma.PaymentWhereInput = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.purpose ? { purpose: q.purpose } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: { user: { select: { name: true, email: true } }, orders: { select: { orderNumber: true } } },
        ...paginate(q.page, q.pageSize),
      }),
      prisma.payment.count({ where }),
    ]);
    res.json(
      pageResult(
        rows.map((p) => ({
          id: p.id,
          purpose: p.purpose,
          status: p.status,
          provider: p.provider,
          providerRef: p.providerRef,
          amount: tl(p.amountCents),
          refunded: tl(p.refundedCents),
          failureReason: p.failureReason,
          customer: who(p.user),
          userId: p.userId,
          orders: p.orders.map((o) => o.orderNumber),
          createdAt: p.createdAt.toISOString(),
          completedAt: p.completedAt?.toISOString() ?? null,
        })),
        total,
        q.page,
        q.pageSize,
      ),
    );
  });

  // ───────────── Ürün denetimi ─────────────
  const productList = zPagination.extend({
    q: z.string().trim().max(80).optional(),
    status: z.enum(["blocked", "live"]).optional(),
  });
  r.get("/products", async (req, res) => {
    const q = parse(productList, req.query);
    const where: Prisma.ProductWhereInput = {
      ...(q.status === "blocked"
        ? { blockedAt: { not: null } }
        : q.status === "live"
          ? { blockedAt: null, isActive: true }
          : {}),
      ...(q.q
        ? {
            OR: [
              { name: { contains: q.q, mode: "insensitive" } },
              { brand: { contains: q.q, mode: "insensitive" } },
              { seller: { displayName: { contains: q.q, mode: "insensitive" } } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: [{ blockedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
        include: { seller: { select: { displayName: true } }, category: { select: { name: true } } },
        ...paginate(q.page, q.pageSize),
      }),
      prisma.product.count({ where }),
    ]);
    res.json(
      pageResult(
        rows.map((p) => ({
          id: p.id,
          name: p.name,
          brand: p.brand,
          image: p.images[0] ?? null,
          seller: p.seller.displayName,
          category: p.category.name,
          price: tl(p.priceCents),
          stock: p.stock,
          isActive: p.isActive,
          blockedAt: p.blockedAt?.toISOString() ?? null,
          blockReason: p.blockReason,
          rating: p.ratingAvg,
          ratingCount: p.ratingCount,
        })),
        total,
        q.page,
        q.pageSize,
      ),
    );
  });

  r.post("/products/:id/block", async (req, res) => {
    const id = parse(zId, req.params.id);
    const body = parse(
      z.object({ blocked: z.boolean(), reason: z.string().trim().min(3, "Sebep yazın").max(300).optional() }),
      req.body,
    );
    if (body.blocked && !body.reason) throw new AppError(400, "REASON_REQUIRED", "Yayından kaldırma sebebini yazın");
    const p = await prisma.product.update({
      where: { id },
      data: body.blocked ? { blockedAt: new Date(), blockReason: body.reason } : { blockedAt: null, blockReason: null },
    });
    broadcast("catalog:changed", { productId: id });
    emitToBusiness(p.sellerId, "product:moderated", { productId: id, blocked: body.blocked });
    audit(res, {
      action: body.blocked ? "product.block" : "product.unblock",
      targetType: "product",
      targetId: id,
      summary: `${p.name} ${body.blocked ? `yayından kaldırıldı: ${body.reason}` : "yeniden yayına alındı"}`,
    });
    res.json({ ok: true });
  });

  // ───────────── İşlem geçmişi ─────────────
  r.get("/activity", async (req, res) => {
    const q = parse(zPagination, req.query);
    const [rows, total] = await Promise.all([
      prisma.adminAction.findMany({
        orderBy: { createdAt: "desc" },
        include: { admin: { select: { name: true } } },
        ...paginate(q.page, q.pageSize),
      }),
      prisma.adminAction.count(),
    ]);
    res.json(
      pageResult(
        rows.map((a) => ({
          id: a.id,
          action: a.action,
          targetType: a.targetType,
          targetId: a.targetId,
          summary: a.summary,
          admin: a.admin?.name ?? "—",
          createdAt: a.createdAt.toISOString(),
        })),
        total,
        q.page,
        q.pageSize,
      ),
    );
  });
}
