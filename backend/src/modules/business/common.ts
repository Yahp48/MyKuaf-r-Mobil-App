import {
  detectImage,
  documentUpload,
  imageUpload,
  isPdf,
  requireImage,
  savePrivate,
  saveUpload,
} from "../../lib/uploads.ts";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.ts";
import { parse, zName, zPassword, zPhone } from "../../lib/validate.ts";
import { AppError } from "../../lib/errors.ts";
import { fromTL } from "../../lib/money.ts";
import { hashPassword, verifyPassword } from "../../lib/password.ts";
import { requireAuth, userId } from "../../middleware/auth.ts";
import { businessOf, requireBusiness } from "../../middleware/business.ts";
import { broadcast } from "../../realtime/socket.ts";
import { revokeAllUserTokens } from "../auth/tokens.ts";
import { businessInfoSchema } from "./auth.ts";
import { serializeBusiness, serializeOwner } from "./serialize.ts";

/** Her iki işletme türünün ortak uçları: /api/business */
export const businessCommonRouter = Router();
businessCommonRouter.use(requireAuth, requireBusiness());

export { UPLOAD_DIR } from "../../lib/uploads.ts";

const profileSchema = businessInfoSchema
  .partial()
  .extend({
    shippingFee: z.number().min(0).max(1000).multipleOf(0.01).optional(),
    freeShippingThreshold: z.number().min(0).max(100_000).multipleOf(0.01).optional(),
    returnPolicy: z.string().trim().max(3000).nullable().optional(),
    logoUrl: z.string().url().max(500).nullable().optional(),
    storeDescription: z.string().trim().max(300).nullable().optional(),
  })
  .strict();

/** İşletme bilgileri. Vergi numarası güvenlik gereği panelden değiştirilemez (destek üzerinden). */
businessCommonRouter.patch("/profile", async (req, res) => {
  const b = businessOf(req);
  const { shippingFee, freeShippingThreshold, ...rest } = parse(profileSchema, req.body);
  if (b.type === "SALON" && (shippingFee !== undefined || freeShippingThreshold !== undefined)) {
    throw new AppError(400, "NOT_SELLER", "Kargo ayarları yalnızca satıcı işletmeler içindir");
  }
  const updated = await prisma.business.update({
    where: { id: b.id },
    data: {
      ...rest,
      ...(shippingFee !== undefined ? { shippingFeeCents: fromTL(shippingFee) } : {}),
      ...(freeShippingThreshold !== undefined ? { freeShippingThresholdCents: fromTL(freeShippingThreshold) } : {}),
    },
  });
  if (b.type === "SELLER") broadcast("catalog:changed", { sellerId: b.id });
  res.json({ business: serializeBusiness(updated) });
});

/** Doğrulama başvurusu: yüklenen vergi levhası yönetici incelemesine gider. */
businessCommonRouter.post("/verification", async (req, res) => {
  const b = businessOf(req);
  const { documentKey } = parse(
    z.object({ documentKey: z.string().regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(pdf|jpg|png|webp)$/, "Geçersiz belge") }),
    req.body,
  );
  if (!documentKey.startsWith(`${b.id}/`)) throw new AppError(400, "INVALID_DOCUMENT", "Geçersiz belge");
  if (b.verificationStatus === "VERIFIED") throw new AppError(400, "ALREADY_VERIFIED", "İşletmeniz zaten doğrulandı");
  const updated = await prisma.business.update({
    where: { id: b.id },
    data: { taxCertificateUrl: documentKey, verificationStatus: "PENDING", verificationNote: null },
  });
  res.json({ business: serializeBusiness(updated) });
});

const accountSchema = z.object({ name: zName.optional(), phone: zPhone.optional() }).strict();

businessCommonRouter.patch("/account", async (req, res) => {
  const body = parse(accountSchema, req.body);
  const user = await prisma.user.update({ where: { id: userId(req) }, data: body });
  res.json({ owner: serializeOwner(user) });
});

const passwordSchema = z.object({ currentPassword: z.string().min(1).max(128), newPassword: zPassword });

businessCommonRouter.post("/account/change-password", async (req, res) => {
  const body = parse(passwordSchema, req.body);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId(req) } });
  if (!(await verifyPassword(user.passwordHash, body.currentPassword))) {
    throw new AppError(400, "INVALID_PASSWORD", "Mevcut şifreniz hatalı");
  }
  if (body.currentPassword === body.newPassword) throw new AppError(400, "SAME_PASSWORD", "Yeni şifre farklı olmalı");
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(body.newPassword) } });
  // Tüm oturumlar kapanır; panel kullanıcıyı yeniden giriş sayfasına yönlendirir.
  await revokeAllUserTokens(user.id);
  res.json({ message: "Şifreniz güncellendi. Lütfen yeni şifrenizle tekrar giriş yapın." });
});

// ───────────── Görsel ve belge yükleme ─────────────

businessCommonRouter.post("/uploads", imageUpload.single("file"), async (req, res) => {
  const { buf, ext } = requireImage(req.file);
  res.status(201).json({ url: await saveUpload(businessOf(req).id, buf, ext) });
});

/** Doğrulama belgesi (vergi levhası): PDF veya görsel. Herkese açık klasöre değil, işletme klasörüne yazılır. */
businessCommonRouter.post("/documents", documentUpload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file) throw new AppError(400, "NO_FILE", "Dosya seçilmedi");
  const ext = isPdf(file.buffer) ? "pdf" : detectImage(file.buffer);
  if (!ext) throw new AppError(400, "INVALID_FILE", "Yalnızca PDF, JPG, PNG veya WEBP yüklenebilir");
  // Anahtar döner; dosya yalnızca yönetici panelinden açılabilir.
  res.status(201).json({ key: await savePrivate(businessOf(req).id, file.buffer, ext) });
});
