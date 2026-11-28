import { Router } from "express";
import { z } from "zod";
import { env } from "../../config/env.ts";
import { logger } from "../../lib/logger.ts";

/**
 * Platformu işleten şirketin yasal kimliği (6563 sayılı Kanun: aracı hizmet sağlayıcı bilgileri,
 * KVKK: veri sorumlusu). Değerler .env'deki COMPANY_* anahtarlarından gelir; boş olan alan gösterilmez.
 * Uygulama ve işletme paneli aynı kaynaktan okur.
 */
export function companyInfo() {
  if (!env.COMPANY_LEGAL_NAME) return null;
  const opt = (v: string) => v || null;
  return {
    legalName: env.COMPANY_LEGAL_NAME,
    shortName: env.COMPANY_SHORT_NAME || env.COMPANY_LEGAL_NAME,
    address: opt(env.COMPANY_ADDRESS),
    taxOffice: opt(env.COMPANY_TAX_OFFICE),
    taxNumber: opt(env.COMPANY_TAX_NUMBER),
    mersisNo: opt(env.COMPANY_MERSIS),
    kep: opt(env.COMPANY_KEP),
    // İletişim: platformun kendi adresi (işleten şirketin genel iletişim bilgisi gösterilmez)
    email: opt(env.SUPPORT_EMAIL),
    phone: opt(env.SUPPORT_PHONE),
  };
}

export const metaRouter = Router();

metaRouter.get("/company", (_req, res) => {
  res.set("Cache-Control", "public, max-age=300");
  res.json({ company: companyInfo() });
});

/**
 * Uygulama hata bildirimi: mobil uygulamada yakalanan JavaScript hatası (çökme yerine hata ekranı gösterilir)
 * buraya gönderilir ve sunucu günlüğüne yazılır. Kişisel veri gönderilmez; yalnızca hata metni ve sürüm.
 */
const clientErrorSchema = z.object({
  message: z.string().max(1000),
  stack: z.string().max(6000).optional(),
  fatal: z.boolean().optional(),
  where: z.string().max(60).optional(),
  platform: z.string().max(20).optional(),
  appVersion: z.string().max(20).optional(),
});

metaRouter.post("/client-errors", (req, res) => {
  const r = clientErrorSchema.safeParse(req.body);
  if (r.success) logger.error({ clientError: r.data }, `Uygulama hatası: ${r.data.message}`);
  res.status(204).end();
});
