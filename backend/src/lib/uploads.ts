import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import multer from "multer";
import { AppError } from "./errors.ts";
import { env } from "../config/env.ts";

export const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");

export const imageUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
export const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
});

/** Dosya uzantısına değil içeriğin ilk baytlarına bakılır (sahte uzantılı dosyalar reddedilir). */
export function detectImage(buf: Buffer): "jpg" | "png" | "webp" | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return "png";
  if (buf.length > 12 && buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP")
    return "webp";
  return null;
}

export const isPdf = (buf: Buffer) => buf.length > 5 && buf.subarray(0, 5).toString() === "%PDF-";

/** Dosyayı uploads/<klasör>/ altına yazar ve herkese açık adresini döner. */
export async function saveUpload(folder: string, buf: Buffer, ext: string) {
  const dir = path.join(UPLOAD_DIR, folder);
  await mkdir(dir, { recursive: true });
  const name = `${randomUUID()}.${ext}`;
  await writeFile(path.join(dir, name), buf);
  return `${env.PUBLIC_BASE_URL}/uploads/${folder}/${name}`;
}

export function requireImage(file: Express.Multer.File | undefined) {
  if (!file) throw new AppError(400, "NO_FILE", "Dosya seçilmedi");
  const ext = detectImage(file.buffer);
  if (!ext) throw new AppError(400, "INVALID_IMAGE", "Yalnızca JPG, PNG veya WEBP görsel yüklenebilir");
  return { buf: file.buffer, ext };
}

/** Müşteri yüklemelerinin adres öneki: yorumlara yalnızca kullanıcının kendi yüklediği görseller eklenebilir. */
export const userUploadPrefix = (userId: string) => `${env.PUBLIC_BASE_URL}/uploads/u/${userId}/`;

/** Gizli belgeler (vergi levhası): herkese açık uploads klasörünün dışında; yalnızca yönetici okur. */
export const PRIVATE_DIR = path.resolve(process.cwd(), "private-uploads");

export async function savePrivate(folder: string, buf: Buffer, ext: string) {
  const dir = path.join(PRIVATE_DIR, folder);
  await mkdir(dir, { recursive: true });
  const name = `${randomUUID()}.${ext}`;
  await writeFile(path.join(dir, name), buf);
  return `${folder}/${name}`;
}

/** Gizli belge anahtarını güvenli dosya yoluna çevirir (dizin dışına çıkma engellenir). */
export function privatePath(key: string) {
  if (!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(pdf|jpg|png|webp)$/.test(key)) return null;
  return path.join(PRIVATE_DIR, key);
}
