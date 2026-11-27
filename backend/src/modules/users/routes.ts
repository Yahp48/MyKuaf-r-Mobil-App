import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.ts";
import { parse, zId, zName, zPassword, zPhone } from "../../lib/validate.ts";
import { AppError, conflict, notFound } from "../../lib/errors.ts";
import { hashPassword, verifyPassword } from "../../lib/password.ts";
import { requireAuth, userId } from "../../middleware/auth.ts";
import { revokeAllUserTokens } from "../auth/tokens.ts";
import { sha256 } from "../../lib/codes.ts";
import { serializeUser } from "./serialize.ts";

export const usersRouter = Router();
usersRouter.use(requireAuth);

async function getActiveUser(id: string) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.deletedAt) throw new AppError(401, "UNAUTHORIZED", "Hesap bulunamadı");
  return user;
}

usersRouter.get("/me", async (req, res) => {
  res.json({ user: serializeUser(await getActiveUser(userId(req))) });
});

const updateSchema = z
  .object({
    name: zName.optional(),
    phone: zPhone.nullable().optional(),
    marketingOptIn: z.boolean().optional(),
  })
  .strict();

usersRouter.patch("/me", async (req, res) => {
  const body = parse(updateSchema, req.body);
  await getActiveUser(userId(req));
  const user = await prisma.user.update({ where: { id: userId(req) }, data: body });
  res.json({ user: serializeUser(user) });
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Mevcut şifre gerekli").max(128),
  newPassword: zPassword,
  // Gönderilirse bu cihazdaki oturum açık kalır, diğer tüm cihazlar çıkış yapar.
  refreshToken: z.string().max(200).optional(),
});

usersRouter.post("/me/change-password", async (req, res) => {
  const body = parse(changePasswordSchema, req.body);
  const user = await getActiveUser(userId(req));
  if (!(await verifyPassword(user.passwordHash, body.currentPassword))) {
    throw new AppError(400, "INVALID_PASSWORD", "Mevcut şifreniz hatalı");
  }
  if (body.currentPassword === body.newPassword) {
    throw new AppError(400, "SAME_PASSWORD", "Yeni şifre mevcut şifreden farklı olmalı");
  }
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(body.newPassword) } });
  // Diğer cihazlardaki oturumları kapat; istemci mevcut yenileme token'ını kullanmaya devam edebilir.
  const current = body.refreshToken
    ? await prisma.refreshToken.findUnique({ where: { tokenHash: sha256(body.refreshToken) } })
    : null;
  await revokeAllUserTokens(user.id, current?.userId === user.id ? current.familyId : undefined);
  res.json({ message: "Şifreniz güncellendi, diğer cihazlardaki oturumlar kapatıldı" });
});

/**
 * Hesap silme (App Store 5.1.1(v) ve Google Play hesap silme şartı, KVKK md. 7).
 * Kişisel veriler silinir/anonimleştirilir; yasal saklama yükümlülüğü olan sipariş kayıtları
 * kişiyle ilişkisi kesilerek korunur.
 */
const deleteSchema = z.object({ password: z.string().min(1, "Şifrenizi girin").max(128) });

usersRouter.delete("/me", async (req, res) => {
  const { password } = parse(deleteSchema, req.body);
  const user = await getActiveUser(userId(req));
  if (!(await verifyPassword(user.passwordHash, password))) {
    throw new AppError(400, "INVALID_PASSWORD", "Şifreniz hatalı");
  }
  if (user.walletBalanceCents > 0) {
    throw conflict(
      "WALLET_NOT_EMPTY",
      "Cüzdanınızda bakiye bulunuyor. Bakiye iadesi için Destek bölümünden bize ulaşın, ardından hesabınızı silebilirsiniz.",
    );
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.appointment.updateMany({
      where: { userId: user.id, status: { in: ["PENDING", "CONFIRMED"] }, startsAt: { gt: now } },
      data: { status: "CANCELLED", cancelledAt: now, cancelReason: "Müşteri hesabını sildi" },
    }),
    prisma.appointment.updateMany({
      where: { userId: user.id },
      data: { customerName: "Silinmiş kullanıcı", customerPhone: null, customerNote: null },
    }),
    prisma.cartItem.deleteMany({ where: { userId: user.id } }),
    prisma.favoriteProduct.deleteMany({ where: { userId: user.id } }),
    prisma.favoriteSalon.deleteMany({ where: { userId: user.id } }),
    prisma.address.deleteMany({ where: { userId: user.id } }),
    prisma.pushToken.deleteMany({ where: { userId: user.id } }),
    prisma.notification.deleteMany({ where: { userId: user.id } }),
    prisma.passwordReset.deleteMany({ where: { userId: user.id } }),
    prisma.refreshToken.deleteMany({ where: { userId: user.id } }),
    prisma.user.update({
      where: { id: user.id },
      data: {
        email: `deleted+${user.id}@deleted.invalid`,
        name: "Silinmiş kullanıcı",
        phone: null,
        passwordHash: null,
        marketingOptIn: false,
        deletedAt: now,
      },
    }),
  ]);
  res.status(204).end();
});

// ───────────── Adresler ─────────────

const addressSchema = z.object({
  title: z.string().trim().min(1, "Adres başlığı gerekli").max(40),
  fullName: zName,
  phone: zPhone,
  city: z.string().trim().min(2, "İl gerekli").max(60),
  district: z.string().trim().min(2, "İlçe gerekli").max(60),
  line: z.string().trim().min(10, "Açık adres en az 10 karakter olmalı").max(300),
  postalCode: z
    .string()
    .trim()
    .regex(/^\d{5}$/, "Posta kodu 5 haneli olmalı")
    .optional(),
  isDefault: z.boolean().default(false),
});

const serializeAddress = (a: {
  id: string;
  title: string;
  fullName: string;
  phone: string;
  city: string;
  district: string;
  line: string;
  postalCode: string | null;
  isDefault: boolean;
}) => ({
  id: a.id,
  title: a.title,
  fullName: a.fullName,
  phone: a.phone,
  city: a.city,
  district: a.district,
  line: a.line,
  postalCode: a.postalCode,
  isDefault: a.isDefault,
});

usersRouter.get("/me/addresses", async (req, res) => {
  const items = await prisma.address.findMany({
    where: { userId: userId(req) },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
  res.json({ items: items.map(serializeAddress) });
});

usersRouter.post("/me/addresses", async (req, res) => {
  const body = parse(addressSchema, req.body);
  const uid = userId(req);
  const count = await prisma.address.count({ where: { userId: uid } });
  if (count >= 10) throw new AppError(400, "ADDRESS_LIMIT", "En fazla 10 adres kaydedebilirsiniz");
  const isDefault = body.isDefault || count === 0;

  const address = await prisma.$transaction(async (tx) => {
    if (isDefault) await tx.address.updateMany({ where: { userId: uid }, data: { isDefault: false } });
    return tx.address.create({ data: { ...body, isDefault, userId: uid } });
  });
  res.status(201).json({ address: serializeAddress(address) });
});

usersRouter.patch("/me/addresses/:id", async (req, res) => {
  const id = parse(zId, req.params.id);
  const body = parse(addressSchema.partial(), req.body);
  const uid = userId(req);
  const existing = await prisma.address.findFirst({ where: { id, userId: uid } });
  if (!existing) throw notFound("Adres bulunamadı");

  const address = await prisma.$transaction(async (tx) => {
    if (body.isDefault) await tx.address.updateMany({ where: { userId: uid }, data: { isDefault: false } });
    return tx.address.update({ where: { id }, data: body });
  });
  res.json({ address: serializeAddress(address) });
});

usersRouter.delete("/me/addresses/:id", async (req, res) => {
  const id = parse(zId, req.params.id);
  const uid = userId(req);
  const existing = await prisma.address.findFirst({ where: { id, userId: uid } });
  if (!existing) throw notFound("Adres bulunamadı");
  await prisma.$transaction(async (tx) => {
    await tx.address.delete({ where: { id } });
    // Varsayılan adres silinince en eski adres varsayılan olur.
    if (existing.isDefault) {
      const next = await tx.address.findFirst({ where: { userId: uid }, orderBy: { createdAt: "asc" } });
      if (next) await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  });
  res.status(204).end();
});
