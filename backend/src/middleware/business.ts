import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma.ts";
import { AppError, forbidden, unauthorized } from "../lib/errors.ts";
import type { Business, Salon } from "../generated/prisma/client.ts";
import type { BusinessType } from "../generated/prisma/enums.ts";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      business?: Business;
      salon?: Salon;
    }
  }
}

/**
 * requireAuth sonrası kullanılır: istek sahibinin işletme hesabı olduğunu, işletmenin askıda
 * olmadığını ve (verildiyse) doğru türde olduğunu doğrular. Her istekte veritabanından okunur;
 * askıya alınan işletme anında erişimini kaybeder.
 */
export function requireBusiness(type?: BusinessType) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized());
    if (req.user.role !== "BUSINESS_OWNER") return next(forbidden("Bu alan yalnızca işletme hesapları içindir"));
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { business: { include: { salon: true } } },
    });
    if (!user || user.deletedAt || !user.business) return next(unauthorized("İşletme hesabı bulunamadı"));
    if (user.business.status === "SUSPENDED") {
      return next(
        new AppError(403, "BUSINESS_SUSPENDED", "İşletme hesabınız askıya alınmış. Lütfen bizimle iletişime geçin."),
      );
    }
    if (type && user.business.type !== type) return next(forbidden("Bu sayfa işletme türünüz için değil"));
    const { salon, ...business } = user.business;
    req.business = business;
    if (salon) req.salon = salon;
    next();
  };
}

export function businessOf(req: Request): Business {
  if (!req.business) throw unauthorized();
  return req.business;
}

export function salonOf(req: Request): Salon {
  if (!req.salon) throw new AppError(404, "SALON_NOT_FOUND", "Salon kaydı bulunamadı");
  return req.salon;
}
