import { Router } from "express";
import { z } from "zod";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { prisma } from "../../lib/prisma.ts";
import { parse, zId } from "../../lib/validate.ts";
import { AppError, notFound } from "../../lib/errors.ts";
import { logger } from "../../lib/logger.ts";
import { env, isTest } from "../../config/env.ts";
import { requireAuth } from "../../middleware/auth.ts";

/**
 * Google Directions vekili. API anahtarı sunucuda kalır; uygulama paketine gömülmez,
 * böylece anahtar çalınıp kotası kötüye kullanılamaz.
 */
export const mapsRouter = Router();

const directionsLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  skip: () => isTest,
  keyGenerator: (req) => req.user?.id ?? ipKeyGenerator(req.ip ?? "0.0.0.0"),
  message: { error: { code: "RATE_LIMITED", message: "Çok fazla yol tarifi isteği, lütfen biraz bekleyin" } },
});

const schema = z.object({
  originLat: z.coerce.number().min(-90).max(90),
  originLng: z.coerce.number().min(-180).max(180),
  salonId: zId,
  mode: z.enum(["driving", "walking", "transit"]).default("driving"),
});

mapsRouter.get("/directions", requireAuth, directionsLimiter, async (req, res) => {
  const q = parse(schema, req.query);
  if (!env.GOOGLE_MAPS_SERVER_API_KEY) {
    throw new AppError(503, "DIRECTIONS_UNAVAILABLE", "Yol tarifi hizmeti şu anda kullanılamıyor");
  }
  const salon = await prisma.salon.findFirst({ where: { id: q.salonId, isActive: true } });
  if (!salon) throw notFound("Salon bulunamadı");

  const url = new URL("https://maps.googleapis.com/maps/api/directions/json");
  url.searchParams.set("origin", `${q.originLat},${q.originLng}`);
  url.searchParams.set("destination", `${salon.latitude},${salon.longitude}`);
  url.searchParams.set("mode", q.mode);
  url.searchParams.set("language", "tr");
  url.searchParams.set("region", "tr");
  url.searchParams.set("key", env.GOOGLE_MAPS_SERVER_API_KEY);

  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  const data = (await response.json()) as {
    status: string;
    routes?: {
      overview_polyline: { points: string };
      legs: { distance: { text: string; value: number }; duration: { text: string; value: number } }[];
    }[];
  };

  if (data.status === "ZERO_RESULTS" || !data.routes?.length) {
    throw new AppError(404, "NO_ROUTE", "Bu konum için rota bulunamadı");
  }
  if (data.status !== "OK") {
    logger.error({ status: data.status }, "Google Directions hatası");
    throw new AppError(502, "DIRECTIONS_FAILED", "Yol tarifi alınamadı, lütfen daha sonra tekrar deneyin");
  }

  const route = data.routes[0]!;
  const leg = route.legs[0]!;
  res.json({
    polyline: route.overview_polyline.points,
    distance: { meters: leg.distance.value, text: leg.distance.text },
    duration: { seconds: leg.duration.value, text: leg.duration.text },
  });
});
