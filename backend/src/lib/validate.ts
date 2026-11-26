import { z } from "zod";
import { AppError } from "./errors.ts";

/** Girdiyi şemaya göre doğrular; hatada alan bazlı Türkçe mesajlarla 400 döner. */
export function parse<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const details = result.error.issues.map((i) => ({
      field: i.path.join("."),
      message: i.message,
    }));
    throw new AppError(400, "VALIDATION_ERROR", details[0]?.message ?? "Geçersiz istek", details);
  }
  return result.data;
}

// Ortak alan şemaları
export const zId = z.uuid({ message: "Geçersiz kimlik" });
export const zEmail = z
  .string({ message: "E-posta gerekli" })
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: "Geçerli bir e-posta adresi girin" }).max(254));
export const zPassword = z
  .string()
  .min(8, "Şifre en az 8 karakter olmalı")
  .max(128, "Şifre en fazla 128 karakter olabilir")
  .regex(/[A-Za-zÇĞİÖŞÜçğıöşü]/, "Şifre en az bir harf içermeli")
  .regex(/\d/, "Şifre en az bir rakam içermeli");
export const zPhone = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s()-]/g, ""))
  .pipe(z.string().regex(/^(\+90|0)?5\d{9}$/, "Geçerli bir cep telefonu numarası girin (5XX XXX XX XX)"));
export const zName = z.string().trim().min(2, "Ad en az 2 karakter olmalı").max(80);

export const zPagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export function paginate(page: number, pageSize: number) {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

export function pageResult<T>(items: T[], total: number, page: number, pageSize: number) {
  return { items, page, pageSize, total, hasNextPage: page * pageSize < total };
}
