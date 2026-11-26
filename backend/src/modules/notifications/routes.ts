import { Router } from "express";
import { z } from "zod";
import { Expo } from "expo-server-sdk";
import { prisma } from "../../lib/prisma.ts";
import { pageResult, paginate, parse, zId, zPagination } from "../../lib/validate.ts";
import { AppError, notFound } from "../../lib/errors.ts";
import { requireAuth, userId } from "../../middleware/auth.ts";
import { serializeNotification } from "./notify.ts";

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

notificationsRouter.get("/", async (req, res) => {
  const uid = userId(req);
  const { page, pageSize } = parse(zPagination, req.query);
  const [rows, total, unread] = await Promise.all([
    prisma.notification.findMany({ where: { userId: uid }, orderBy: { createdAt: "desc" }, ...paginate(page, pageSize) }),
    prisma.notification.count({ where: { userId: uid } }),
    prisma.notification.count({ where: { userId: uid, readAt: null } }),
  ]);
  res.json({ ...pageResult(rows.map(serializeNotification), total, page, pageSize), unreadCount: unread });
});

notificationsRouter.post("/read-all", async (req, res) => {
  await prisma.notification.updateMany({ where: { userId: userId(req), readAt: null }, data: { readAt: new Date() } });
  res.status(204).end();
});

notificationsRouter.post("/:id/read", async (req, res) => {
  const updated = await prisma.notification.updateMany({
    where: { id: parse(zId, req.params.id), userId: userId(req), readAt: null },
    data: { readAt: new Date() },
  });
  if (updated.count === 0) {
    const exists = await prisma.notification.findFirst({ where: { id: req.params.id, userId: userId(req) } });
    if (!exists) throw notFound("Bildirim bulunamadı");
  }
  res.status(204).end();
});

notificationsRouter.delete("/:id", async (req, res) => {
  const deleted = await prisma.notification.deleteMany({ where: { id: parse(zId, req.params.id), userId: userId(req) } });
  if (deleted.count === 0) throw notFound("Bildirim bulunamadı");
  res.status(204).end();
});

const pushTokenSchema = z.object({
  token: z.string().max(255),
  platform: z.enum(["ios", "android"]),
});

/** Cihazın Expo push token'ını kaydeder; aynı cihaz başka hesapla giriş yaparsa token yeni hesaba geçer. */
notificationsRouter.put("/push-token", async (req, res) => {
  const body = parse(pushTokenSchema, req.body);
  if (!Expo.isExpoPushToken(body.token)) throw new AppError(400, "INVALID_PUSH_TOKEN", "Geçersiz push token");
  await prisma.pushToken.upsert({
    where: { token: body.token },
    create: { token: body.token, platform: body.platform, userId: userId(req) },
    update: { userId: userId(req), platform: body.platform, lastSeenAt: new Date() },
  });
  res.status(204).end();
});

notificationsRouter.delete("/push-token", async (req, res) => {
  const { token } = parse(z.object({ token: z.string().max(255) }), req.body);
  await prisma.pushToken.deleteMany({ where: { token, userId: userId(req) } });
  res.status(204).end();
});
