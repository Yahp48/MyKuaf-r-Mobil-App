import { Router } from "express";
import { z } from "zod";
import { prisma, pgErrorCode } from "../../lib/prisma.ts";
import { parse, zEmail, zName, zPassword, zPhone } from "../../lib/validate.ts";
import { AppError, conflict } from "../../lib/errors.ts";
import { hashPassword, verifyPassword } from "../../lib/password.ts";
import { numericCode, sha256 } from "../../lib/codes.ts";
import { sendMail } from "../../lib/mailer.ts";
import { authLimiter } from "../../middleware/rate-limit.ts";
import { serializeUser } from "../users/serialize.ts";
import { issueTokens, revokeAllUserTokens, revokeRefreshToken, rotateRefreshToken } from "./tokens.ts";

export const authRouter = Router();
authRouter.use(authLimiter);

const RESET_CODE_TTL_MS = 15 * 60_000;
const RESET_MAX_ATTEMPTS = 5;

const registerSchema = z.object({
  name: zName,
  email: zEmail,
  password: zPassword,
  phone: zPhone.optional(),
  // KVKK aydınlatma metni ve kullanım koşulları onayı zorunlu
  acceptTerms: z.literal(true, { message: "Kullanım koşullarını ve KVKK aydınlatma metnini onaylamalısınız" }),
  marketingOptIn: z.boolean().default(false),
});

authRouter.post("/register", async (req, res) => {
  const body = parse(registerSchema, req.body);
  const existing = await prisma.user.findUnique({ where: { email: body.email } });
  if (existing) throw conflict("EMAIL_TAKEN", "Bu e-posta adresiyle kayıtlı bir hesap zaten var");

  try {
    const user = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        phone: body.phone,
        passwordHash: await hashPassword(body.password),
        marketingOptIn: body.marketingOptIn,
      },
    });
    const tokens = await issueTokens(user, req.get("user-agent"));
    res.status(201).json({ user: serializeUser(user), ...tokens });
  } catch (err) {
    if (pgErrorCode(err) === "23505") throw conflict("EMAIL_TAKEN", "Bu e-posta adresiyle kayıtlı bir hesap zaten var");
    throw err;
  }
});

const loginSchema = z.object({ email: zEmail, password: z.string().min(1, "Şifre gerekli").max(128) });

authRouter.post("/login", async (req, res) => {
  const body = parse(loginSchema, req.body);
  const user = await prisma.user.findUnique({ where: { email: body.email } });
  const ok = await verifyPassword(user?.deletedAt ? null : user?.passwordHash, body.password);
  if (!user || !ok) throw new AppError(401, "INVALID_CREDENTIALS", "E-posta veya şifre hatalı");
  if (user.role === "BUSINESS_OWNER") {
    throw new AppError(403, "BUSINESS_ACCOUNT", "Bu bir işletme hesabı. Lütfen işletme panelinden giriş yapın.");
  }

  const tokens = await issueTokens(user, req.get("user-agent"));
  res.json({ user: serializeUser(user), ...tokens });
});

const refreshSchema = z.object({ refreshToken: z.string().min(20).max(200) });

authRouter.post("/refresh", async (req, res) => {
  const { refreshToken } = parse(refreshSchema, req.body);
  res.json(await rotateRefreshToken(refreshToken, req.get("user-agent")));
});

authRouter.post("/logout", async (req, res) => {
  const { refreshToken } = parse(refreshSchema, req.body);
  await revokeRefreshToken(refreshToken);
  res.status(204).end();
});

const forgotSchema = z.object({ email: zEmail });

// Hesabın varlığını sızdırmamak için her durumda aynı yanıt döner.
authRouter.post("/forgot-password", async (req, res) => {
  const { email } = parse(forgotSchema, req.body);
  const user = await prisma.user.findUnique({ where: { email } });
  if (user && !user.deletedAt) {
    const code = numericCode(6);
    await prisma.$transaction([
      prisma.passwordReset.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } }),
      prisma.passwordReset.create({
        data: { userId: user.id, codeHash: sha256(code), expiresAt: new Date(Date.now() + RESET_CODE_TTL_MS) },
      }),
    ]);
    await sendMail({
      to: user.email,
      subject: "MyKuaför şifre sıfırlama kodunuz",
      text:
        `Merhaba ${user.name},\n\nŞifre sıfırlama kodunuz: ${code}\n\n` +
        `Kod 15 dakika geçerlidir. Bu isteği siz yapmadıysanız bu e-postayı dikkate almayın.\n\nMyKuaför`,
    });
  }
  res.json({ message: "Bu e-posta adresi kayıtlıysa bir sıfırlama kodu gönderildi" });
});

const resetSchema = z.object({
  email: zEmail,
  code: z.string().regex(/^\d{6}$/, "Kod 6 haneli olmalı"),
  newPassword: zPassword,
});

authRouter.post("/reset-password", async (req, res) => {
  const body = parse(resetSchema, req.body);
  const invalid = new AppError(400, "INVALID_RESET_CODE", "Kod hatalı veya süresi dolmuş");

  const user = await prisma.user.findUnique({ where: { email: body.email } });
  if (!user || user.deletedAt) throw invalid;

  const reset = await prisma.passwordReset.findFirst({
    where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!reset || reset.attempts >= RESET_MAX_ATTEMPTS) throw invalid;

  if (reset.codeHash !== sha256(body.code)) {
    await prisma.passwordReset.update({ where: { id: reset.id }, data: { attempts: { increment: 1 } } });
    throw invalid;
  }

  await prisma.$transaction([
    prisma.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
    prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(body.newPassword) } }),
  ]);
  // Şifre değişince tüm cihazlardaki oturumlar kapanır.
  await revokeAllUserTokens(user.id);
  res.json({ message: "Şifreniz güncellendi, yeni şifrenizle giriş yapabilirsiniz" });
});
