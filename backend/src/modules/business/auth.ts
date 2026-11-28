import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { prisma, pgErrorCode } from "../../lib/prisma.ts";
import { parse, zEmail, zName, zPassword, zPhone, zTrPhone } from "../../lib/validate.ts";
import { AppError, conflict } from "../../lib/errors.ts";
import { hashPassword, verifyPassword } from "../../lib/password.ts";
import { isValidTaxNumber, isValidTrIban, normalizeIban } from "../../lib/tax-id.ts";
import { env, isProd } from "../../config/env.ts";
import { authLimiter } from "../../middleware/rate-limit.ts";
import { requireAuth, userId } from "../../middleware/auth.ts";
import { requireBusiness, businessOf } from "../../middleware/business.ts";
import { broadcast } from "../../realtime/socket.ts";
import { issueTokens, revokeRefreshToken, rotateRefreshToken } from "../auth/tokens.ts";
import { serializeBusiness, serializeOwner, serializeSalonProfile } from "./serialize.ts";

/**
 * İşletme paneli kimlik doğrulaması. Web panelinde yenileme token'ı JavaScript'in okuyamadığı
 * httpOnly + SameSite=Strict çerezde tutulur (XSS ile çalınamaz); erişim token'ı yalnızca bellekte.
 */
export const businessAuthRouter = Router();

const COOKIE = "mk_panel_rt";
const COOKIE_PATH = "/api/business/auth";

function setRefreshCookie(res: Response, token: string) {
  res.cookie(COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "strict",
    path: COOKIE_PATH,
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 86_400_000,
  });
}

function readRefreshCookie(req: Request): string | undefined {
  const header = req.headers.cookie ?? "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === COOKIE) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

const zTaxNumber = z
  .string()
  .trim()
  .regex(/^\d{10,11}$/, "Vergi numarası 10 haneli VKN veya 11 haneli TC kimlik numarası olmalı")
  .refine(isValidTaxNumber, "Vergi / TC kimlik numarası geçersiz, lütfen kontrol edin");

const zIban = z
  .string()
  .transform(normalizeIban)
  .refine(isValidTrIban, "Geçerli bir TR IBAN girin (TR ile başlayan 26 karakter)");

export const businessInfoSchema = z.object({
  displayName: z.string().trim().min(2, "İşletme / mağaza adı gerekli").max(100),
  legalName: z.string().trim().min(3, "Ticari unvan en az 3 karakter olmalı").max(200),
  taxOffice: z.string().trim().min(2, "Vergi dairesi gerekli").max(80),
  mersisNo: z
    .string()
    .trim()
    .regex(/^\d{16}$/, "MERSİS numarası 16 haneli olmalı")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  kepAddress: z
    .string()
    .trim()
    .max(120)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  address: z.string().trim().min(10, "Açık adres en az 10 karakter olmalı").max(300),
  city: z.string().trim().min(2, "İl gerekli").max(60),
  district: z.string().trim().min(2, "İlçe gerekli").max(60),
  postalCode: z
    .string()
    .trim()
    .regex(/^\d{5}$/, "Posta kodu 5 haneli olmalı")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  phone: zTrPhone,
  email: zEmail,
  iban: zIban.optional().or(z.literal("").transform(() => undefined)),
});

const registerSchema = z
  .object({
    owner: z.object({ name: zName, email: zEmail, password: zPassword, phone: zPhone }),
    business: businessInfoSchema.extend({ type: z.enum(["SALON", "SELLER"]), taxNumber: zTaxNumber }),
    salon: z
      .object({
        name: z.string().trim().min(2, "Salon adı gerekli").max(100),
        kind: z.enum(["HAIR", "BEAUTY", "NAIL", "SKIN", "MASSAGE", "BROW_LASH", "MAKEUP"]).default("HAIR"),
        description: z.string().trim().max(1000).optional(),
        latitude: z.number().min(35).max(43, "Konum Türkiye sınırları içinde olmalı"),
        longitude: z.number().min(25).max(45, "Konum Türkiye sınırları içinde olmalı"),
      })
      .optional(),
    acceptTerms: z.literal(true, { message: "Hizmet sözleşmesini ve KVKK aydınlatma metnini onaylamalısınız" }),
  })
  .refine((v) => v.business.type !== "SALON" || v.salon, {
    message: "Kuaför işletmeleri için salon adı ve harita konumu gerekli",
    path: ["salon"],
  });

function slugify(s: string) {
  const map: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" };
  return s
    .toLocaleLowerCase("tr-TR")
    .replace(/[çğıöşü]/g, (c) => map[c]!)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

async function sessionPayload(uid: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: uid },
    include: { business: { include: { salon: true } } },
  });
  // Platform yöneticisi: işletmesi yoktur, panelde yönetim bölümünü görür.
  if (user.role === "ADMIN") return { owner: serializeOwner(user), business: null, salon: null, isAdmin: true };
  const b = user.business!;
  return {
    owner: serializeOwner(user),
    business: serializeBusiness(b),
    salon: b.salon ? serializeSalonProfile(b.salon) : null,
  };
}

businessAuthRouter.post("/register", authLimiter, async (req, res) => {
  const body = parse(registerSchema, req.body);
  const [emailTaken, taxTaken] = await Promise.all([
    prisma.user.findUnique({ where: { email: body.owner.email } }),
    prisma.business.findUnique({ where: { taxNumber: body.business.taxNumber } }),
  ]);
  if (emailTaken) throw conflict("EMAIL_TAKEN", "Bu e-posta adresiyle kayıtlı bir hesap zaten var");
  if (taxTaken) throw conflict("TAX_NUMBER_TAKEN", "Bu vergi numarasıyla kayıtlı bir işletme zaten var");

  try {
    const user = await prisma.$transaction(async (tx) => {
      const { type, ...info } = body.business;
      const business = await tx.business.create({
        data: { type, ...info, ...(type === "SALON" && body.salon ? { displayName: body.salon.name } : {}) },
      });
      if (type === "SALON" && body.salon) {
        await tx.salon.create({
          data: {
            businessId: business.id,
            slug: `${slugify(body.salon.name)}-${business.id.slice(-6)}`,
            name: body.salon.name,
            kind: body.salon.kind,
            description: body.salon.description,
            address: info.address,
            city: info.city,
            district: info.district,
            phone: info.phone,
            latitude: body.salon.latitude,
            longitude: body.salon.longitude,
            // Varsayılan: Pzt-Cmt 09:00-19:00, Pazar kapalı (panelden değiştirilebilir)
            workingHours: {
              create: Array.from({ length: 7 }, (_, i) => ({
                weekday: i + 1,
                openMinute: 540,
                closeMinute: 1140,
                isClosed: i === 6,
              })),
            },
          },
        });
      }
      return tx.user.create({
        data: {
          name: body.owner.name,
          email: body.owner.email,
          phone: body.owner.phone,
          passwordHash: await hashPassword(body.owner.password),
          role: "BUSINESS_OWNER",
          businessId: business.id,
        },
      });
    });
    if (body.business.type === "SALON") broadcast("salons:changed", { reason: "created" });

    const tokens = await issueTokens(user, req.get("user-agent"));
    setRefreshCookie(res, tokens.refreshToken);
    res
      .status(201)
      .json({ accessToken: tokens.accessToken, expiresIn: tokens.expiresIn, ...(await sessionPayload(user.id)) });
  } catch (err) {
    if (pgErrorCode(err) === "23505") throw conflict("ALREADY_REGISTERED", "E-posta veya vergi numarası zaten kayıtlı");
    throw err;
  }
});

const loginSchema = z.object({ email: zEmail, password: z.string().min(1, "Şifre gerekli").max(128) });

businessAuthRouter.post("/login", authLimiter, async (req, res) => {
  const body = parse(loginSchema, req.body);
  const user = await prisma.user.findUnique({ where: { email: body.email }, include: { business: true } });
  const ok = await verifyPassword(user?.deletedAt ? null : user?.passwordHash, body.password);
  if (!user || !ok) throw new AppError(401, "INVALID_CREDENTIALS", "E-posta veya şifre hatalı");
  if (user.role !== "ADMIN" && (user.role !== "BUSINESS_OWNER" || !user.business)) {
    throw new AppError(
      403,
      "NOT_BUSINESS_ACCOUNT",
      "Bu bir müşteri hesabı. İşletme paneli için işletme hesabıyla giriş yapın.",
    );
  }
  if (user.business?.status === "SUSPENDED") {
    throw new AppError(403, "BUSINESS_SUSPENDED", "İşletme hesabınız askıya alınmış. Lütfen bizimle iletişime geçin.");
  }
  const tokens = await issueTokens(user, req.get("user-agent"));
  setRefreshCookie(res, tokens.refreshToken);
  res.json({ accessToken: tokens.accessToken, expiresIn: tokens.expiresIn, ...(await sessionPayload(user.id)) });
});

businessAuthRouter.post("/refresh", async (req, res) => {
  const raw = readRefreshCookie(req);
  if (!raw) throw new AppError(401, "UNAUTHORIZED", "Oturum açmanız gerekiyor");
  const tokens = await rotateRefreshToken(raw, req.get("user-agent"));
  setRefreshCookie(res, tokens.refreshToken);
  res.json({ accessToken: tokens.accessToken, expiresIn: tokens.expiresIn });
});

businessAuthRouter.post("/logout", async (req, res) => {
  const raw = readRefreshCookie(req);
  if (raw) await revokeRefreshToken(raw);
  res.clearCookie(COOKIE, { path: COOKIE_PATH });
  res.status(204).end();
});

businessAuthRouter.get("/me", requireAuth, (req, res, next) => {
  if (req.user?.role === "ADMIN") {
    sessionPayload(userId(req)).then((p) => res.json(p), next);
    return;
  }
  requireBusiness()(req, res, (err?: unknown) => {
    if (err) return next(err);
    businessOf(req);
    sessionPayload(userId(req)).then((p) => res.json(p), next);
  });
});
