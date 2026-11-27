import { DateTime } from "luxon";
import { toTL } from "../../lib/money.ts";

export type Discountable = {
  priceCents: number;
  discountPercent: number | null;
  discountStartsOn: Date | null;
  discountEndsOn: Date | null;
};

/** @db.Date alanı → "YYYY-MM-DD" (Prisma tarihleri UTC gece yarısı olarak döner). */
export const isoDay = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

/** Salonun yerel saatine göre bugünün tarihi. */
export const todayIn = (timezone: string) => DateTime.now().setZone(timezone).toISODate()!;

/** İndirimli fiyat: tam TL'ye yuvarlanır (salon fiyatları tam lira). */
export const discountedCents = (cents: number, percent: number) =>
  Math.round((cents * (100 - percent)) / 100 / 100) * 100;

/** Verilen gün (YYYY-MM-DD) için geçerli indirim yüzdesi; yoksa null. */
export function discountPercentOn(s: Discountable, day: string): number | null {
  const from = isoDay(s.discountStartsOn);
  const to = isoDay(s.discountEndsOn);
  if (!s.discountPercent || !from || !to) return null;
  return day >= from && day <= to ? s.discountPercent : null;
}

/** Hizmetin o gün ödenecek fiyatı (kuruş). */
export const priceOn = (s: Discountable, day: string) => {
  const p = discountPercentOn(s, day);
  return p ? discountedCents(s.priceCents, p) : s.priceCents;
};

/** Müşteriye gösterilen indirim bilgisi: yalnızca bitmemiş indirimler. */
export function publicDiscount(s: Discountable, today: string) {
  const from = isoDay(s.discountStartsOn);
  const to = isoDay(s.discountEndsOn);
  if (!s.discountPercent || !from || !to || to < today) return null;
  return {
    percent: s.discountPercent,
    price: toTL(discountedCents(s.priceCents, s.discountPercent)),
    startsOn: from,
    endsOn: to,
    activeToday: today >= from,
  };
}

/** Salon kartı için hizmetlerden gereken alanlar: fiyat aralığı ve indirim rozeti. */
/** Salon listelerinde doğrulama rozeti için işletmeden gereken alan. */
export const SUMMARY_BUSINESS_SELECT = { select: { verificationStatus: true } } as const;

export const SUMMARY_SERVICE_SELECT = {
  priceCents: true,
  discountPercent: true,
  discountStartsOn: true,
  discountEndsOn: true,
} as const;
