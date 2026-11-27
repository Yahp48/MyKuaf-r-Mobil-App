import { useState, type FormEvent } from "react";
import { useSearchParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { api, ApiError, fieldErrors } from "../../lib/api";
import { usePageMeta } from "../../lib/seo";
import { useBusiness, useSession } from "../../lib/session";
import type { SalonProfile } from "../../lib/types";
import { Button, Input, PageHead, Select, Switch, Textarea } from "../../components/ui";
import { AccountForm, BusinessInfoForm } from "../../components/SettingsForms";
import { ImageUploader } from "../../components/ImageUploader";
import { MapPicker } from "../../components/MapPicker";
import { useToast } from "../../components/Toast";
import { isMobile } from "../../lib/validators";

const TABS = [
  ["salon", "Salon profili"],
  ["kurallar", "Randevu kuralları"],
  ["isletme", "Vergi ve iletişim"],
  ["hesap", "Hesap"],
] as const;

export default function Settings() {
  usePageMeta({ title: "Ayarlar" });
  const [params, setParams] = useSearchParams();
  const tab = (params.get("bolum") as (typeof TABS)[number][0]) ?? "salon";
  return (
    <>
      <PageHead kicker="İşletme" title="Ayarlar" />
      <div className="tabs" role="tablist">
        {TABS.map(([k, label]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => setParams({ bolum: k }, { replace: true })}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "salon" && <SalonProfileForm />}
      {tab === "kurallar" && <RulesForm />}
      {tab === "isletme" && <BusinessInfoForm />}
      {tab === "hesap" && <AccountForm />}
    </>
  );
}

function useSaveSalon() {
  const { setSession } = useSession();
  const qc = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = async (body: Partial<SalonProfile>, message = "Kaydedildi; uygulamada hemen güncellendi") => {
    setBusy(true);
    setErrors({});
    try {
      const { salon } = await api.patch<{ salon: SalonProfile }>("/business/salon/profile", body);
      setSession((s) => ({ ...s, salon, business: { ...s.business, displayName: salon.name } }));
      void qc.invalidateQueries({ queryKey: ["salon"] });
      toast(message);
    } catch (e) {
      setErrors(fieldErrors(e));
      toast(e instanceof ApiError ? e.message : "Kaydedilemedi", "bad");
    } finally {
      setBusy(false);
    }
  };
  return { save, busy, errors };
}

function SalonProfileForm() {
  const { salon } = useBusiness();
  const s = salon!;
  const { save, busy, errors } = useSaveSalon();
  const toast = useToast();
  const [f, setF] = useState({
    name: s.name,
    description: s.description ?? "",
    address: s.address,
    city: s.city,
    district: s.district ?? "",
    phone: s.phone ?? "",
    website: s.website ?? "",
    latitude: s.latitude,
    longitude: s.longitude,
    photos: s.photos?.length ? s.photos : s.coverImageUrl ? [s.coverImageUrl] : [],
    kind: s.kind ?? "WOMEN",
    whatsapp: s.whatsapp ?? "",
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (f.whatsapp.trim() && !isMobile(f.whatsapp))
      return toast("WhatsApp numarası 05XX XXX XX XX biçiminde olmalı", "bad");
    void save({
      ...f,
      description: f.description.trim() || null,
      district: f.district.trim() || null,
      phone: f.phone.trim() || null,
      website: f.website.trim() || null,
      whatsapp: f.whatsapp.trim() || null,
    });
  };

  return (
    <div style={{ maxWidth: 760 }}>
      <div
        className="leaf leaf-pad"
        style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28, flexWrap: "wrap" }}
      >
        <div style={{ flex: 1, minWidth: 220 }}>
          <b>Uygulamada görünürlük</b>
          <p className="small muted">
            Kapatırsanız salonunuz haritadan kalkar ve yeni randevu alınamaz. Mevcut randevular etkilenmez.
          </p>
        </div>
        <Switch
          checked={s.isActive}
          onChange={(v) =>
            save({ isActive: v }, v ? "Salon uygulamada yeniden görünüyor" : "Salon geçici olarak gizlendi")
          }
          label={s.isActive ? "Yayında" : "Gizli"}
        />
      </div>

      <form onSubmit={submit} noValidate>
        <Input label="Salon adı" value={f.name} onChange={set("name")} error={errors.name} />
        <Textarea label="Tanıtım" rows={3} value={f.description} onChange={set("description")} maxLength={1000} />
        <Select
          label="Salon türü"
          value={f.kind}
          onChange={(e) => setF((x) => ({ ...x, kind: e.target.value as SalonProfile["kind"] }))}
          hint="Uygulamada salon adının altında görünür"
        >
          <option value="WOMEN">Kadın kuaförü</option>
          <option value="BEAUTY">Güzellik salonu</option>
        </Select>
        <div className="field">
          <span>Fotoğraflar</span>
          <span className="hint">
            İlk fotoğraf vitrin olarak kullanılır. Salonun içi, çalışmalarınız ve ekibiniz; en fazla 12 fotoğraf.
          </span>
          <ImageUploader value={f.photos} onChange={(photos) => setF((x) => ({ ...x, photos }))} max={12} />
        </div>
        <Textarea
          label="Adres (müşterinin gördüğü)"
          rows={2}
          value={f.address}
          onChange={set("address")}
          error={errors.address}
        />
        <div className="form-row">
          <Input label="İl" value={f.city} onChange={set("city")} />
          <Input label="İlçe" value={f.district} onChange={set("district")} />
        </div>
        <div className="form-row">
          <Input label="Randevu telefonu" type="tel" value={f.phone} onChange={set("phone")} />
          <Input
            label="WhatsApp (isteğe bağlı)"
            type="tel"
            value={f.whatsapp}
            onChange={set("whatsapp")}
            error={errors.whatsapp}
            placeholder="05XX XXX XX XX"
          />
          <Input
            label="Web sitesi"
            type="url"
            value={f.website}
            onChange={set("website")}
            error={errors.website}
            placeholder="https://"
          />
        </div>
        <div className="field">
          <span>Haritadaki konum</span>
          <span className="hint">İşareti sürükleyin veya haritaya tıklayın.</span>
        </div>
        <MapPicker
          lat={f.latitude}
          lng={f.longitude}
          onChange={(latitude, longitude) => setF((x) => ({ ...x, latitude, longitude }))}
        />
        <div style={{ marginTop: 20 }}>
          <Button type="submit" variant="primary" loading={busy}>
            Kaydet
          </Button>
        </div>
      </form>
    </div>
  );
}

function RulesForm() {
  const { salon } = useBusiness();
  const s = salon!;
  const { save, busy } = useSaveSalon();
  const [f, setF] = useState({
    slotIntervalMinutes: s.slotIntervalMinutes,
    bookingLeadMinutes: s.bookingLeadMinutes,
    bookingHorizonDays: s.bookingHorizonDays,
    cancellationWindowHours: s.cancellationWindowHours,
    autoConfirm: s.autoConfirm,
  });
  const num = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF((x) => ({ ...x, [k]: Number(e.target.value) }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save(f);
      }}
      style={{ maxWidth: 640 }}
    >
      <Select
        label="Randevu saat aralığı"
        value={f.slotIntervalMinutes}
        onChange={num("slotIntervalMinutes")}
        hint="Müşteriye gösterilen başlangıç saatleri bu aralıkla sıralanır"
      >
        {[10, 15, 20, 30, 60].map((m) => (
          <option key={m} value={m}>
            {m} dakikada bir
          </option>
        ))}
      </Select>
      <Select label="En geç ne kadar önceden" value={f.bookingLeadMinutes} onChange={num("bookingLeadMinutes")}>
        {[0, 30, 60, 120, 180, 360, 720, 1440].map((m) => (
          <option key={m} value={m}>
            {m === 0 ? "Hemen" : m < 60 ? `${m} dakika önce` : `${m / 60} saat önce`}
          </option>
        ))}
      </Select>
      <Select label="En fazla kaç gün ileriye" value={f.bookingHorizonDays} onChange={num("bookingHorizonDays")}>
        {[7, 14, 30, 60, 90, 180].map((d) => (
          <option key={d} value={d}>
            {d} gün
          </option>
        ))}
      </Select>
      <Select
        label="Müşteri iptal süresi"
        value={f.cancellationWindowHours}
        onChange={num("cancellationWindowHours")}
        hint="Randevuya bu süreden az kaldıysa müşteri uygulamadan iptal edemez, salonu aramalıdır"
      >
        {[0, 1, 2, 3, 6, 12, 24, 48].map((h) => (
          <option key={h} value={h}>
            {h === 0 ? "Son ana kadar" : `${h} saat önceye kadar`}
          </option>
        ))}
      </Select>
      <div style={{ margin: "8px 0 24px" }}>
        <Switch
          checked={f.autoConfirm}
          onChange={(v) => setF((x) => ({ ...x, autoConfirm: v }))}
          label="Uygulamadan gelen randevuları otomatik onayla"
        />
        <p className="small faint" style={{ marginTop: 6, marginLeft: 52 }}>
          Kapalıysa randevular "onay bekliyor" olarak düşer; siz onaylayınca müşteriye bildirim gider.
        </p>
      </div>
      <Button type="submit" variant="primary" loading={busy}>
        Kaydet
      </Button>
    </form>
  );
}
