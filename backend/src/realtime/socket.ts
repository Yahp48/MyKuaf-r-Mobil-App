import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { verifyAccessToken } from "../middleware/auth.ts";
import { logger } from "../lib/logger.ts";
import { prisma } from "../lib/prisma.ts";

let io: Server | undefined;

/**
 * Gerçek zamanlı kanal. Odalar:
 * - user:<id>      → müşterinin kendi randevu/sipariş/bildirim olayları
 * - business:<id>  → işletme panelinin yeni randevu/sipariş/yorum olayları, doğrulama kararı
 * - admins         → yönetim paneli (yeni işletme, doğrulama, talep, yorum, sipariş: admin:activity)
 * Herkese yayın: salons:changed, catalog:changed (harita ve mağaza), availability:changed (boş saatler)
 */
export function attachRealtime(server: HttpServer, corsOrigins: string[]) {
  io = new Server(server, {
    path: "/socket.io",
    cors: corsOrigins.length ? { origin: corsOrigins, credentials: true } : undefined,
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (typeof token !== "string") return next(new Error("UNAUTHORIZED"));
    try {
      socket.data.user = verifyAccessToken(token);
      next();
    } catch {
      next(new Error("UNAUTHORIZED"));
    }
  });

  io.on("connection", async (socket) => {
    const { id: userId, role } = socket.data.user as { id: string; role: string };
    void socket.join(`user:${userId}`);
    if (role === "ADMIN") void socket.join("admins");
    if (role === "BUSINESS_OWNER") {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { businessId: true } });
      if (user?.businessId) void socket.join(`business:${user.businessId}`);
    }
    logger.debug({ userId, role }, "socket bağlandı");
  });

  return io;
}

/** Kullanıcının tüm açık cihazlarına olay gönderir (bağlı değilse sessizce geçer). */
export function emitToUser(userId: string, event: string, payload: unknown) {
  io?.to(`user:${userId}`).emit(event, payload);
}

export function emitToBusiness(businessId: string, event: string, payload: unknown) {
  io?.to(`business:${businessId}`).emit(event, payload);
}

/** Herkese açık veri değişti (salon haritası, ürün kataloğu, boş saatler): istemciler listelerini tazeler. */
export function broadcast(
  event: "salons:changed" | "catalog:changed" | "availability:changed",
  payload: Record<string, unknown>,
) {
  io?.emit(event, payload);
}

/** Bir salonun boş saatleri değişti (randevu alındı/iptal/taşındı): açık randevu ekranları saatleri tazeler. */
export function availabilityChanged(salonId: string) {
  broadcast("availability:changed", { salonId });
}

export type AdminActivityKind =
  | "business.registered"
  | "verification.submitted"
  | "claim.submitted"
  | "ticket.opened"
  | "review.created"
  | "appointment.created"
  | "order.paid"
  | "user.registered";

/** Yönetim paneline canlı olay: listeler ve özet sayılar anında tazelenir. */
export function emitToAdmins(kind: AdminActivityKind, message: string) {
  io?.to("admins").emit("admin:activity", { kind, message, at: new Date().toISOString() });
}

export function closeRealtime() {
  return new Promise<void>((resolve) => {
    if (!io) return resolve();
    void io.close(() => resolve());
  });
}
