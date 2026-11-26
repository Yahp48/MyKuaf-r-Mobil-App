import request from "supertest";
import { DateTime } from "luxon";
import { createApp } from "../src/app.ts";
import { prisma } from "../src/lib/prisma.ts";
import { isValidVkn } from "../src/lib/tax-id.ts";

export const app = createApp();
export const api = () => request(app);

/** Tüm tabloları boşaltır (test veritabanı). */
export async function resetDb() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(", ");
  if (list) await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

let counter = 0;
export async function registerUser(overrides: Record<string, unknown> = {}) {
  counter += 1;
  const body = {
    name: "Test Kullanıcı",
    email: `user${counter}_${Date.now()}@example.com`,
    password: "Sifre12345",
    phone: "05551234567",
    acceptTerms: true,
    ...overrides,
  };
  const res = await api().post("/api/auth/register").send(body);
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return {
    ...res.body,
    password: body.password,
    auth: { Authorization: `Bearer ${res.body.accessToken}` },
  } as {
    user: { id: string; email: string };
    accessToken: string;
    refreshToken: string;
    password: string;
    auth: { Authorization: string };
  };
}

/** Her gün 09:00-18:00 açık, 2 personelli, 2 hizmetli salon. */
export async function createSalon(opts: { cancellationWindowHours?: number } = {}) {
  const salon = await prisma.salon.create({
    data: {
      slug: `salon-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: "Test Salonu",
      address: "Test Mah. No:1",
      city: "Kırşehir",
      latitude: 39.15,
      longitude: 34.16,
      bookingLeadMinutes: 0,
      cancellationWindowHours: opts.cancellationWindowHours ?? 2,
      workingHours: {
        create: Array.from({ length: 7 }, (_, i) => ({ weekday: i + 1, openMinute: 540, closeMinute: 1080 })),
      },
      staff: {
        create: [
          { name: "Zeynep", sortOrder: 0 },
          { name: "Elif", sortOrder: 1 },
        ],
      },
      services: {
        create: [
          { name: "Saç Kesimi", durationMinutes: 30, priceCents: 15000, sortOrder: 0 },
          { name: "Boya", durationMinutes: 90, priceCents: 30000, sortOrder: 1 },
        ],
      },
    },
    include: { staff: { orderBy: { sortOrder: "asc" } }, services: { orderBy: { sortOrder: "asc" } } },
  });
  return salon;
}

let taxSeq = 0;
/** Geçerli VKN üretir (algoritma testlerde de doğrulanır). */
export function makeVkn(): string {
  for (;;) {
    taxSeq += 1;
    const base = String(100000000 + ((Date.now() + taxSeq * 7919) % 899999999)).slice(0, 9);
    for (let c = 0; c <= 9; c++) {
      const v = base + c;
      if (isValidVkn(v)) return v;
    }
  }
}

export async function createSeller(overrides: { shippingFeeCents?: number; freeShippingThresholdCents?: number } = {}) {
  return prisma.business.create({
    data: {
      type: "SELLER",
      displayName: "Test Mağaza",
      legalName: "Test Kozmetik Ltd. Şti.",
      taxNumber: makeVkn(),
      taxOffice: "Kırşehir",
      address: "Test Mah. Test Sok. No:1",
      city: "Kırşehir",
      district: "Merkez",
      phone: "03862130000",
      email: `satici${Date.now()}${Math.random().toString(36).slice(2, 6)}@example.com`,
      ...overrides,
    },
  });
}

export async function createProduct(overrides: { stock?: number; priceCents?: number; sellerId?: string } = {}) {
  const category = await prisma.category.upsert({
    where: { slug: "test-kategori" },
    create: { slug: "test-kategori", name: "Test" },
    update: {},
  });
  const sellerId = overrides.sellerId ?? (await createSeller()).id;
  return prisma.product.create({
    data: {
      slug: `urun-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: "Test Şampuan",
      categoryId: category.id,
      sellerId,
      priceCents: overrides.priceCents ?? 10000,
      stock: overrides.stock ?? 5,
      images: ["https://example.com/a.jpg"],
    },
  });
}

/** Salonun saat diliminde yarının tarihi (YYYY-MM-DD). */
export const tomorrow = () => DateTime.now().setZone("Europe/Istanbul").plus({ days: 1 }).toFormat("yyyy-MM-dd");
