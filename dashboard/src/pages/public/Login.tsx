import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { usePageMeta } from "../../lib/seo";
import { homeFor, useSession } from "../../lib/session";
import { ApiError } from "../../lib/api";
import { Button, Input } from "../../components/ui";
import { PublicLayout } from "./PublicLayout";

export default function Login() {
  usePageMeta({
    title: "İşletme girişi",
    description: "MyKuaför işletme paneline giriş yapın: randevular, personel, siparişler ve stok.",
    path: "/giris",
    index: true,
  });
  const { signIn } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const s = await signIn(email.trim(), password);
      const from = (location.state as { from?: string } | null)?.from;
      const home = homeFor(s);
      navigate(from && from.startsWith(home) ? from : home, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Giriş yapılamadı");
      setBusy(false);
    }
  };

  return (
    <PublicLayout hideNav>
      <div className="auth-wrap">
        <section className="auth-side">
          <div className="label">İşletme paneli</div>
          <h1>Günün defteri sizi bekliyor.</h1>
          <p className="muted" style={{ maxWidth: "42ch" }}>
            Kuaför hesabınızla randevu defterine, satıcı hesabınızla sipariş ve stok ekranına yönlendirilirsiniz.
          </p>
        </section>
        <section className="auth-form">
          <div>
            <h2 style={{ fontSize: 28, marginBottom: 22 }}>Giriş yap</h2>
            {error ? (
              <div className="alert" data-tone="bad" role="alert" style={{ marginBottom: 16 }}>
                {error}
              </div>
            ) : null}
            <form onSubmit={submit} noValidate>
              <Input
                label="E-posta"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
              <Input
                label="Şifre"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <div style={{ display: "flex", justifyContent: "flex-end", margin: "-6px 0 18px" }}>
                <Link to="/sifre-sifirla" className="small muted">
                  Şifremi unuttum
                </Link>
              </div>
              <Button type="submit" variant="primary" block loading={busy} disabled={!email || !password}>
                Giriş yap
              </Button>
            </form>
            <p className="muted small" style={{ marginTop: 22 }}>
              Henüz kaydınız yok mu? <Link to="/kayit">İşletmenizi kaydedin</Link>
            </p>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}
