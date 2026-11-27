import { Expo, type ExpoPushMessage } from "expo-server-sdk";
import { prisma } from "../../lib/prisma.ts";
import { logger } from "../../lib/logger.ts";
import { emitToUser } from "../../realtime/socket.ts";
import { isTest } from "../../config/env.ts";

const expo = new Expo();

export type NotificationType =
  | "appointment_confirmed"
  | "appointment_cancelled"
  | "order_paid"
  | "order_status"
  | "wallet_topup"
  | "card_saved"
  | "appointment_reminder"
  | "waitlist_slot"
  | "loyalty"
  | "review_reply"
  | "support_reply"
  | "business";

export interface NotifyInput {
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export function serializeNotification(n: {
  id: string;
  type: string;
  title: string;
  body: string;
  data: unknown;
  readAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    data: n.data ?? null,
    read: n.readAt !== null,
    createdAt: n.createdAt.toISOString(),
  };
}

/**
 * Uygulama içi bildirim kaydı oluşturur, açık soketlere iletir ve cihazlara push gönderir.
 * Push hatası ana işlemi asla bozmaz.
 */
export async function notify(userId: string, input: NotifyInput) {
  const notification = await prisma.notification.create({
    data: { userId, type: input.type, title: input.title, body: input.body, data: input.data ?? undefined },
  });
  emitToUser(userId, "notification:new", serializeNotification(notification));
  if (!isTest) void sendPush(userId, input).catch((err) => logger.error({ err }, "Push gönderilemedi"));
  return notification;
}

async function sendPush(userId: string, input: NotifyInput) {
  const tokens = await prisma.pushToken.findMany({ where: { userId }, select: { token: true } });
  const messages: ExpoPushMessage[] = tokens
    .filter((t) => Expo.isExpoPushToken(t.token))
    .map((t) => ({ to: t.token, title: input.title, body: input.body, data: input.data, sound: "default" }));
  if (!messages.length) return;

  for (const chunk of expo.chunkPushNotifications(messages)) {
    const tickets = await expo.sendPushNotificationsAsync(chunk);
    // Cihazdan kaldırılmış token'ları temizle.
    const dead: string[] = [];
    tickets.forEach((ticket, i) => {
      if (ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
        const to = chunk[i]?.to;
        if (typeof to === "string") dead.push(to);
      }
    });
    if (dead.length) await prisma.pushToken.deleteMany({ where: { token: { in: dead } } });
  }
}
