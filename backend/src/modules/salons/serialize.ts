import { DateTime } from "luxon";
import { toTL } from "../../lib/money.ts";

type Hours = { weekday: number; openMinute: number; closeMinute: number; isClosed: boolean };

const hhmm = (minute: number) =>
  `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;

const WEEKDAY_TR = ["", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];

/**
 * Salonun şu an açık olup olmadığı, bugünkü saatleri ve (kapalıysa) bir sonraki açılışı.
 * nextOpen.label örnekleri: "09:00", "yarın 09:00", "Pazartesi 10:00"
 */
export function openStatus(timezone: string, hours: Hours[], now = new Date()) {
  const local = DateTime.fromJSDate(now).setZone(timezone);
  const today = hours.find((h) => h.weekday === local.weekday);
  const minute = local.hour * 60 + local.minute;
  const isOpenNow = !!today && !today.isClosed && minute >= today.openMinute && minute < today.closeMinute;

  let nextOpen: { day: string; time: string; label: string } | null = null;
  if (!isOpenNow) {
    for (let offset = 0; offset < 8; offset++) {
      const d = local.plus({ days: offset });
      const h = hours.find((x) => x.weekday === d.weekday);
      if (!h || h.isClosed || (offset === 0 && minute >= h.openMinute)) continue;
      const time = hhmm(h.openMinute);
      const day = offset === 0 ? "bugün" : offset === 1 ? "yarın" : WEEKDAY_TR[d.weekday]!;
      nextOpen = { day, time, label: offset === 0 ? time : `${day} ${time}` };
      break;
    }
  }
  return {
    isOpenNow,
    todayHours: today && !today.isClosed ? { opens: hhmm(today.openMinute), closes: hhmm(today.closeMinute) } : null,
    nextOpen,
  };
}

export const SALON_KIND_LABEL = {
  WOMEN: "Kadın kuaförü",
  MEN: "Erkek kuaförü",
  UNISEX: "Kadın ve erkek kuaförü",
  BEAUTY: "Güzellik salonu",
} as const;

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
    photos: string[];
    kind: keyof typeof SALON_KIND_LABEL;
    ratingAvg: number;
    ratingCount: number;
    workingHours: Hours[];
    services?: { priceCents: number }[];
  },
  extra: { distanceKm?: number; isFavorite?: boolean } = {},
) {
  const prices = (s.services ?? []).map((x) => x.priceCents);
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
    photo: s.photos[0] ?? s.coverImageUrl,
    kind: s.kind,
    kindLabel: SALON_KIND_LABEL[s.kind],
    priceRange: prices.length ? { min: toTL(Math.min(...prices)), max: toTL(Math.max(...prices)) } : null,
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
