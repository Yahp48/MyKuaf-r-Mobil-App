import { config } from "dotenv";

/** Testler her zaman ayrı test veritabanını kullanır; geliştirme verisine dokunulmaz. */
export function testEnv() {
  config({ quiet: true });
  const base = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? "";
  const url = new URL(base);
  if (!process.env.TEST_DATABASE_URL) url.pathname = "/mykuafor_test";
  return {
    NODE_ENV: "test",
    DATABASE_URL: url.toString(),
    JWT_ACCESS_SECRET: "test-access-secret-0123456789-abcdefghijklmnop",
    JWT_REFRESH_SECRET: "test-refresh-secret-0123456789-abcdefghijklmno",
    PAYMENT_PROVIDER: "mock",
    PUBLIC_BASE_URL: "http://localhost:5000",
    GOOGLE_MAPS_SERVER_API_KEY: "",
    COMPANY_LEGAL_NAME: "Test Platform A.Ş.",
    COMPANY_ADDRESS: "",
    COMPANY_EMAIL: "destek@example.test",
  };
}
