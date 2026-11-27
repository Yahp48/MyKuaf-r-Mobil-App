import { VerificationForm } from "../../components/Verification";
import { useState, type FormEvent } from "react";
import { useSearchParams } from "react-router";
import { api, ApiError } from "../../lib/api";
import { usePageMeta } from "../../lib/seo";
import { useBusiness, useSession } from "../../lib/session";
import { money } from "../../lib/format";
import type { Business } from "../../lib/types";
import { Button, Input, PageHead, Textarea } from "../../components/ui";
import { AccountForm, BusinessInfoForm } from "../../components/SettingsForms";
import { useToast } from "../../components/Toast";
import { ImageUploader } from "../../components/ImageUploader";

const TABS = [
  ["magaza", "Mağaza ve kargo"],
  ["isletme", "Vergi ve iletişim"],
  ["dogrulama", "Doğrulama"],
  ["hesap", "Hesap"],
] as const;

export default function SellerSettings() {
  usePageMeta({ title: "Ayarlar" });
  const [params, setParams] = useSearchParams();
  const tab = (params.get("bolum") as (typeof TABS)[number][0]) ?? "magaza";
  return (
    <>
      <PageHead kicker="Mağaza" title="Ayarlar" />
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
      {tab === "magaza" && <StoreForm />}
      {tab === "isletme" && <BusinessInfoForm />}
      {tab === "dogrulama" && <VerificationForm />}
      {tab === "hesap" && <AccountForm />}
    </>
  );
}

function StoreForm() {
  const { business } = useBusiness();
  const { setSession } = useSession();
  const toast = useToast();
  const [displayName, setDisplayName] = useState(business.displayName);
  const [fee, setFee] = useState(String(business.shippingFee).replace(".", ","));
  const [free, setFree] = useState(String(business.freeShippingThreshold).replace(".", ","));
  const [policy, setPolicy] = useState(business.returnPolicy ?? "");
  const [logo, setLogo] = useState<string[]>(business.logoUrl ? [business.logoUrl] : []);
  const [about, setAbout] = useState(business.storeDescription ?? "");
  const [busy, setBusy] = useState(false);
  const num = (v: string) => Number(v.replace(/\./g, "").replace(",", "."));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { business: b } = await api.patch<{ business: Business }>("/business/profile", {
        displayName: displayName.trim(),
        shippingFee: num(fee),
        freeShippingThreshold: num(free),
        returnPolicy: policy.trim() || null,
        logoUrl: logo[0] ?? null,
        storeDescription: about.trim() || null,
      });
      setSession((s) => ({ ...s, business: b }));
      toast("Mağaza ayarları kaydedildi; uygulamadaki sepetlere yansıdı");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Kaydedilemedi", "bad");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate style={{ maxWidth: 640 }}>
      <Input
        label="Mağaza adı"
        hint="Uygulamada ürünlerin altında görünür"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
      />
      <div className="field">
        <span className="label">Mağaza logosu</span>
        <ImageUploader value={logo} onChange={setLogo} max={1} />
        <span className="hint">
          Uygulamadaki mağaza vitrininde yuvarlak olarak görünür. Yalnızca size ait veya kullanım hakkınız olan bir logo
          yükleyin; kare ve en az 400×400 piksel önerilir.
        </span>
      </div>
      <Textarea
        label="Mağaza tanıtımı (isteğe bağlı)"
        rows={2}
        value={about}
        onChange={(e) => setAbout(e.target.value)}
        maxLength={300}
        hint="Mağaza sayfanızın üstünde görünür"
      />
      <div className="form-row">
        <Input
          label="Kargo ücreti (TL)"
          inputMode="decimal"
          value={fee}
          onChange={(e) => setFee(e.target.value.replace(/[^\d.,]/g, ""))}
          className="input mono"
        />
        <Input
          label="Ücretsiz kargo sınırı (TL)"
          inputMode="decimal"
          value={free}
          onChange={(e) => setFree(e.target.value.replace(/[^\d.,]/g, ""))}
          className="input mono"
          hint={num(free) > 0 ? `${money(num(free))} ve üzeri siparişte kargo ücretsiz` : "0: her siparişte ücretsiz"}
        />
      </div>
      <Textarea
        label="İade ve değişim koşulları"
        rows={5}
        value={policy}
        onChange={(e) => setPolicy(e.target.value)}
        maxLength={3000}
        hint="Tüketici kanunu gereği 14 günlük cayma hakkı her durumda geçerlidir."
      />
      <Button
        type="submit"
        variant="primary"
        loading={busy}
        disabled={!(num(fee) >= 0) || displayName.trim().length < 2}
      >
        Kaydet
      </Button>
    </form>
  );
}
