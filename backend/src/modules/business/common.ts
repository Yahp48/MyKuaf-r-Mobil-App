import { Router } from "express";
import { z } from "zod";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../../lib/prisma.ts";
import { parse, zName, zPassword, zPhone } from "../../lib/validate.ts";
import { AppError } from "../../lib/errors.ts";
import { fromTL } from "../../lib/money.ts";
import { hashPassword, verifyPassword } from "../../lib/password.ts";
import { env } from "../../config/env.ts";
import { requireAuth, userId } from "../../middleware/auth.ts";
import { businessOf, requireBusiness } from "../../middleware/business.ts";
import { broadcast } from "../../realtime/socket.ts";
import { revokeAllUserTokens } from "../auth/tokens.ts";
import { businessInfoSchema } from "./auth.ts";
import { serializeBusiness, serializeOwner } from "./serialize.ts";

/** Her iki işletme türünün ortak uçları: /api/business */
export const businessCommonRouter = Router();
businessCommonRouter.use(requireAuth, requireBusiness());

export const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");

const profileSchema = businessInfoSchema
  .partial()
  .extend({
    shippingFee: z.number().min(0).max(1000).multipleOf(0.01).optional(),
    freeShippingThreshold: z.number().min(0).max(100_000).multipleOf(0.01).optional(),
    returnPolicy: z.string().trim().max(3000).nullable().optional(),
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

// ───────────── Görsel yükleme ─────────────

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });

/** Dosya uzantısına değil içeriğin ilk baytlarına bakılır (sahte uzantılı dosyalar reddedilir). */
function detectImage(buf: Buffer): "jpg" | "png" | "webp" | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return "png";
  if (buf.length > 12 && buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP")
    return "webp";
  return null;
}

businessCommonRouter.post("/uploads", upload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file) throw new AppError(400, "NO_FILE", "Dosya seçilmedi");
  const ext = detectImage(file.buffer);
  if (!ext) throw new AppError(400, "INVALID_IMAGE", "Yalnızca JPG, PNG veya WEBP görsel yüklenebilir");
  const dir = path.join(UPLOAD_DIR, businessOf(req).id);
  await mkdir(dir, { recursive: true });
  const name = `${randomUUID()}.${ext}`;
  await writeFile(path.join(dir, name), file.buffer);
  res.status(201).json({ url: `${env.PUBLIC_BASE_URL}/uploads/${businessOf(req).id}/${name}` });
});
