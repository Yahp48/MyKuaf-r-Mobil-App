import { randomUUID } from "node:crypto";
import { env } from "../../config/env.ts";
import { prisma } from "../../lib/prisma.ts";
import { randomToken, sha256 } from "../../lib/codes.ts";
import { unauthorized } from "../../lib/errors.ts";
import { logger } from "../../lib/logger.ts";
import { signAccessToken } from "../../middleware/auth.ts";
import type { Role } from "../../generated/prisma/enums.ts";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

async function createRefreshToken(userId: string, familyId: string, userAgent?: string) {
  const raw = randomToken();
  const row = await prisma.refreshToken.create({
    data: {
      userId,
      familyId,
      tokenHash: sha256(raw),
      userAgent: userAgent?.slice(0, 255),
      expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000),
    },
  });
  return { raw, row };
}

export async function issueTokens(
  user: { id: string; role: Role },
  userAgent?: string,
  familyId: string = randomUUID(),
): Promise<TokenPair> {
  const { raw } = await createRefreshToken(user.id, familyId, userAgent);
  return { accessToken: signAccessToken(user), refreshToken: raw, expiresIn: env.ACCESS_TOKEN_TTL_SECONDS };
}

/**
 * Yenileme token'ı döndürme (rotation). Daha önce kullanılmış bir token tekrar gelirse
 * token çalınmış sayılır ve o oturum ailesinin tamamı iptal edilir.
 */
export async function rotateRefreshToken(raw: string, userAgent?: string): Promise<TokenPair> {
  const existing = await prisma.refreshToken.findUnique({
    where: { tokenHash: sha256(raw) },
    include: { user: { select: { id: true, role: true, deletedAt: true, suspendedAt: true } } },
  });
  if (!existing) throw unauthorized("Oturum geçersiz, lütfen tekrar giriş yapın");

  if (existing.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { familyId: existing.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    logger.warn({ userId: existing.userId }, "Yenileme token'ı yeniden kullanıldı; oturum ailesi iptal edildi");
    throw unauthorized("Oturum geçersiz, lütfen tekrar giriş yapın");
  }
  if (existing.expiresAt < new Date() || existing.user.deletedAt || existing.user.suspendedAt) {
    throw unauthorized("Oturum süresi doldu, lütfen tekrar giriş yapın");
  }

  const { raw: nextRaw, row } = await createRefreshToken(existing.userId, existing.familyId, userAgent);
  // Yarış durumunda yalnızca bir istek eski token'ı iptal edebilir.
  const revoked = await prisma.refreshToken.updateMany({
    where: { id: existing.id, revokedAt: null },
    data: { revokedAt: new Date(), replacedBy: row.id },
  });
  if (revoked.count === 0) {
    await prisma.refreshToken.delete({ where: { id: row.id } });
    throw unauthorized("Oturum geçersiz, lütfen tekrar giriş yapın");
  }

  return {
    accessToken: signAccessToken(existing.user),
    refreshToken: nextRaw,
    expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
  };
}

export async function revokeRefreshToken(raw: string) {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: sha256(raw), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllUserTokens(userId: string, exceptFamilyId?: string) {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null, ...(exceptFamilyId ? { NOT: { familyId: exceptFamilyId } } : {}) },
    data: { revokedAt: new Date() },
  });
}
