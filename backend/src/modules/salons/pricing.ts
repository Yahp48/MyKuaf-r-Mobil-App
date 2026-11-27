import { prisma } from "../../lib/prisma.ts";
import { AppError } from "../../lib/errors.ts";
import { resolveServices } from "./availability.ts";

/** İndirimler tam TL'ye yuvarlanır (salon fiyatları tam lira). */
const wholeTL = (cents: number) => Math.round(cents / 100) * 100;

/**
 * Randevu fiyatını SUNUCUDA hesaplar:
 *  - Paketle alınırsa paket fiyatı (hizmetlere orantılı dağıtılır), değilse hizmetlerin o günkü (indirimli) fiyatı
 *  - Salon "ilk ziyaret indirimi" verdiyse ve kullanıcının bu salonda iptal edilmemiş randevusu yoksa yüzde indirim
 */
export async function priceBooking(input: {
  salonId: string;
  serviceIds: string[];
  packageId?: string;
  day: string;
  userId?: string;
  firstVisitDiscountPercent: number | null;
}) {
  let services: Awaited<ReturnType<typeof resolveServices>>["services"];
  let subtotalCents: number;
  let durationMinutes: number;

  if (input.packageId) {
    const pkg = await prisma.servicePackage.findFirst({
      where: { id: input.packageId, salonId: input.salonId, isActive: true },
      include: { items: true },
    });
    if (!pkg) throw new AppError(400, "INVALID_PACKAGE", "Seçilen paket bu salonda bulunmuyor");
    const resolved = await resolveServices(
      input.salonId,
      pkg.items.map((i) => i.serviceId),
    );
    if (resolved.services.length < 2) throw new AppError(400, "INVALID_PACKAGE", "Paket şu anda kullanılamıyor");
    const list = resolved.services.reduce((sum, s) => sum + s.priceCents, 0);
    let left = pkg.priceCents;
    services = resolved.services.map((s, i, arr) => {
      const share = i === arr.length - 1 ? left : Math.round((pkg.priceCents * s.priceCents) / Math.max(1, list));
      left -= share;
      return { ...s, chargedCents: share };
    });
    subtotalCents = pkg.priceCents;
    durationMinutes = resolved.durationMinutes;
  } else {
    const resolved = await resolveServices(input.salonId, input.serviceIds, input.day);
    services = resolved.services;
    subtotalCents = resolved.totalCents;
    durationMinutes = resolved.durationMinutes;
  }

  let discountCents = 0;
  let firstVisit = false;
  if (input.userId && input.firstVisitDiscountPercent) {
    const previous = await prisma.appointment.count({
      where: { userId: input.userId, salonId: input.salonId, status: { not: "CANCELLED" } },
    });
    if (previous === 0) {
      firstVisit = true;
      discountCents = wholeTL((subtotalCents * input.firstVisitDiscountPercent) / 100);
    }
  }

  return {
    services,
    durationMinutes,
    subtotalCents,
    discountCents,
    totalCents: Math.max(0, subtotalCents - discountCents),
    firstVisit,
    packageId: input.packageId ?? null,
  };
}
