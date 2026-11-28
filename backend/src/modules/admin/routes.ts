import { Router, type NextFunction, type Request, type Response } from "express";
import { createReadStream, existsSync } from "node:fs";
import { z } from "zod";
import { prisma } from "../../lib/prisma.ts";
import { pageResult, paginate, parse, zId, zPagination } from "../../lib/validate.ts";
import { AppError, forbidden, notFound } from "../../lib/errors.ts";
import { privatePath } from "../../lib/uploads.ts";
import { shortName } from "../../lib/names.ts";
import { requireAuth } from "../../middleware/auth.ts";
import { broadcast, emitToBusiness } from "../../realtime/socket.ts";
import { audit, auditMiddleware, registerCenterRoutes } from "./center.ts";
import { notify } from "../notifications/notify.ts";
import { serializeBusiness } from "../business/serialize.ts";
import type { Prisma } from "../../generated/prisma/client.ts";

/**
 * Platform yönetici paneli uçları (/api/admin). Yalnızca ADMIN rolü.
 * İşletme doğrulama ve askıya alma, salon sahiplenme talepleri, kategoriler, destek talepleri, yorum moderasyonu;
 * müşteriler, tüm randevu/sipariş/ödemeler, ürün denetimi ve işlem geçmişi center.ts'te.
 * Her değiştirici işlem işlem geçmişine (AdminAction) yazılır.
 */
export const adminRouter = Router();

function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (req.user?.role !== "ADMIN") return next(forbidden("Bu alan yalnızca platform yöneticileri içindir"));
  next();
}
adminRouter.use(requireAuth, requireAdmin, auditMiddleware);
registerCenterRoutes(adminRouter);

// ───────────── Özet ─────────────

adminRouter.get("/overview", async (_req, res) => {
  const [
    pendingVerifications,
    pendingClaims,
    openTickets,
    businesses,
    suspended,
    customers,
    bookable,
    listings,
    hidden,
  ] = await Promise.all([
    prisma.business.count({ where: { verificationStatus: "PENDING" } }),
    prisma.salonClaim.count({ where: { status: "PENDING" } }),
    prisma.supportTicket.count({ where: { status: "OPEN" } }),
    prisma.business.count(),
    prisma.business.count({ where: { status: "SUSPENDED" } }),
    prisma.user.count({ where: { role: "CUSTOMER", deletedAt: null } }),
    prisma.salon.count({ where: { isListing: false, isActive: true } }),
    prisma.salon.count({ where: { isListing: true, isActive: true } }),
    prisma.salonReview.count({ where: { isHidden: true } }),
  ]);
  res.json({
    pendingVerifications,
    pendingClaims,
    openTickets,
    businesses,
    suspended,
    customers,
    bookable,
    listings,
    hidden,
  });
});

// ───────────── İşletmeler ─────────────

const bizListSchema = zPagination.extend({
  q: z.string().trim().max(80).optional(),
  type: z.enum(["SALON", "SELLER"]).optional(),
  status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
  verification: z.enum(["UNVERIFIED", "PENDING", "VERIFIED", "REJECTED"]).optional(),
});

const adminBusiness = (b: Prisma.BusinessGetPayload<{ include: { members: true; salon: true } }>) => ({
  ...serializeBusiness(b),
  verificationStatus: b.verificationStatus,
  verificationNote: b.verificationNote,
  verifiedAt: b.verifiedAt?.toISOString() ?? null,
  hasTaxCertificate: !!b.taxCertificateUrl,
  owner: b.members[0] ? { name: b.members[0].name, email: b.members[0].email, phone: b.members[0].phone } : null,
  salon: b.salon ? { id: b.salon.id, name: b.salon.name, isActive: b.salon.isActive, address: b.salon.address } : null,
});

adminRouter.get("/businesses", async (req, res) => {
  const q = parse(bizListSchema, req.query);
  const where: Prisma.BusinessWhereInput = {
    ...(q.type ? { type: q.type } : {}),
    ...(q.status ? { status: q.status } : {}),
    ...(q.verification ? { verificationStatus: q.verification } : {}),
    ...(q.q
      ? {
          OR: [
            { displayName: { contains: q.q, mode: "insensitive" } },
            { legalName: { contains: q.q, mode: "insensitive" } },
            { taxNumber: { contains: q.q } },
            { email: { contains: q.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.business.findMany({
      where,
      include: { members: true, salon: true },
      // Bekleyen doğrulamalar önce
      orderBy: [{ verificationStatus: "asc" }, { createdAt: "desc" }],
      ...paginate(q.page, q.pageSize),
    }),
    prisma.business.count({ where }),
  ]);
  res.json(pageResult(rows.map(adminBusiness), total, q.page, q.pageSize));
});

async function getBusiness(id: string) {
  const b = await prisma.business.findUnique({ where: { id }, include: { members: true, salon: true } });
  if (!b) throw notFound("İşletme bulunamadı");
  return b;
}

adminRouter.get("/businesses/:id", async (req, res) => {
  res.json({ business: adminBusiness(await getBusiness(parse(zId, req.params.id))) });
});

/** Vergi levhası dosyası (yalnızca yönetici; herkese açık klasörde değildir). */
adminRouter.get("/businesses/:id/tax-certificate", async (req, res) => {
  const b = await getBusiness(parse(zId, req.params.id));
  const file = b.taxCertificateUrl ? privatePath(b.taxCertificateUrl) : null;
  if (!file || !existsSync(file)) throw notFound("Belge bulunamadı");
  const ext = file.split(".").pop()!;
  res.type(ext === "pdf" ? "application/pdf" : `image/${ext === "jpg" ? "jpeg" : ext}`);
  res.setHeader("Cache-Control", "no-store");
  createReadStream(file).pipe(res);
});

const verifySchema = z.object({
  status: z.enum(["VERIFIED", "REJECTED"]),
  note: z.string().trim().max(500).optional(),
});

adminRouter.post("/businesses/:id/verification", async (req, res) => {
  const id = parse(zId, req.params.id);
  const body = parse(verifySchema, req.body);
  if (body.status === "REJECTED" && !body.note) throw new AppError(400, "NOTE_REQUIRED", "Ret sebebi yazın");
  await getBusiness(id);
  const b = await prisma.business.update({
    where: { id },
    data: {
      verificationStatus: body.status,
      verificationNote: body.note ?? null,
      verifiedAt: body.status === "VERIFIED" ? new Date() : null,
    },
    include: { members: true, salon: true },
  });
  broadcast(b.type === "SALON" ? "salons:changed" : "catalog:changed", { businessId: id });
  emitToBusiness(id, "business:updated", { verificationStatus: b.verificationStatus });
  audit(res, {
    action: `business.verification.${body.status.toLowerCase()}`,
    targetType: "business",
    targetId: id,
    summary: `${b.displayName} ${VERIFICATION_TEXT[body.status]}${body.note ? `: ${body.note}` : ""}`,
  });
  res.json({ business: adminBusiness(b) });
});

const VERIFICATION_TEXT: Record<string, string> = {
  VERIFIED: "doğrulandı",
  REJECTED: "doğrulaması reddedildi",
  PENDING: "incelemeye alındı",
  UNVERIFIED: "doğrulaması kaldırıldı",
};

const statusSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED"]),
  reason: z.string().trim().max(500).optional(),
});

/** Askıya alınan işletme uygulamada görünmez ve panele giremez. */
adminRouter.post("/businesses/:id/status", async (req, res) => {
  const id = parse(zId, req.params.id);
  const body = parse(statusSchema, req.body);
  if (body.status === "SUSPENDED" && !body.reason) throw new AppError(400, "NOTE_REQUIRED", "Askıya alma sebebi yazın");
  await getBusiness(id);
  const b = await prisma.business.update({
    where: { id },
    data: { status: body.status, ...(body.reason ? { verificationNote: body.reason } : {}) },
    include: { members: true, salon: true },
  });
  broadcast(b.type === "SALON" ? "salons:changed" : "catalog:changed", { businessId: id });
  emitToBusiness(id, "business:updated", { status: b.status });
  audit(res, {
    action: body.status === "SUSPENDED" ? "business.suspend" : "business.activate",
    targetType: "business",
    targetId: id,
    summary: `${b.displayName} ${body.status === "SUSPENDED" ? `askıya alındı: ${body.reason}` : "yeniden etkinleştirildi"}`,
  });
  res.json({ business: adminBusiness(b) });
});

// ───────────── Salon sahiplenme ─────────────

adminRouter.get("/claims", async (req, res) => {
  const { status } = parse(
    z.object({ status: z.enum(["PENDING", "APPROVED", "REJECTED"]).default("PENDING") }),
    req.query,
  );
  const rows = await prisma.salonClaim.findMany({
    where: { status },
    include: { listing: true, business: { include: { salon: true, members: true } } },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  res.json({
    items: rows.map((c) => ({
      id: c.id,
      status: c.status,
      note: c.note,
      createdAt: c.createdAt.toISOString(),
      listing: {
        id: c.listing.id,
        name: c.listing.name,
        address: c.listing.address,
        phone: c.listing.phone,
        website: c.listing.website,
        source: c.listing.sourceRef,
      },
      business: {
        id: c.business.id,
        displayName: c.business.displayName,
        legalName: c.business.legalName,
        taxNumber: c.business.taxNumber,
        phone: c.business.phone,
        address: c.business.address,
        verificationStatus: c.business.verificationStatus,
        salonName: c.business.salon?.name ?? null,
        ownerEmail: c.business.members[0]?.email ?? null,
      },
    })),
  });
});

/**
 * Onay: rehber kaydı haritadan kalkar; işletmenin salonu onun yerini alır. Rehber kaydını favorileyenler
 * işletmenin salonunu favorilerinde görür. Salonda eksikse telefon/web sitesi rehberden tamamlanır.
 */
adminRouter.post("/claims/:id/approve", async (req, res) => {
  const id = parse(zId, req.params.id);
  const claim = await prisma.salonClaim.findUnique({
    where: { id },
    include: { listing: true, business: { include: { salon: true } } },
  });
  if (!claim || claim.status !== "PENDING") throw notFound("Bekleyen talep bulunamadı");
  const target = claim.business.salon;
  if (!target) throw new AppError(400, "NO_SALON", "İşletmenin salonu yok");
  await prisma.$transaction(async (tx) => {
    const favs = await tx.favoriteSalon.findMany({ where: { salonId: claim.listingId } });
    if (favs.length) {
      await tx.favoriteSalon.createMany({
        data: favs.map((f) => ({ userId: f.userId, salonId: target.id })),
        skipDuplicates: true,
      });
      await tx.favoriteSalon.deleteMany({ where: { salonId: claim.listingId } });
    }
    await tx.salon.update({
      where: { id: target.id },
      data: {
        phone: target.phone ?? claim.listing.phone,
        website: target.website ?? claim.listing.website,
        whatsapp: target.whatsapp ?? claim.listing.whatsapp,
      },
    });
    await tx.salon.update({ where: { id: claim.listingId }, data: { isActive: false } });
    await tx.salonClaim.update({ where: { id }, data: { status: "APPROVED", decidedAt: new Date() } });
    await tx.salonClaim.updateMany({
      where: { listingId: claim.listingId, status: "PENDING", id: { not: id } },
      data: { status: "REJECTED", note: "Kayıt başka bir işletmeye devredildi", decidedAt: new Date() },
    });
  });
  broadcast("salons:changed", { salonId: target.id });
  audit(res, {
    action: "claim.approve",
    targetType: "claim",
    targetId: id,
    summary: `${claim.business.displayName}, "${claim.listing.name}" kaydını sahiplendi`,
  });
  res.json({ ok: true });
});

adminRouter.post("/claims/:id/reject", async (req, res) => {
  const id = parse(zId, req.params.id);
  const { note } = parse(z.object({ note: z.string().trim().min(3, "Ret sebebi yazın").max(500) }), req.body);
  const updated = await prisma.salonClaim.updateMany({
    where: { id, status: "PENDING" },
    data: { status: "REJECTED", note, decidedAt: new Date() },
  });
  if (!updated.count) throw notFound("Bekleyen talep bulunamadı");
  audit(res, {
    action: "claim.reject",
    targetType: "claim",
    targetId: id,
    summary: `Sahiplenme talebi reddedildi: ${note}`,
  });
  res.json({ ok: true });
});

// ───────────── Kategoriler ─────────────

const slugify = (s: string) =>
  s
    .toLocaleLowerCase("tr-TR")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const categorySchema = z.object({
  name: z.string().trim().min(2, "Kategori adı gerekli").max(60),
  sortOrder: z.number().int().min(0).max(999).optional(),
  isActive: z.boolean().optional(),
});

adminRouter.get("/categories", async (_req, res) => {
  const rows = await prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { products: true } } },
  });
  res.json({
    items: rows.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      sortOrder: c.sortOrder,
      isActive: c.isActive,
      productCount: c._count.products,
    })),
  });
});

adminRouter.post("/categories", async (req, res) => {
  const body = parse(categorySchema, req.body);
  const slug = slugify(body.name);
  if (await prisma.category.findUnique({ where: { slug } })) {
    throw new AppError(409, "CATEGORY_EXISTS", "Bu adla bir kategori zaten var");
  }
  const c = await prisma.category.create({ data: { ...body, slug } });
  broadcast("catalog:changed", { categoryId: c.id });
  audit(res, {
    action: "category.create",
    targetType: "category",
    targetId: c.id,
    summary: `Kategori eklendi: ${c.name}`,
  });
  res.status(201).json({ category: c });
});

adminRouter.patch("/categories/:id", async (req, res) => {
  const id = parse(zId, req.params.id);
  const body = parse(categorySchema.partial(), req.body);
  const c = await prisma.category.update({ where: { id }, data: body }).catch(() => {
    throw notFound("Kategori bulunamadı");
  });
  broadcast("catalog:changed", { categoryId: id });
  audit(res, {
    action: "category.update",
    targetType: "category",
    targetId: id,
    summary: `Kategori güncellendi: ${c.name}`,
  });
  res.json({ category: c });
});

// ───────────── Destek talepleri ─────────────

adminRouter.get("/tickets", async (req, res) => {
  const q = parse(zPagination.extend({ status: z.enum(["OPEN", "ANSWERED", "CLOSED"]).optional() }), req.query);
  const where = q.status ? { status: q.status } : {};
  const [rows, total] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      ...paginate(q.page, q.pageSize),
    }),
    prisma.supportTicket.count({ where }),
  ]);
  res.json(
    pageResult(
      rows.map((t) => ({
        id: t.id,
        type: t.type,
        subject: t.subject,
        message: t.message,
        rating: t.rating,
        status: t.status,
        reply: t.reply,
        repliedAt: t.repliedAt?.toISOString() ?? null,
        createdAt: t.createdAt.toISOString(),
        user: t.user ? { name: t.user.name, email: t.user.email } : null,
      })),
      total,
      q.page,
      q.pageSize,
    ),
  );
});

adminRouter.post("/tickets/:id/reply", async (req, res) => {
  const id = parse(zId, req.params.id);
  const { reply } = parse(z.object({ reply: z.string().trim().min(2, "Yanıt yazın").max(3000) }), req.body);
  const t = await prisma.supportTicket
    .update({
      where: { id },
      data: { reply, repliedAt: new Date(), status: "ANSWERED" },
    })
    .catch(() => {
      throw notFound("Talep bulunamadı");
    });
  if (t.userId) {
    await notify(t.userId, {
      type: "support_reply",
      title: "Destek talebiniz yanıtlandı",
      body: reply.length > 140 ? `${reply.slice(0, 137)}…` : reply,
      data: { ticketId: t.id },
    });
  }
  audit(res, { action: "ticket.reply", targetType: "ticket", targetId: id, summary: `Talep yanıtlandı: ${t.subject}` });
  res.json({ ok: true });
});

adminRouter.post("/tickets/:id/close", async (req, res) => {
  const id = parse(zId, req.params.id);
  const updated = await prisma.supportTicket.updateMany({ where: { id }, data: { status: "CLOSED" } });
  if (!updated.count) throw notFound("Talep bulunamadı");
  audit(res, { action: "ticket.close", targetType: "ticket", targetId: id, summary: "Destek talebi kapatıldı" });
  res.json({ ok: true });
});

// ───────────── Yorum moderasyonu ─────────────

adminRouter.get("/reviews", async (req, res) => {
  const q = parse(zPagination.extend({ hidden: z.enum(["true", "false"]).optional() }), req.query);
  const where = q.hidden ? { isHidden: q.hidden === "true" } : {};
  const [rows, total] = await Promise.all([
    prisma.salonReview.findMany({
      where,
      include: { salon: { select: { name: true } }, user: { select: { name: true, deletedAt: true } } },
      orderBy: { createdAt: "desc" },
      ...paginate(q.page, q.pageSize),
    }),
    prisma.salonReview.count({ where }),
  ]);
  res.json(
    pageResult(
      rows.map((r) => ({
        id: r.id,
        salonName: r.salon.name,
        rating: r.rating,
        comment: r.comment,
        photos: r.photos,
        isHidden: r.isHidden,
        hiddenReason: r.hiddenReason,
        authorName: !r.user || r.user.deletedAt ? "Anonim" : shortName(r.user.name),
        createdAt: r.createdAt.toISOString(),
      })),
      total,
      q.page,
      q.pageSize,
    ),
  );
});

/** Yorumu gizler/gösterir ve salon puanını yeniden hesaplar. */
adminRouter.post("/reviews/:id/visibility", async (req, res) => {
  const id = parse(zId, req.params.id);
  const body = parse(z.object({ hidden: z.boolean(), reason: z.string().trim().max(300).optional() }), req.body);
  if (body.hidden && !body.reason) throw new AppError(400, "NOTE_REQUIRED", "Gizleme sebebi yazın");
  const review = await prisma.salonReview.findUnique({ where: { id } });
  if (!review) throw notFound("Yorum bulunamadı");
  await prisma.$transaction(async (tx) => {
    await tx.salonReview.update({
      where: { id },
      data: { isHidden: body.hidden, hiddenReason: body.hidden ? body.reason : null },
    });
    const agg = await tx.salonReview.aggregate({
      where: { salonId: review.salonId, isHidden: false },
      _avg: { rating: true },
      _count: true,
    });
    await tx.salon.update({
      where: { id: review.salonId },
      data: { ratingAvg: agg._avg.rating ?? 0, ratingCount: agg._count },
    });
  });
  broadcast("salons:changed", { salonId: review.salonId });
  audit(res, {
    action: body.hidden ? "review.hide" : "review.show",
    targetType: "review",
    targetId: id,
    summary: body.hidden ? `Yorum gizlendi: ${body.reason}` : "Yorum yeniden yayında",
  });
  res.json({ ok: true });
});
