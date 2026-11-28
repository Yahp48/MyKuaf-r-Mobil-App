import { z } from "zod";

// Ortam değişkenleri uygulama açılırken bir kez doğrulanır; eksik/yanlış değer varsa sunucu başlamaz.
const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(5000),
    DATABASE_URL: z.string().min(1),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),

    JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET en az 32 karakter olmalı"),
    JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET en az 32 karakter olmalı"),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(15 * 60),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),

    // Virgülle ayrılmış izinli kökenler (yalnızca web istemcileri için; mobil uygulama CORS kullanmaz)
    CORS_ORIGINS: z.string().default(""),
    // Ters vekil (nginx, load balancer) arkasında gerçek IP için: kaç vekil var
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
    PUBLIC_BASE_URL: z.string().url().default("http://localhost:5000"),

    PAYMENT_PROVIDER: z.enum(["mock", "iyzico"]).default("mock"),
    // Ödeme sayfası bitince kullanıcıyı uygulamaya döndüren derin bağlantı şeması (app.config.js → scheme)
    APP_DEEP_LINK_SCHEME: z
      .string()
      .regex(/^[a-z][a-z0-9+.-]*$/)
      .default("mykuafor"),

    GOOGLE_MAPS_SERVER_API_KEY: z.string().default(""),

    // Yapay zekâ saç modeli denemesi (fotoğraftan). Anahtar yoksa özellik uygulamada görünmez.
    TRYON_AI_PROVIDER: z.enum(["none", "ailabtools"]).default("none"),
    AILABTOOLS_API_KEY: z.string().default(""),
    // Kullanıcı başına günlük istek sınırı (her istek ücretlidir)
    TRYON_AI_DAILY_LIMIT: z.coerce.number().int().min(0).max(100).default(5),

    SMTP_HOST: z.string().default(""),
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_USER: z.string().default(""),
    SMTP_PASS: z.string().default(""),
    MAIL_FROM: z.string().default("MyKuaför <no-reply@mykuafor.app>"),

    // Platformu işleten şirket (faturayı kesen taraf): uygulamada "Hakkında", KVKK ve panel yasal sayfalarında gösterilir
    COMPANY_LEGAL_NAME: z.string().trim().default(""),
    // Kısa ad (telif satırı, alt bilgi); boşsa tam unvan kullanılır
    COMPANY_SHORT_NAME: z.string().trim().default(""),
    COMPANY_ADDRESS: z.string().trim().default(""),
    COMPANY_TAX_OFFICE: z.string().trim().default(""),
    COMPANY_TAX_NUMBER: z.string().trim().regex(/^(\d{10,11})?$/, "Vergi no 10 (VKN) veya 11 (TCKN) hane").default(""),
    COMPANY_MERSIS: z.string().trim().regex(/^(\d{16})?$/, "MERSİS no 16 hane").default(""),
    COMPANY_KEP: z.string().trim().default(""),
    COMPANY_EMAIL: z.string().trim().default(""),
    COMPANY_PHONE: z.string().trim().default(""),

    SHIPPING_FEE_CENTS: z.coerce.number().int().min(0).default(2999),
    FREE_SHIPPING_THRESHOLD_CENTS: z.coerce.number().int().min(0).default(50000),
    WALLET_MIN_TOPUP_CENTS: z.coerce.number().int().positive().default(5000),
    WALLET_MAX_TOPUP_CENTS: z.coerce.number().int().positive().default(500000),
  })
  .superRefine((v, ctx) => {
    if (v.NODE_ENV === "production") {
      if (v.PAYMENT_PROVIDER === "mock") {
        ctx.addIssue({
          code: "custom",
          path: ["PAYMENT_PROVIDER"],
          message: "Production ortamında sahte (mock) ödeme sağlayıcısı kullanılamaz",
        });
      }
      if (!v.SMTP_HOST) {
        ctx.addIssue({
          code: "custom",
          path: ["SMTP_HOST"],
          message: "Production ortamında şifre sıfırlama e-postaları için SMTP gerekli",
        });
      }
      for (const key of ["COMPANY_LEGAL_NAME", "COMPANY_ADDRESS", "COMPANY_TAX_NUMBER", "COMPANY_EMAIL"] as const) {
        if (!v[key]) {
          ctx.addIssue({
            code: "custom",
            path: [key],
            message: "Production ortamında platformu işleten şirketin bilgileri zorunlu (6563 sayılı Kanun, KVKK)",
          });
        }
      }
      if (v.JWT_ACCESS_SECRET === v.JWT_REFRESH_SECRET) {
        ctx.addIssue({
          code: "custom",
          path: ["JWT_REFRESH_SECRET"],
          message: "Erişim ve yenileme anahtarları farklı olmalı",
        });
      }
    }
  });

export type Env = z.infer<typeof schema>;

function load(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`);
    // Logger henüz hazır değil; doğrudan stderr'e yaz.
    console.error(`Geçersiz ortam değişkenleri:\n${lines.join("\n")}`);
    process.exit(1);
  }
  return parsed.data;
}

export const env = load();
export const isProd = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";
