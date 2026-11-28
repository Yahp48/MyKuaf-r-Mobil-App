import { createServer } from "node:http";
import { env } from "./config/env.ts";
import { logger } from "./lib/logger.ts";
import { prisma } from "./lib/prisma.ts";
import { corsOrigins, createApp } from "./app.ts";
import { attachRealtime, closeRealtime } from "./realtime/socket.ts";
import { expireStalePayments } from "./modules/payments/service.ts";
import { runAppointmentJobs } from "./modules/appointments/jobs.ts";

const app = createApp();
const server = createServer(app);
attachRealtime(server, corsOrigins);

// Ödeme sayfasında yarım bırakılan işlemleri temizle (stok serbest bırakılır).
const sweeper = setInterval(() => {
  expireStalePayments()
    .then((n) => n && logger.info({ count: n }, "Zaman aşımına uğrayan ödemeler iptal edildi"))
    .catch((err) => logger.error({ err }, "Ödeme temizleyici hatası"));
}, 5 * 60_000);
sweeper.unref();

// Randevu hatırlatmaları (24 saat / 2 saat önce) ve eski bekleme listesi kayıtları.
const reminders = setInterval(runAppointmentJobs, 5 * 60_000);
reminders.unref();
runAppointmentJobs();

server.listen(env.PORT, () => {
  logger.info(`BiBakım API ${env.PORT} portunda çalışıyor (${env.NODE_ENV})`);
});

// Kapanırken açık istekleri bitir, bağlantıları düzgün kapat (Docker/Kubernetes SIGTERM gönderir).
let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "Sunucu kapatılıyor");
  clearInterval(sweeper);
  clearInterval(reminders);
  const force = setTimeout(() => process.exit(1), 10_000);
  force.unref();
  await closeRealtime();
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("unhandledRejection", (err) => logger.error({ err }, "Yakalanmamış promise hatası"));
