import { Router } from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import { DateTime } from "luxon";
import { z } from "zod";
import { env } from "../../config/env.ts";
import { prisma } from "../../lib/prisma.ts";
import { parse } from "../../lib/validate.ts";
import { AppError } from "../../lib/errors.ts";
import { logger } from "../../lib/logger.ts";
import { imageUpload, requireImage } from "../../lib/uploads.ts";
import { requireAuth, userId } from "../../middleware/auth.ts";

/**
 * Yapay zekâ ile gerçekçi saç modeli denemesi (fotoğraftan).
 * Sağlayıcı: AILabTools "Hairstyle Changer Pro" (asenkron: görev oluştur → sonucu sorgula).
 * Fotoğraf sunucumuzda saklanmaz; sağlayıcı da saklamadığını, sonuçları 24 saat sonra sildiğini belirtir.
 * Anahtar yoksa /config "enabled: false" döner ve uygulama özelliği göstermez.
 */
export const tryonRouter = Router();
tryonRouter.use(requireAuth);

const API = "https://www.ailabapi.com/api";
const enabled = () => env.TRYON_AI_PROVIDER === "ailabtools" && !!env.AILABTOOLS_API_KEY;

/** Kadın saç modelleri (sağlayıcının değerleri birebir) ve Türkçe adları. */
export const AI_STYLES = [
  ["LongStraight", "Uzun düz"],
  ["LongWavy", "Uzun dalgalı"],
  ["LongCurly", "Uzun kıvırcık"],
  ["LongWavyCurtainBangs", "Perdeli kâküllü uzun"],
  ["MediumLongLayered", "Orta boy katlı"],
  ["ShoulderLengthHair", "Omuz hizası"],
  ["Layered_Waves", "Katlı dalgalar"],
  ["BobCut", "Bob"],
  ["ShortNeatBob", "Kısa düz bob"],
  ["ClassicWavyBob", "Dalgalı bob"],
  ["CurlyBob", "Kıvırcık bob"],
  ["PixieCut", "Pixie"],
  ["Fluffy_Pixie_Cut", "Kabarık pixie"],
  ["ChoppyBangs", "Kesik kâkül"],
  ["FrenchBangs", "Fransız kâkülü"],
  ["LongHimeCut", "Hime kesim"],
  ["Updo", "Topuz"],
  ["Chignon", "Şinyon"],
  ["Ponytail", "At kuyruğu"],
  ["FishtailBraid", "Balık sırtı örgü"],
] as const;

export const AI_COLORS = [
  ["brown", "Kahve"],
  ["lightBrown", "Açık kahve"],
  ["black", "Siyah"],
  ["blonde", "Sarı"],
  ["platinumBlonde", "Platin"],
  ["red", "Kızıl"],
  ["burgundy", "Bordo"],
  ["pink", "Pembe"],
  ["silver", "Gümüş"],
] as const;

const STYLE_KEYS = AI_STYLES.map(([k]) => k) as [string, ...string[]];
const COLOR_KEYS = AI_COLORS.map(([k]) => k) as [string, ...string[]];

async function usedToday(uid: string) {
  const start = DateTime.now().setZone("Europe/Istanbul").startOf("day").toJSDate();
  return prisma.aiTryonRequest.count({ where: { userId: uid, createdAt: { gte: start } } });
}

/** Görev anahtarı: sağlayıcı görev kimliği + kullanıcıya bağlı imza (başkasının sonucunu sorgulamayı engeller). */
const sign = (uid: string, taskId: string) =>
  createHmac("sha256", env.JWT_ACCESS_SECRET).update(`tryon:${uid}:${taskId}`).digest("base64url").slice(0, 32);
const tokenFor = (uid: string, taskId: string) => `${taskId}.${sign(uid, taskId)}`;
function taskFromToken(uid: string, token: string) {
  const [taskId, sig] = token.split(".");
  if (!taskId || !sig) return null;
  const expected = sign(uid, taskId);
  return sig.length === expected.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expected)) ? taskId : null;
}

tryonRouter.get("/ai/config", async (req, res) => {
  if (!enabled()) return void res.json({ enabled: false });
  const used = await usedToday(userId(req));
  res.json({
    enabled: true,
    provider: "AILabTools",
    dailyLimit: env.TRYON_AI_DAILY_LIMIT,
    remaining: Math.max(0, env.TRYON_AI_DAILY_LIMIT - used),
    styles: AI_STYLES.map(([key, label]) => ({ key, label })),
    colors: AI_COLORS.map(([key, label]) => ({ key, label })),
  });
});

const createSchema = z.object({
  hairStyle: z.enum(STYLE_KEYS),
  color: z.enum(COLOR_KEYS),
  // KVKK: fotoğrafın yurt dışındaki sağlayıcıya aktarımı için açık rıza
  consent: z.literal("true", { message: "Fotoğrafınızın işlenmesi için onay vermelisiniz" }),
});

tryonRouter.post("/ai", imageUpload.single("image"), async (req, res) => {
  if (!enabled()) throw new AppError(503, "TRYON_AI_DISABLED", "Bu özellik şu anda kullanılamıyor");
  const uid = userId(req);
  const body = parse(createSchema, req.body);
  const { buf, ext } = requireImage(req.file);
  if (ext === "webp") throw new AppError(400, "INVALID_IMAGE", "Yalnızca JPG veya PNG fotoğraf kullanılabilir");
  if ((await usedToday(uid)) >= env.TRYON_AI_DAILY_LIMIT) {
    throw new AppError(
      429,
      "TRYON_DAILY_LIMIT",
      `Günlük ${env.TRYON_AI_DAILY_LIMIT} deneme hakkınızı kullandınız. Yarın tekrar deneyin.`,
    );
  }

  const form = new FormData();
  form.append("image", new Blob([new Uint8Array(buf)], { type: ext === "png" ? "image/png" : "image/jpeg" }), `photo.${ext}`);
  form.append("hair_style", body.hairStyle);
  form.append("color", body.color);
  let data: { task_id?: string; error_detail?: { code?: string | number; message?: string } };
  try {
    const r = await fetch(`${API}/portrait/effects/hairstyle-editor-pro`, {
      method: "POST",
      headers: { "ailabapi-api-key": env.AILABTOOLS_API_KEY },
      body: form,
      signal: AbortSignal.timeout(30_000),
    });
    data = (await r.json()) as typeof data;
  } catch (err) {
    logger.error({ err }, "yapay zekâ deneme isteği başarısız");
    throw new AppError(502, "TRYON_AI_UNAVAILABLE", "Deneme hizmetine ulaşılamadı, lütfen tekrar deneyin");
  }
  if (!data.task_id) {
    logger.warn({ error: data.error_detail }, "yapay zekâ deneme reddedildi");
    throw new AppError(
      400,
      "TRYON_AI_REJECTED",
      "Fotoğraf işlenemedi. Yüzünüzün önden, net ve tek kişi olarak göründüğü bir fotoğraf deneyin.",
    );
  }
  await prisma.aiTryonRequest.create({
    data: { userId: uid, hairStyle: body.hairStyle, color: body.color, providerTaskId: data.task_id },
  });
  res.status(202).json({ token: tokenFor(uid, data.task_id), pollAfterMs: 5000 });
});

tryonRouter.get("/ai/:token", async (req, res) => {
  if (!enabled()) throw new AppError(503, "TRYON_AI_DISABLED", "Bu özellik şu anda kullanılamıyor");
  const taskId = taskFromToken(userId(req), parse(z.string().max(200), req.params.token));
  if (!taskId) throw new AppError(404, "NOT_FOUND", "Deneme bulunamadı");
  let data: { task_status?: number; data?: { images?: string[] }; error_detail?: { code?: string | number } };
  try {
    const r = await fetch(`${API}/common/query-async-task-result?task_id=${encodeURIComponent(taskId)}`, {
      headers: { "ailabapi-api-key": env.AILABTOOLS_API_KEY },
      signal: AbortSignal.timeout(15_000),
    });
    data = (await r.json()) as typeof data;
  } catch {
    return void res.json({ status: "processing" });
  }
  if (data.task_status === 2) {
    const images = (data.data?.images ?? []).filter((u) => typeof u === "string" && u.startsWith("https://"));
    if (!images.length) return void res.json({ status: "failed" });
    return void res.json({ status: "done", images });
  }
  if (data.error_detail?.code && String(data.error_detail.code) !== "0") return void res.json({ status: "failed" });
  res.json({ status: "processing" });
});
