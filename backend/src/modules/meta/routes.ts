import { Router } from "express";
import { env } from "../../config/env.ts";

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
    email: opt(env.COMPANY_EMAIL),
    phone: opt(env.COMPANY_PHONE),
  };
}

export const metaRouter = Router();

metaRouter.get("/company", (_req, res) => {
  res.set("Cache-Control", "public, max-age=300");
  res.json({ company: companyInfo() });
});
