import { pino } from "pino";
import { env, isProd, isTest } from "../config/env.ts";

export const logger = pino({
  level: isTest ? "silent" : env.LOG_LEVEL,
  // Kişisel veri ve gizli bilgiler loglara yazılmaz (KVKK).
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "*.password",
      "*.currentPassword",
      "*.newPassword",
      "*.refreshToken",
      "*.accessToken",
      "*.code",
    ],
    censor: "[gizli]",
  },
  ...(isProd || isTest
    ? {}
    : { transport: { target: "pino-pretty", options: { translateTime: "SYS:HH:MM:ss" } } }),
});
