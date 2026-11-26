import { DateTime } from "luxon";
import { toTL } from "../../lib/money.ts";

type Hours = { weekday: number; openMinute: number; closeMinute: number; isClosed: boolean };

const hhmm = (minute: number) =>
  `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;

/** Salonun şu an açık olup olmadığı ve bugünkü kapanış saati. */
export function openStatus(timezone: string, hours: Hours[], now = new Date()) {
  const local = DateTime.fromJSDate(now).setZone(timezone);
  const today = hours.find((h) => h.weekday === local.weekday);
  const minute = local.hour * 60 + local.minute;
  const isOpenNow = !!today && !today.isClosed && minute >= today.openMinute && minute < today.closeMinute;
  return {
    isOpenNow,
    todayHours: today && !today.isClosed ? { opens: hhmm(today.openMinute), closes: hhmm(today.closeMinute) } : null,
  };
}

/** İki koordinat arası kuş uçuşu mesafe (km). */
export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function serializeSalonSummary(
  s: {
    id: string;
    slug: string;
    name: string;
    address: string;
    city: string;
    district: string | null;
    phone: string | null;
    website: string | null;
    latitude: number;
    longitude: number;
    timezone: string;
    coverImageUrl: string | null;
    ratingAvg: number;
    ratingCount: number;
    workingHours: Hours[];
  },
  extra: { distanceKm?: number; isFavorite?: boolean } = {},
) {
  return {
    id: s.id,
    slug: s.slug,
    name: s.name,
    address: s.address,
    city: s.city,
    district: s.district,
    phone: s.phone,
    website: s.website,
    latitude: s.latitude,
    longitude: s.longitude,
    coverImageUrl: s.coverImageUrl,
    rating: Math.round(s.ratingAvg * 10) / 10,
    ratingCount: s.ratingCount,
    ...openStatus(s.timezone, s.workingHours),
    ...(extra.distanceKm !== undefined ? { distanceKm: Math.round(extra.distanceKm * 10) / 10 } : {}),
    ...(extra.isFavorite !== undefined ? { isFavorite: extra.isFavorite } : {}),
  };
}

export const serializeWorkingHours = (hours: Hours[]) =>
  [...hours]
    .sort((a, b) => a.weekday - b.weekday)
    .map((h) => ({
      weekday: h.weekday,
      isClosed: h.isClosed,
      opens: h.isClosed ? null : hhmm(h.openMinute),
      closes: h.isClosed ? null : hhmm(h.closeMinute),
    }));

export const serializeService = (s: {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  priceCents: number;
}) => ({
  id: s.id,
  name: s.name,
  description: s.description,
  durationMinutes: s.durationMinutes,
  price: toTL(s.priceCents),
});

export const serializeStaff = (s: { id: string; name: string; title: string | null; avatarUrl: string | null }) => ({
  id: s.id,
  name: s.name,
  title: s.title,
  avatarUrl: s.avatarUrl,
});
