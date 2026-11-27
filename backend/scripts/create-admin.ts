// Platform yöneticisi oluşturur veya mevcut kullanıcıyı yönetici yapar.
// Kullanım: npm run admin:create -- <e-posta> "<Ad Soyad>"
// Şifre ADMIN_PASSWORD ortam değişkeninden okunur; yoksa güçlü bir şifre üretilip bir kez ekrana yazılır.
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { hashPassword } from "../src/lib/password.ts";

const [email, name = "Platform Yöneticisi"] = process.argv.slice(2);
if (!email || !email.includes("@")) {
  console.error('Kullanım: npm run admin:create -- <e-posta> "<Ad Soyad>"');
  process.exit(1);
}
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const password = process.env.ADMIN_PASSWORD || randomBytes(12).toString("base64url");
const passwordHash = await hashPassword(password);
const user = await prisma.user.upsert({
  where: { email: email.toLowerCase() },
  create: { email: email.toLowerCase(), name, passwordHash, role: "ADMIN" },
  update: { role: "ADMIN", businessId: null, ...(process.env.ADMIN_PASSWORD ? { passwordHash } : {}) },
});
console.log(`Yönetici hazır: ${user.email}`);
if (!process.env.ADMIN_PASSWORD) console.log(`Geçici şifre (bir kez gösterilir, girişten sonra değiştirin): ${password}`);
await prisma.$disconnect();
