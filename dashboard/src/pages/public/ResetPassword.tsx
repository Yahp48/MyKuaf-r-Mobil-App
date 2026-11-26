import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { usePageMeta } from "../../lib/seo";
import { api, ApiError } from "../../lib/api";
import { isStrongPassword } from "../../lib/validators";
import { Button, Input } from "../../components/ui";
import { PublicLayout } from "./PublicLayout";

export default function ResetPassword() {
  usePageMeta({ title: "Şifre sıfırlama", path: "/sifre-sifirla" });
  const [step, setStep] = useState<"email" | "code" | "done">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);

  const sendCode = async (e?: FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    try {
      const r = await api.post<{ message: string }>("/auth/forgot-password", { email: email.trim() });
      setMsg({ tone: "ok", text: r.message });
      setStep("code");
    } catch (err) {
      setMsg({ tone: "bad", text: err instanceof ApiError ? err.message : "Gönderilemedi" });
    } finally {
      setBusy(false);
    }
  };

  const reset = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api.post<{ message: string }>("/auth/reset-password", {
        email: email.trim(),
        code,
        newPassword: password,
      });
      setMsg({ tone: "ok", text: r.message });
      setStep("done");
    } catch (err) {
      setMsg({ tone: "bad", text: err instanceof ApiError ? err.message : "Sıfırlanamadı" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <PublicLayout hideNav>
      <div className="auth-form" style={{ flex: 1 }}>
        <div>
          <h1 style={{ fontSize: 32, marginBottom: 10 }}>Şifre sıfırlama</h1>
          <p className="muted" style={{ marginBottom: 22 }}>
            Hesabınıza kayıtlı e-postaya 6 haneli bir kod göndereceğiz. Kod 15 dakika geçerlidir.
          </p>
          {msg ? (
            <div className="alert" data-tone={msg.tone} role="status" style={{ marginBottom: 16 }}>
              {msg.text}
            </div>
          ) : null}
          {step === "email" && (
            <form onSubmit={sendCode} noValidate>
              <Input
                label="E-posta"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
              />
              <Button type="submit" variant="primary" block loading={busy} disabled={!email}>
                Kod gönder
              </Button>
            </form>
          )}
          {step === "code" && (
            <form onSubmit={reset} noValidate>
              <Input
                label="Doğrulama kodu"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="input mono"
              />
              <Input
                label="Yeni şifre"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                hint="En az 8 karakter, harf ve rakam"
              />
              <Button
                type="submit"
                variant="primary"
                block
                loading={busy}
                disabled={code.length !== 6 || !isStrongPassword(password)}
              >
                Şifreyi güncelle
              </Button>
              <Button variant="quiet" block onClick={() => sendCode()} style={{ marginTop: 8 }}>
                Kodu tekrar gönder
              </Button>
            </form>
          )}
          {step === "done" && (
            <Link to="/giris" className="btn btn-primary btn-block">
              Giriş sayfasına dön
            </Link>
          )}
        </div>
      </div>
    </PublicLayout>
  );
}
