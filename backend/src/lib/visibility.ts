import type { Prisma } from "../generated/prisma/client.ts";

/**
 * Müşterilere görünen salon: aktif, işletmesi askıda değil, en az bir aktif personel ve hizmeti var.
 * Yeni kayıt olan işletme personel ve hizmet ekler eklemez haritada belirir.
 */
export const visibleSalonWhere = {
  isActive: true,
  OR: [{ businessId: null }, { business: { status: "ACTIVE" } }],
  staff: { some: { isActive: true } },
  services: { some: { isActive: true } },
} satisfies Prisma.SalonWhereInput;

/** Satışta olan ürün: aktif ve satıcısı askıda değil. */
export const sellableProductWhere = {
  isActive: true,
  seller: { status: "ACTIVE" },
} satisfies Prisma.ProductWhereInput;
