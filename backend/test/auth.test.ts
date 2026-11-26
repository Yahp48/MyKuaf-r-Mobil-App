import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { api, registerUser, resetDb } from "./helpers.ts";
import { prisma } from "../src/lib/prisma.ts";
import { sentMails } from "../src/lib/mailer.ts";

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe("kayıt ve giriş", () => {
  it("kayıt olur, e-postayı küçük harfe çevirir ve token döner", async () => {
    const res = await api()
      .post("/api/auth/register")
      .send({ name: "Ayşe Yılmaz", email: "  Ayse@Example.COM ", password: "Sifre12345", acceptTerms: true });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe("ayse@example.com");
    expect(res.body.user).not.toHaveProperty("passwordHash");
    expect(res.body.accessToken).toBeTypeOf("string");
    expect(res.body.refreshToken).toBeTypeOf("string");
  });

  it("KVKK/koşullar onayı olmadan kayıt olmaz", async () => {
    const res = await api()
      .post("/api/auth/register")
      .send({ name: "Ayşe", email: "a@example.com", password: "Sifre12345" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("zayıf şifreyi reddeder", async () => {
    const res = await api()
      .post("/api/auth/register")
      .send({ name: "Ayşe", email: "a@example.com", password: "12345678", acceptTerms: true });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/harf/);
  });

  it("aynı e-postayla ikinci kaydı reddeder", async () => {
    const u = await registerUser();
    const res = await api()
      .post("/api/auth/register")
      .send({ name: "Başka", email: u.user.email.toUpperCase(), password: "Sifre12345", acceptTerms: true });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EMAIL_TAKEN");
  });

  it("yanlış şifrede ve olmayan hesapta aynı hatayı verir", async () => {
    const u = await registerUser();
    const wrong = await api().post("/api/auth/login").send({ email: u.user.email, password: "Yanlis12345" });
    const missing = await api().post("/api/auth/login").send({ email: "yok@example.com", password: "Yanlis12345" });
    expect(wrong.status).toBe(401);
    expect(missing.status).toBe(401);
    expect(wrong.body.error).toEqual(missing.body.error);
  });

  it("korumalı uçlar token olmadan 401 döner", async () => {
    const res = await api().get("/api/users/me");
    expect(res.status).toBe(401);
  });
});

describe("yenileme token'ı", () => {
  it("döndürür ve eski token yeniden kullanılınca tüm oturum ailesini iptal eder", async () => {
    const u = await registerUser();
    const first = await api().post("/api/auth/refresh").send({ refreshToken: u.refreshToken });
    expect(first.status).toBe(200);
    expect(first.body.refreshToken).not.toBe(u.refreshToken);

    // Çalınmış eski token tekrar kullanılıyor
    const reuse = await api().post("/api/auth/refresh").send({ refreshToken: u.refreshToken });
    expect(reuse.status).toBe(401);

    // Meşru kullanıcının yeni token'ı da artık geçersiz
    const after = await api().post("/api/auth/refresh").send({ refreshToken: first.body.refreshToken });
    expect(after.status).toBe(401);
  });

  it("çıkış yapınca token geçersiz olur", async () => {
    const u = await registerUser();
    expect((await api().post("/api/auth/logout").send({ refreshToken: u.refreshToken })).status).toBe(204);
    expect((await api().post("/api/auth/refresh").send({ refreshToken: u.refreshToken })).status).toBe(401);
  });
});

describe("şifre sıfırlama", () => {
  it("e-postayla gelen kodla şifreyi sıfırlar ve eski oturumları kapatır", async () => {
    const u = await registerUser();
    sentMails.length = 0;

    const forgot = await api().post("/api/auth/forgot-password").send({ email: u.user.email });
    expect(forgot.status).toBe(200);
    const code = sentMails.at(-1)?.text.match(/\b(\d{6})\b/)?.[1];
    expect(code).toBeDefined();

    const bad = await api()
      .post("/api/auth/reset-password")
      .send({ email: u.user.email, code: code === "000000" ? "111111" : "000000", newPassword: "YeniSifre123" });
    expect(bad.status).toBe(400);

    const ok = await api()
      .post("/api/auth/reset-password")
      .send({ email: u.user.email, code, newPassword: "YeniSifre123" });
    expect(ok.status).toBe(200);

    expect((await api().post("/api/auth/login").send({ email: u.user.email, password: "YeniSifre123" })).status).toBe(200);
    expect((await api().post("/api/auth/refresh").send({ refreshToken: u.refreshToken })).status).toBe(401);
    // Kod tek kullanımlık
    const again = await api()
      .post("/api/auth/reset-password")
      .send({ email: u.user.email, code, newPassword: "BaskaSifre123" });
    expect(again.status).toBe(400);
  });

  it("kayıtlı olmayan e-posta için de aynı yanıtı verir (hesap varlığı sızmaz)", async () => {
    sentMails.length = 0;
    const res = await api().post("/api/auth/forgot-password").send({ email: "kimse@example.com" });
    expect(res.status).toBe(200);
    expect(sentMails).toHaveLength(0);
  });
});

describe("hesap silme", () => {
  it("şifreyle hesabı siler, kişisel veriyi anonimleştirir ve girişi engeller", async () => {
    const u = await registerUser();
    const wrong = await api().delete("/api/users/me").set(u.auth).send({ password: "Yanlis12345" });
    expect(wrong.status).toBe(400);

    const res = await api().delete("/api/users/me").set(u.auth).send({ password: u.password });
    expect(res.status).toBe(204);

    const row = await prisma.user.findUniqueOrThrow({ where: { id: u.user.id } });
    expect(row.email).not.toBe(u.user.email);
    expect(row.phone).toBeNull();
    expect(row.passwordHash).toBeNull();
    expect(row.deletedAt).not.toBeNull();

    expect((await api().post("/api/auth/login").send({ email: u.user.email, password: u.password })).status).toBe(401);
    expect((await api().post("/api/auth/refresh").send({ refreshToken: u.refreshToken })).status).toBe(401);
    // Aynı e-postayla yeniden kayıt olunabilir
    const again = await api()
      .post("/api/auth/register")
      .send({ name: "Yeni", email: u.user.email, password: "Sifre12345", acceptTerms: true });
    expect(again.status).toBe(201);
  });
});
