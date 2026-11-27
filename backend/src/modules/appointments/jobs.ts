import { DateTime } from "luxon";
import { prisma } from "../../lib/prisma.ts";
import { logger } from "../../lib/logger.ts";
import { notify } from "../notifications/notify.ts";
import { ACTIVE_APPOINTMENT_STATUSES } from "../salons/availability.ts";

const HOUR = 3_600_000;

/**
 * Randevu hatırlatmaları: başlangıçtan 24 saat ve 2 saat önce bildirim (uygulama içi + push).
 * Hatırlatma penceresine girdikten sonra alınmış randevular için o hatırlatma gönderilmeden işaretlenir
 * (ör. 5 saat kala alınan randevuya "yarın randevunuz var" denmez).
 * Sunucu birkaç dakikada bir çalıştırır; her hatırlatma bir kez gönderilir.
 */
export async function sendDueReminders(now = new Date()) {
  let sent = 0;
  const windows = [
    { field: "reminder24SentAt", ahead: 24 * HOUR, label: "yarın" },
    { field: "reminder2SentAt", ahead: 2 * HOUR, label: "2 saat sonra" },
  ] as const;

  for (const w of windows) {
    const due = await prisma.appointment.findMany({
      where: {
        status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
        userId: { not: null },
        startsAt: { gt: now, lte: new Date(now.getTime() + w.ahead) },
        [w.field]: null,
      },
      include: { salon: { select: { name: true, timezone: true } }, staff: { select: { name: true } } },
      take: 500,
    });
    for (const a of due) {
      // Önce işaretle: aynı anda iki sunucu çalışsa bile tek bildirim gider.
      const claimed = await prisma.appointment.updateMany({
        where: { id: a.id, [w.field]: null },
        data: { [w.field]: now },
      });
      if (!claimed.count) continue;
      const bookedLate = a.startsAt.getTime() - a.createdAt.getTime() < w.ahead + HOUR;
      if (bookedLate) continue;
      const local = DateTime.fromJSDate(a.startsAt).setZone(a.salon.timezone);
      await notify(a.userId!, {
        type: "appointment_reminder",
        title: w.field === "reminder24SentAt" ? "Yarın randevunuz var" : "Randevunuza 2 saat kaldı",
        body: `${a.salon.name} · ${local.toFormat("dd.MM.yyyy HH:mm")} · ${a.staff.name}`,
        data: { appointmentId: a.id },
      });
      sent++;
    }
  }
  return sent;
}

/**
 * Bekleme listesi: bir randevu iptal edilince o salon ve gün için listedeki kullanıcılara haber verilir.
 * Her kayıt bir kez bildirilir; ilk gelen yeri alır.
 */
export async function notifyWaitlist(salonId: string, startsAt: Date, exceptUserId?: string | null) {
  const salon = await prisma.salon.findUnique({ where: { id: salonId }, select: { name: true, timezone: true } });
  if (!salon) return 0;
  const local = DateTime.fromJSDate(startsAt).setZone(salon.timezone);
  const day = new Date(`${local.toISODate()}T00:00:00Z`);
  const entries = await prisma.waitlistEntry.findMany({
    where: { salonId, date: day, notifiedAt: null, ...(exceptUserId ? { userId: { not: exceptUserId } } : {}) },
  });
  for (const e of entries) {
    await prisma.waitlistEntry.update({ where: { id: e.id }, data: { notifiedAt: new Date() } });
    await notify(e.userId, {
      type: "waitlist_slot",
      title: "Beklediğiniz günde yer açıldı",
      body: `${salon.name} · ${local.toFormat("dd.MM.yyyy")} ${local.toFormat("HH:mm")} boşaldı. Hemen randevu alın.`,
      data: { salonId, date: local.toISODate()! },
    });
  }
  return entries.length;
}

/** Geçmiş günlerin bekleme kayıtlarını temizler. */
export async function pruneWaitlist(now = new Date()) {
  const today = new Date(`${DateTime.fromJSDate(now).setZone("Europe/Istanbul").toISODate()}T00:00:00Z`);
  const { count } = await prisma.waitlistEntry.deleteMany({ where: { date: { lt: today } } });
  return count;
}

/** Periyodik işler (sunucu başlatınca çağrılır). */
export function runAppointmentJobs() {
  Promise.all([sendDueReminders(), pruneWaitlist()])
    .then(([sent]) => sent && logger.info({ sent }, "Randevu hatırlatmaları gönderildi"))
    .catch((err) => logger.error({ err }, "Randevu işleri hatası"));
}
