import express, { Router } from "express";
import helmet from "helmet";
import cors from "cors";
import { pinoHttp } from "pino-http";
import { randomUUID } from "node:crypto";
import { env } from "./config/env.ts";
import { logger } from "./lib/logger.ts";
import { prisma } from "./lib/prisma.ts";
import { apiLimiter } from "./middleware/rate-limit.ts";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.ts";
import { authRouter } from "./modules/auth/routes.ts";
import { usersRouter } from "./modules/users/routes.ts";
import { salonsRouter } from "./modules/salons/routes.ts";
import { appointmentsRouter } from "./modules/appointments/routes.ts";
import { productsRouter } from "./modules/products/routes.ts";
import { cartRouter } from "./modules/cart/routes.ts";
import { favoritesRouter } from "./modules/favorites/routes.ts";
import { ordersRouter } from "./modules/orders/routes.ts";
import { walletRouter } from "./modules/wallet/routes.ts";
import { paymentsRouter } from "./modules/payments/routes.ts";
import { notificationsRouter } from "./modules/notifications/routes.ts";
import { supportRouter } from "./modules/support/routes.ts";
import { mapsRouter } from "./modules/maps/routes.ts";

export const corsOrigins = env.CORS_ORIGINS.split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  if (env.TRUST_PROXY_HOPS > 0) app.set("trust proxy", env.TRUST_PROXY_HOPS);

  app.use(helmet());
  // Mobil uygulama CORS'a tabi değildir; yalnızca açıkça izin verilen web kökenleri kabul edilir.
  app.use(cors({ origin: corsOrigins.length ? corsOrigins : false }));
  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const id = (req.headers["x-request-id"] as string | undefined) ?? randomUUID();
        res.setHeader("x-request-id", id);
        return id;
      },
      customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info"),
      autoLogging: { ignore: (req) => req.url === "/api/health" },
    }),
  );
  app.use(express.json({ limit: "100kb" }));

  const api = Router();
  api.use(apiLimiter);

  // Sağlık kontrolü (load balancer / izleme için): veritabanı erişilebilir mi?
  api.get("/health", async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: "ok", time: new Date().toISOString() });
    } catch {
      res.status(503).json({ status: "degraded" });
    }
  });

  api.use("/auth", authRouter);
  api.use("/users", usersRouter);
  api.use("/salons", salonsRouter);
  api.use("/appointments", appointmentsRouter);
  api.use("/products", productsRouter);
  api.use("/cart", cartRouter);
  api.use("/favorites", favoritesRouter);
  api.use("/orders", ordersRouter);
  api.use("/wallet", walletRouter);
  api.use("/payments", paymentsRouter);
  api.use("/notifications", notificationsRouter);
  api.use("/support", supportRouter);
  api.use("/maps", mapsRouter);

  app.use("/api", api);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
