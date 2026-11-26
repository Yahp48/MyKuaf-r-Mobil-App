import type { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/errors.ts";
import { logger } from "../lib/logger.ts";

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: { code: "NOT_FOUND", message: `Bulunamadı: ${req.method} ${req.path}` } });
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
    });
    return;
  }

  // express.json() bozuk gövde hatası
  const e = err as { type?: string; status?: number };
  if (e?.type === "entity.parse.failed") {
    res.status(400).json({ error: { code: "INVALID_JSON", message: "İstek gövdesi geçerli JSON değil" } });
    return;
  }
  if (e?.type === "entity.too.large") {
    res.status(413).json({ error: { code: "PAYLOAD_TOO_LARGE", message: "İstek gövdesi çok büyük" } });
    return;
  }

  const m = err as { name?: string; code?: string };
  if (m?.name === "MulterError") {
    const tooLarge = m.code === "LIMIT_FILE_SIZE";
    res.status(tooLarge ? 413 : 400).json({
      error: { code: "UPLOAD_ERROR", message: tooLarge ? "Dosya en fazla 5 MB olabilir" : "Dosya yüklenemedi" },
    });
    return;
  }

  logger.error({ err, method: req.method, path: req.path }, "Beklenmeyen hata");
  res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Beklenmeyen bir hata oluştu, lütfen daha sonra tekrar deneyin" },
  });
}
