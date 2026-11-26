import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { api, ApiError, fieldErrors } from "../lib/api";
import { useBusiness, useSession } from "../lib/session";
import { formatIban, isEmail, isMobile, isPhone, isStrongPassword, isValidIban } from "../lib/validators";
import type { Business, Owner } from "../lib/types";
import { Button, Input, Textarea } from "./ui";
import { useToast } from "./Toast";

/** Vergi ve iletişim bilgileri (her iki işletme türü). Vergi numarası değiştirilemez. */
export function BusinessInfoForm() {
  const { business } = useBusiness();
  const { setSession } = useSession();
  const toast = useToast();
  const [f, setF] = useState({
    legalName: business.legalName,
    taxOffice: business.taxOffice,
    mersisNo: business.mersisNo ?? "",
    kepAddress: business.kepAddress ?? "",
    address: business.address,
    city: business.city,
    district: business.district,
    postalCode: business.postalCode ?? "",
    phone: business.phone,
    email: business.email,
    iban: business.iban ? formatIban(business.iban) : "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (!isPhone(f.phone)) er.phone = "Geçerli bir telefon girin";
    if (!isEmail(f.email)) er.email = "Geçerli bir e-posta girin";
    if (f.iban && !isValidIban(f.iban)) er.iban = "IBAN doğrulanamadı";
    if (f.mersisNo && !/^\d{16}$/.test(f.mersisNo)) er.mersisNo = "MERSİS no 16 hanedir";
    if (f.postalCode && !/^\d{5}$/.test(f.postalCode)) er.postalCode = "Posta kodu 5 hanedir";
    setErrors(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    try {
      const { business: b } = await api.patch<{ business: Business }>("/business/profile", f);
      setSession((s) => ({ ...s, business: b }));
      toast("İşletme bilgileri kaydedildi");
    } catch (err) {
      setErrors(fieldErrors(err));
      toast(err instanceof ApiError ? err.message : "Kaydedilemedi", "bad");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate style={{ maxWidth: 720 }}>
      <Input label="Ticari unvan" value={f.legalName} onChange={set("legalName")} error={errors.legalName} />
      <div className="form-row">
        <Input
          label="Vergi kimlik no"
          value={business.taxNumber}
          readOnly
          className="input mono"
          hint="Güvenlik nedeniyle değiştirilemez; hatalıysa destekle iletişime geçin."
        />
        <Input label="Vergi dairesi" value={f.taxOffice} onChange={set("taxOffice")} error={errors.taxOffice} />
      </div>
      <div className="form-row">
        <Input
          label="MERSİS no"
          value={f.mersisNo}
          onChange={set("mersisNo")}
          error={errors.mersisNo}
          inputMode="numeric"
          maxLength={16}
        />
        <Input label="KEP adresi" value={f.kepAddress} onChange={set("kepAddress")} />
      </div>
      <Textarea label="Adres" rows={2} value={f.address} onChange={set("address")} error={errors.address} />
      <div className="form-row">
        <Input label="İl" value={f.city} onChange={set("city")} error={errors.city} />
        <Input label="İlçe" value={f.district} onChange={set("district")} error={errors.district} />
        <Input
          label="Posta kodu"
          value={f.postalCode}
          onChange={set("postalCode")}
          error={errors.postalCode}
          maxLength={5}
        />
      </div>
      <div className="form-row">
        <Input label="Telefon" type="tel" value={f.phone} onChange={set("phone")} error={errors.phone} />
        <Input label="E-posta" type="email" value={f.email} onChange={set("email")} error={errors.email} />
      </div>
      <Input
        label="IBAN"
        value={f.iban}
        onChange={(e) => setF((s) => ({ ...s, iban: formatIban(e.target.value) }))}
        error={errors.iban}
        className="input mono"
        maxLength={32}
      />
      <Button type="submit" variant="primary" loading={busy}>
        Kaydet
      </Button>
    </form>
  );
}

export function AccountForm() {
  const { owner } = useBusiness();
  const { setSession, signOut } = useSession();
  const navigate = useNavigate();
  const toast = useToast();
  const [name, setName] = useState(owner.name);
  const [phone, setPhone] = useState(owner.phone ?? "");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState<"profile" | "password" | null>(null);

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (phone && !isMobile(phone)) return toast("Cep telefonu 05XX XXX XX XX biçiminde olmalı", "bad");
    setBusy("profile");
    try {
      const { owner: o } = await api.patch<{ owner: Owner }>("/business/account", {
        name: name.trim(),
        ...(phone ? { phone } : {}),
      });
      setSession((s) => ({ ...s, owner: o }));
      toast("Hesap bilgileri kaydedildi");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Kaydedilemedi", "bad");
    } finally {
      setBusy(null);
    }
  };

  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    setBusy("password");
    try {
      const r = await api.post<{ message: string }>("/business/account/change-password", {
        currentPassword: current,
        newPassword: next,
      });
      toast(r.message);
      await signOut();
      navigate("/giris", { replace: true });
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Şifre değiştirilemedi", "bad");
      setBusy(null);
    }
  };

  return (
    <div className="grid-cols" style={{ maxWidth: 900, alignItems: "start" }}>
      <form onSubmit={saveProfile} noValidate>
        <h3 style={{ fontSize: 19, marginBottom: 14 }}>Yetkili</h3>
        <Input label="Giriş e-postası" value={owner.email} readOnly />
        <Input label="Ad soyad" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        <Input
          label="Cep telefonu"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          autoComplete="tel"
        />
        <Button type="submit" loading={busy === "profile"}>
          Kaydet
        </Button>
      </form>
      <form onSubmit={changePassword} noValidate>
        <h3 style={{ fontSize: 19, marginBottom: 14 }}>Şifre</h3>
        <Input
          label="Mevcut şifre"
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          autoComplete="current-password"
        />
        <Input
          label="Yeni şifre"
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          autoComplete="new-password"
          hint="Değiştirdiğinizde tüm cihazlardan çıkış yapılır."
        />
        <Button type="submit" loading={busy === "password"} disabled={!current || !isStrongPassword(next)}>
          Şifreyi değiştir
        </Button>
      </form>
    </div>
  );
}
