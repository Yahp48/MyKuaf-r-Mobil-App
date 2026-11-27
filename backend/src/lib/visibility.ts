import type { Prisma } from "../generated/prisma/client.ts";

/**
 * Online randevu alınabilen salon: aktif, işletmesi askıda değil, en az bir aktif personel ve hizmeti var.
 * Yeni kayıt olan işletme personel ve hizmet ekler eklemez haritada belirir.
 */
export const bookableSalonWhere = {
  isActive: true,
  isListing: false,
  OR: [{ businessId: null }, { business: { status: "ACTIVE" } }],
  staff: { some: { isActive: true } },
  services: { some: { isActive: true } },
} satisfies Prisma.SalonWhereInput;

/** Haritada görünen salon: randevu alınabilen salonlar + rehber kayıtları (yalnızca bilgi ve iletişim). */
export const visibleSalonWhere = {
  isActive: true,
  OR: [{ isListing: true, businessId: null }, bookableSalonWhere],
} satisfies Prisma.SalonWhereInput;

/** Satışta olan ürün: aktif ve satıcısı askıda değil. */
export const sellableProductWhere = {
  isActive: true,
  seller: { status: "ACTIVE" },
} satisfies Prisma.ProductWhereInput;
