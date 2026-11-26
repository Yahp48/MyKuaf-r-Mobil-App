import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { Crosshair, Scissors, Storefront } from "@phosphor-icons/react";
import { usePageMeta } from "../../lib/seo";
import { homeFor, useSession } from "../../lib/session";
import { ApiError, fieldErrors } from "../../lib/api";
import {
  formatIban,
  isEmail,
  isMobile,
  isPhone,
  isStrongPassword,
  isValidIban,
  isValidTaxNumber,
} from "../../lib/validators";
import { Button, Input, Textarea } from "../../components/ui";
import { MapPicker, locateMe } from "../../components/MapPicker";
import { PublicLayout } from "./PublicLayout";

type Type = "SALON" | "SELLER";
type Errors = Record<string, string>;

const initial = {
  type: "SALON" as Type,
  ownerName: "",
  ownerEmail: "",
  ownerPhone: "",
  password: "",
  displayName: "",
  legalName: "",
  taxNumber: "",
  taxOffice: "",
  mersisNo: "",
  kepAddress: "",
  address: "",
  city: "",
  district: "",
  postalCode: "",
  phone: "",
  email: "",
  iban: "",
  salonName: "",
  description: "",
  latitude: 39.1458,
  longitude: 34.1606,
};

export default function Register() {
  usePageMeta({
    title: "İşletme kaydı",
    description:
      "Kuaför salonunuzu veya kozmetik mağazanızı MyKuaför'e ücretsiz kaydedin. Vergi bilgilerinizle birkaç dakikada başvurun, müşterileriniz sizi uygulamada bulsun.",
    path: "/kayit",
    index: true,
  });
  const { register } = useSession();
  const navigate = useNavigate();
  const [f, setF] = useState(initial);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Errors>({});
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const steps = f.type === "SALON" ? ["Hesap", "Vergi ve adres", "Salon", "Onay"] : ["Hesap", "Vergi ve adres", "Onay"];
  const last = steps.length - 1;
  const set = (k: keyof typeof initial) => (e: { target: { value: string } }) =>
    setF((s) => ({ ...s, [k]: e.target.value }));

  function validate(i: number): Errors {
    const e: Errors = {};
    if (i === 0) {
      if (f.ownerName.trim().length < 2) e.ownerName = "Adınızı ve soyadınızı girin";
      if (!isEmail(f.ownerEmail)) e.ownerEmail = "Geçerli bir e-posta girin";
      if (!isMobile(f.ownerPhone)) e.ownerPhone = "Cep telefonu 05XX XXX XX XX biçiminde olmalı";
      if (!isStrongPassword(f.password)) e.password = "En az 8 karakter, en az bir harf ve bir rakam";
    }
    if (i === 1) {
      if (f.type === "SELLER" && f.displayName.trim().length < 2) e.displayName = "Mağaza adı gerekli";
      if (f.legalName.trim().length < 3) e.legalName = "Ticari unvanı vergi levhasındaki gibi yazın";
      if (!/^\d{10,11}$/.test(f.taxNumber)) e.taxNumber = "10 haneli VKN veya 11 haneli TC kimlik no";
      else if (!isValidTaxNumber(f.taxNumber)) e.taxNumber = "Numara doğrulanamadı, lütfen kontrol edin";
      if (f.taxOffice.trim().length < 2) e.taxOffice = "Vergi dairesi gerekli";
      if (f.mersisNo && !/^\d{16}$/.test(f.mersisNo)) e.mersisNo = "MERSİS no 16 hanedir";
      if (f.address.trim().length < 10) e.address = "Açık adres en az 10 karakter";
      if (f.city.trim().length < 2) e.city = "İl gerekli";
      if (f.district.trim().length < 2) e.district = "İlçe gerekli";
      if (f.postalCode && !/^\d{5}$/.test(f.postalCode)) e.postalCode = "Posta kodu 5 hanedir";
      if (!isPhone(f.phone)) e.phone = "İşletme telefonu 0XXX XXX XX XX";
      if (!isEmail(f.email)) e.email = "Geçerli bir e-posta girin";
      if (f.iban && !isValidIban(f.iban)) e.iban = "IBAN doğrulanamadı (TR ile başlayan 26 karakter)";
    }
    if (i === 2 && f.type === "SALON") {
      if (f.salonName.trim().length < 2) e.salonName = "Salon adı gerekli";
    }
    return e;
  }

  const next = (e?: FormEvent) => {
    e?.preventDefault();
    const errs = validate(step);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setStep((s) => Math.min(last, s + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!accepted) return setServerError("Devam etmek için sözleşmeyi ve aydınlatma metnini onaylayın.");
    setBusy(true);
    setServerError(null);
    const opt = (v: string) => (v.trim() ? v.trim() : undefined);
    try {
      const s = await register({
        owner: { name: f.ownerName.trim(), email: f.ownerEmail.trim(), password: f.password, phone: f.ownerPhone },
        business: {
          type: f.type,
          displayName: f.type === "SALON" ? f.salonName.trim() : f.displayName.trim(),
          legalName: f.legalName.trim(),
          taxNumber: f.taxNumber,
          taxOffice: f.taxOffice.trim(),
          mersisNo: opt(f.mersisNo),
          kepAddress: opt(f.kepAddress),
          address: f.address.trim(),
          city: f.city.trim(),
          district: f.district.trim(),
          postalCode: opt(f.postalCode),
          phone: f.phone,
          email: f.email.trim(),
          iban: opt(f.iban),
        },
        ...(f.type === "SALON"
          ? {
              salon: {
                name: f.salonName.trim(),
                description: opt(f.description),
                latitude: f.latitude,
                longitude: f.longitude,
              },
            }
          : {}),
        acceptTerms: true,
      });
      navigate(homeFor(s), { replace: true, state: { welcome: true } });
    } catch (err) {
      setBusy(false);
      const fe = fieldErrors(err);
      if (Object.keys(fe).length) {
        const map: Errors = {};
        for (const [k, v] of Object.entries(fe)) map[k.split(".").pop()!] = v;
        setErrors(map);
      }
      setServerError(err instanceof ApiError ? err.message : "Kayıt tamamlanamadı");
    }
  };

  return (
    <PublicLayout hideNav>
      <div className="auth-wrap" style={{ gridTemplateColumns: "minmax(0, 0.8fr) minmax(0, 1.2fr)" }}>
        <section className="auth-side">
          <div className="label">Ücretsiz işletme kaydı</div>
          <h1>Defterinizi açalım.</h1>
          <p className="muted" style={{ maxWidth: "40ch" }}>
            Vergi levhanızdaki bilgilerle birkaç dakikada kaydolun. Kuaförseniz salonunuz, personel ve hizmet
            eklediğiniz anda uygulamanın haritasında görünür.
          </p>
          <ol className="muted small" style={{ paddingLeft: 18, display: "grid", gap: 4 }}>
            {steps.map((s, i) => (
              <li key={s} style={{ color: i === step ? "var(--ink)" : undefined, fontWeight: i === step ? 600 : 400 }}>
                {s}
              </li>
            ))}
          </ol>
        </section>

        <section className="auth-form" style={{ alignItems: "flex-start" }}>
          <div style={{ width: "min(560px, 100%)" }}>
            <div className="steps" aria-hidden>
              {steps.map((s, i) => (
                <span key={s} data-on={i <= step} />
              ))}
            </div>
            <p className="label" style={{ marginBottom: 6 }}>
              Adım {step + 1} / {steps.length}
            </p>
            <h2 style={{ fontSize: 28, marginBottom: 20 }}>{steps[step]}</h2>

            {serverError ? (
              <div className="alert" data-tone="bad" role="alert" style={{ marginBottom: 16 }}>
                {serverError}
              </div>
            ) : null}

            <form onSubmit={step === last ? submit : next} noValidate>
              {step === 0 && (
                <>
                  <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                    <legend className="field" style={{ fontSize: 13.5, fontWeight: 500, marginBottom: 6 }}>
                      İşletme türü
                    </legend>
                    <div className="type-choice">
                      <label>
                        <input
                          type="radio"
                          name="type"
                          checked={f.type === "SALON"}
                          onChange={() => setF((s) => ({ ...s, type: "SALON" }))}
                        />
                        <Scissors size={22} />
                        <b>Kuaför salonu</b>
                        <span className="small muted">Randevu, personel, gelir-gider</span>
                      </label>
                      <label>
                        <input
                          type="radio"
                          name="type"
                          checked={f.type === "SELLER"}
                          onChange={() => setF((s) => ({ ...s, type: "SELLER" }))}
                        />
                        <Storefront size={22} />
                        <b>Ürün satıcısı</b>
                        <span className="small muted">Sipariş, kargo, stok</span>
                      </label>
                    </div>
                  </fieldset>
                  <Input
                    label="Yetkili adı soyadı"
                    value={f.ownerName}
                    onChange={set("ownerName")}
                    error={errors.ownerName}
                    autoComplete="name"
                  />
                  <div className="form-row">
                    <Input
                      label="Giriş e-postası"
                      type="email"
                      value={f.ownerEmail}
                      onChange={set("ownerEmail")}
                      error={errors.ownerEmail || errors.email}
                      autoComplete="email"
                    />
                    <Input
                      label="Cep telefonu"
                      type="tel"
                      value={f.ownerPhone}
                      onChange={set("ownerPhone")}
                      error={errors.ownerPhone}
                      placeholder="05XX XXX XX XX"
                      autoComplete="tel"
                    />
                  </div>
                  <Input
                    label="Şifre"
                    type="password"
                    value={f.password}
                    onChange={set("password")}
                    error={errors.password}
                    hint="En az 8 karakter, harf ve rakam içermeli"
                    autoComplete="new-password"
                  />
                </>
              )}

              {step === 1 && (
                <>
                  {f.type === "SELLER" ? (
                    <Input
                      label="Mağaza adı"
                      hint="Müşterilerin uygulamada göreceği ad"
                      value={f.displayName}
                      onChange={set("displayName")}
                      error={errors.displayName}
                    />
                  ) : null}
                  <Input
                    label="Ticari unvan"
                    hint="Vergi levhasında yazdığı şekliyle (faturalarda kullanılır)"
                    value={f.legalName}
                    onChange={set("legalName")}
                    error={errors.legalName}
                    autoComplete="organization"
                  />
                  <div className="form-row">
                    <Input
                      label="Vergi kimlik no / TC kimlik no"
                      inputMode="numeric"
                      maxLength={11}
                      value={f.taxNumber}
                      onChange={(e) => setF((s) => ({ ...s, taxNumber: e.target.value.replace(/\D/g, "") }))}
                      error={errors.taxNumber}
                      hint="Şirket: 10 hane VKN · Şahıs işletmesi: 11 hane TCKN"
                    />
                    <Input
                      label="Vergi dairesi"
                      value={f.taxOffice}
                      onChange={set("taxOffice")}
                      error={errors.taxOffice}
                    />
                  </div>
                  <div className="form-row">
                    <Input
                      label="MERSİS no (varsa)"
                      inputMode="numeric"
                      maxLength={16}
                      value={f.mersisNo}
                      onChange={(e) => setF((s) => ({ ...s, mersisNo: e.target.value.replace(/\D/g, "") }))}
                      error={errors.mersisNo}
                    />
                    <Input
                      label="KEP adresi (varsa)"
                      value={f.kepAddress}
                      onChange={set("kepAddress")}
                      error={errors.kepAddress}
                    />
                  </div>
                  <Textarea
                    label="İşletme adresi"
                    rows={2}
                    value={f.address}
                    onChange={set("address")}
                    error={errors.address}
                    autoComplete="street-address"
                  />
                  <div className="form-row">
                    <Input
                      label="İl"
                      value={f.city}
                      onChange={set("city")}
                      error={errors.city}
                      autoComplete="address-level1"
                    />
                    <Input
                      label="İlçe"
                      value={f.district}
                      onChange={set("district")}
                      error={errors.district}
                      autoComplete="address-level2"
                    />
                    <Input
                      label="Posta kodu"
                      inputMode="numeric"
                      maxLength={5}
                      value={f.postalCode}
                      onChange={set("postalCode")}
                      error={errors.postalCode}
                      autoComplete="postal-code"
                    />
                  </div>
                  <div className="form-row">
                    <Input
                      label="İşletme telefonu"
                      type="tel"
                      value={f.phone}
                      onChange={set("phone")}
                      error={errors.phone}
                      placeholder="0386 213 00 00"
                    />
                    <Input
                      label="İşletme e-postası"
                      type="email"
                      value={f.email}
                      onChange={set("email")}
                      error={errors.email}
                    />
                  </div>
                  <Input
                    label="IBAN (isteğe bağlı)"
                    hint="Satış ve iade ödemeleri için; sonradan da ekleyebilirsiniz"
                    value={f.iban}
                    onChange={(e) => setF((s) => ({ ...s, iban: formatIban(e.target.value) }))}
                    error={errors.iban}
                    maxLength={32}
                    className="input mono"
                  />
                </>
              )}

              {step === 2 && f.type === "SALON" && (
                <>
                  <Input
                    label="Salon adı"
                    hint="Uygulamada haritada görünecek ad"
                    value={f.salonName}
                    onChange={set("salonName")}
                    error={errors.salonName}
                  />
                  <Textarea
                    label="Kısa tanıtım (isteğe bağlı)"
                    rows={3}
                    maxLength={1000}
                    value={f.description}
                    onChange={set("description")}
                    placeholder="Örn. Kadın kuaförü; kesim, boya, keratin ve gelin başı."
                  />
                  <div className="field">
                    <span>Haritadaki konum</span>
                    <span className="hint">
                      Haritaya tıklayın veya işareti sürükleyin. Müşteriler yol tarifini bu noktaya alır.
                    </span>
                  </div>
                  <MapPicker
                    lat={f.latitude}
                    lng={f.longitude}
                    onChange={(latitude, longitude) => setF((s) => ({ ...s, latitude, longitude }))}
                  />
                  <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
                    <Button
                      size="sm"
                      loading={locating}
                      onClick={async () => {
                        setLocating(true);
                        try {
                          const p = await locateMe();
                          setF((s) => ({ ...s, latitude: p.lat, longitude: p.lng }));
                        } catch (err) {
                          setErrors({ location: (err as Error).message });
                        } finally {
                          setLocating(false);
                        }
                      }}
                    >
                      <Crosshair size={16} /> Bulunduğum konumu kullan
                    </Button>
                    <span className="mono small faint">
                      {f.latitude.toFixed(5)}, {f.longitude.toFixed(5)}
                    </span>
                    {errors.location ? (
                      <span className="small" style={{ color: "var(--bad)" }}>
                        {errors.location}
                      </span>
                    ) : null}
                  </div>
                </>
              )}

              {step === last && (
                <>
                  <dl className="kv" style={{ marginBottom: 24 }}>
                    <dt>Tür</dt>
                    <dd>{f.type === "SALON" ? "Kuaför salonu" : "Ürün satıcısı"}</dd>
                    <dt>Görünen ad</dt>
                    <dd>{f.type === "SALON" ? f.salonName : f.displayName}</dd>
                    <dt>Ticari unvan</dt>
                    <dd>{f.legalName}</dd>
                    <dt>Vergi no</dt>
                    <dd className="mono">
                      {f.taxNumber} · {f.taxOffice}
                    </dd>
                    <dt>Adres</dt>
                    <dd>
                      {f.address}, {f.district}/{f.city}
                    </dd>
                    <dt>Giriş</dt>
                    <dd>{f.ownerEmail}</dd>
                  </dl>
                  <label className="check" style={{ marginBottom: 18 }}>
                    <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
                    <span>
                      <Link to="/hizmet-sozlesmesi" target="_blank">
                        İşletme hizmet sözleşmesini
                      </Link>{" "}
                      okudum, kabul ediyorum.{" "}
                      <Link to="/kvkk" target="_blank">
                        KVKK aydınlatma metnini
                      </Link>{" "}
                      okudum. Verdiğim vergi ve iletişim bilgilerinin doğru olduğunu beyan ederim.
                    </span>
                  </label>
                </>
              )}

              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                {step > 0 ? (
                  <Button onClick={() => setStep((s) => s - 1)} disabled={busy}>
                    Geri
                  </Button>
                ) : null}
                <Button type="submit" variant="primary" loading={busy} style={{ flex: 1 }}>
                  {step === last ? "Kaydı tamamla" : "Devam"}
                </Button>
              </div>
            </form>
            <p className="muted small" style={{ marginTop: 22 }}>
              Zaten hesabınız var mı? <Link to="/giris">Giriş yapın</Link>
            </p>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}
