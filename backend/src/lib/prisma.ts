import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.ts";
import { env } from "../config/env.ts";

// Süreç başına tek bağlantı havuzu.
const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
export const prisma = new PrismaClient({ adapter });

export type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * PostgreSQL hata kodunu (ör. 23P01 exclusion, 23505 unique) Prisma hatasından çıkarır.
 * Sürücü adaptörü asıl kodu meta.driverAdapterError.cause.originalCode içinde taşır.
 */
export function pgErrorCode(err: unknown): string | undefined {
  if (!err || typeof err !== "object") return undefined;
  const e = err as { code?: unknown; meta?: { driverAdapterError?: { cause?: { originalCode?: unknown } } } };
  const original = e.meta?.driverAdapterError?.cause?.originalCode;
  if (typeof original === "string") return original;
  // Prisma'nın kendi kodları: P2002 = benzersizlik ihlali
  if (e.code === "P2002") return "23505";
  if (typeof e.code === "string" && /^[0-9A-Z]{5}$/.test(e.code) && !/^P\d{4}$/.test(e.code)) return e.code;
  return undefined;
}
