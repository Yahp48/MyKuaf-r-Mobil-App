import nodemailer, { type Transporter } from "nodemailer";
import { env, isTest } from "../config/env.ts";
import { logger } from "./logger.ts";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

let transporter: Transporter | undefined;

function getTransporter(): Transporter | undefined {
  if (!env.SMTP_HOST) return undefined;
  transporter ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
  return transporter;
}

/** Testlerde gönderilen e-postalar burada birikir. */
export const sentMails: MailMessage[] = [];

export async function sendMail(msg: MailMessage): Promise<void> {
  if (isTest) {
    sentMails.push(msg);
    return;
  }
  const t = getTransporter();
  if (!t) {
    // Geliştirme ortamı: SMTP yoksa içerik loga yazılır (production'da env doğrulaması SMTP'yi zorunlu kılar).
    logger.warn({ to: msg.to, subject: msg.subject, text: msg.text }, "SMTP ayarlı değil, e-posta loga yazıldı");
    return;
  }
  await t.sendMail({ from: env.MAIL_FROM, ...msg });
}
