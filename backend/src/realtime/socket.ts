import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { verifyAccessToken } from "../middleware/auth.ts";
import { logger } from "../lib/logger.ts";
import { prisma } from "../lib/prisma.ts";

let io: Server | undefined;

/**
 * Gerçek zamanlı kanal. Odalar:
 * - user:<id>      → müşterinin kendi randevu/sipariş/bildirim olayları
 * - business:<id>  → işletme panelinin yeni randevu/sipariş olayları
 * Herkese yayın: salons:changed, catalog:changed (harita ve mağaza anında güncellenir)
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

/** Herkese açık veri değişti (salon haritası, ürün kataloğu): istemciler listelerini tazeler. */
export function broadcast(event: "salons:changed" | "catalog:changed", payload: Record<string, unknown>) {
  io?.emit(event, payload);
}

export function closeRealtime() {
  return new Promise<void>((resolve) => {
    if (!io) return resolve();
    void io.close(() => resolve());
  });
}
