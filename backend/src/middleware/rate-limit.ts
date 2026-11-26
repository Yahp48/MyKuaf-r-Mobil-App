import { rateLimit } from "express-rate-limit";
import { isTest } from "../config/env.ts";

const message = (text: string) => ({ error: { code: "RATE_LIMITED", message: text } });

// Genel API sınırı (IP başına)
export const apiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skip: () => isTest,
  message: message("Çok fazla istek gönderdiniz, lütfen biraz bekleyin"),
});

// Giriş / kayıt / şifre sıfırlama: kaba kuvvet saldırılarına karşı sıkı sınır
export const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skip: () => isTest,
  message: message("Çok fazla deneme yaptınız, lütfen 15 dakika sonra tekrar deneyin"),
});
