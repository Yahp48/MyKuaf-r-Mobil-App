import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { verifyAccessToken } from "../middleware/auth.ts";
import { logger } from "../lib/logger.ts";

let io: Server | undefined;

export function attachRealtime(server: HttpServer, corsOrigins: string[]) {
  io = new Server(server, {
    path: "/socket.io",
    cors: corsOrigins.length ? { origin: corsOrigins } : undefined,
  });

  // Bağlantı yalnızca geçerli erişim token'ı ile kabul edilir.
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

  io.on("connection", (socket) => {
    const userId: string = socket.data.user.id;
    void socket.join(`user:${userId}`);
    logger.debug({ userId }, "socket bağlandı");
  });

  return io;
}

/** Kullanıcının tüm açık cihazlarına olay gönderir (bağlı değilse sessizce geçer). */
export function emitToUser(userId: string, event: string, payload: unknown) {
  io?.to(`user:${userId}`).emit(event, payload);
}

export function closeRealtime() {
  return new Promise<void>((resolve) => {
    if (!io) return resolve();
    void io.close(() => resolve());
  });
}
