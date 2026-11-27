import { toTL } from "../../lib/money.ts";
import type { Business, Salon, User } from "../../generated/prisma/client.ts";

export function serializeBusiness(b: Business) {
  return {
    id: b.id,
    type: b.type,
    status: b.status,
    displayName: b.displayName,
    legalName: b.legalName,
    taxNumber: b.taxNumber,
    taxOffice: b.taxOffice,
    mersisNo: b.mersisNo,
    kepAddress: b.kepAddress,
    address: b.address,
    city: b.city,
    district: b.district,
    postalCode: b.postalCode,
    phone: b.phone,
    email: b.email,
    iban: b.iban,
    shippingFee: toTL(b.shippingFeeCents),
    freeShippingThreshold: toTL(b.freeShippingThresholdCents),
    returnPolicy: b.returnPolicy,
    createdAt: b.createdAt.toISOString(),
  };
}

export function serializeOwner(u: User) {
  return { id: u.id, name: u.name, email: u.email, phone: u.phone };
}

export function serializeSalonProfile(s: Salon) {
  return {
    id: s.id,
    name: s.name,
    description: s.description,
    address: s.address,
    city: s.city,
    district: s.district,
    phone: s.phone,
    website: s.website,
    latitude: s.latitude,
    longitude: s.longitude,
    coverImageUrl: s.coverImageUrl,
    photos: s.photos,
    kind: s.kind,
    whatsapp: s.whatsapp,
    isActive: s.isActive,
    slotIntervalMinutes: s.slotIntervalMinutes,
    bookingLeadMinutes: s.bookingLeadMinutes,
    bookingHorizonDays: s.bookingHorizonDays,
    cancellationWindowHours: s.cancellationWindowHours,
    autoConfirm: s.autoConfirm,
    rating: Math.round(s.ratingAvg * 10) / 10,
    ratingCount: s.ratingCount,
  };
}
