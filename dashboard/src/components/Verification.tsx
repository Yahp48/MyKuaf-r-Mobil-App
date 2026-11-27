import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api";
import { useBusiness, useSession } from "../lib/session";
import type { Business } from "../lib/types";
import { Button, Input, Stamp } from "./ui";
import { useToast } from "./Toast";

const STATUS = {
  UNVERIFIED: {
    tone: "faint",
    label: "Doğrulanmadı",
    text: "Vergi levhanızı yükleyin; ekibimiz inceledikten sonra uygulamada “Doğrulanmış işletme” rozeti görünür.",
  },
  PENDING: {
    tone: "warn",
    label: "İnceleniyor",
    text: "Belgeniz inceleniyor. Sonuç genellikle 1–2 iş günü içinde bu sayfada görünür.",
  },
  VERIFIED: { tone: "ok", label: "Doğrulandı", text: "İşletmeniz doğrulandı; uygulamada rozetiniz görünüyor." },
  REJECTED: {
    tone: "bad",
    label: "Reddedildi",
    text: "Belgeniz kabul edilmedi. Aşağıdaki nedeni inceleyip güncel belgeyi yeniden yükleyin.",
  },
} as const;

/** İşletme doğrulaması (vergi levhası) ve salonlar için rehber kaydını sahiplenme. */
export function VerificationForm() {
  const { business } = useBusiness();
  const { setSession } = useSession();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const st = STATUS[business.verificationStatus];

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) return toast("Dosya en fazla 8 MB olabilir", "bad");
    setBusy(true);
    try {
      const { key } = await api.uploadDocument(file);
      const { business: b } = await api.post<{ business: Business }>("/business/verification", { documentKey: key });
      setSession((s) => ({ ...s, business: b }));
      toast("Belgeniz incelemeye gönderildi");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Yüklenemedi", "bad");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div style={{ maxWidth: 680 }}>
      <section className="leaf leaf-pad" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <b>İşletme doğrulaması</b>
          <Stamp tone={st.tone}>{st.label}</Stamp>
        </div>
        <p className="small muted">{st.text}</p>
        {business.verificationStatus === "REJECTED" && business.verificationNote ? (
          <p className="small">
            <b>Neden:</b> {business.verificationNote}
          </p>
        ) : null}
        {business.verificationStatus !== "VERIFIED" ? (
          <>
            <input
              ref={input}
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              hidden
              onChange={(e) => upload(e.target.files?.[0])}
            />
            <Button variant="primary" loading={busy} onClick={() => input.current?.click()}>
              {business.hasTaxCertificate ? "Yeni belge yükle" : "Vergi levhası yükle"}
            </Button>
            <p className="small faint" style={{ marginTop: 8 }}>
              PDF veya fotoğraf, en fazla 8 MB. Belge yalnızca MyKuaför yöneticileri tarafından görülür; uygulamada
              yayınlanmaz. Levhadaki unvan ve vergi numarası kayıt bilgilerinizle aynı olmalıdır.
            </p>
          </>
        ) : null}
      </section>
      {business.type === "SALON" ? <ClaimSection /> : null}
    </div>
  );
}

interface Listing {
  id: string;
  name: string;
  address: string;
  phone: string | null;
  district: string | null;
}

function ClaimSection() {
  const qc = useQueryClient();
  const toast = useToast();
  const [q, setQ] = useState("");
  const claims = useQuery({
    queryKey: ["salon", "claims"],
    queryFn: () =>
      api
        .get<{
          items: { id: string; status: string; note: string | null; listing: { name: string; address: string } }[];
        }>("/business/salon/claims")
        .then((r) => r.items),
  });
  const results = useQuery({
    queryKey: ["salon", "claims", "search", q],
    queryFn: () => api.get<{ items: Listing[] }>("/business/salon/claims/search", { q }).then((r) => r.items),
    enabled: q.trim().length >= 2,
  });
  const claim = useMutation({
    mutationFn: (listingId: string) => api.post("/business/salon/claims", { listingId }),
    onSuccess: () => {
      toast("Talebiniz alındı; inceleme sonrası bilgilendirileceksiniz");
      setQ("");
      void qc.invalidateQueries({ queryKey: ["salon", "claims"] });
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Gönderilemedi", "bad"),
  });
  const pending = claims.data?.find((c) => c.status === "PENDING");

  return (
    <section className="leaf leaf-pad">
      <b>Salonunuz haritada zaten var mı?</b>
      <p className="small muted">
        Uygulamada bazı salonlar herkese açık kaynaklardan (OpenStreetMap) rehber kaydı olarak görünür. Salonunuz
        listedeyse sahiplenin: onaylanınca o kayıt kalkar, salonunuz yerini alır ve kaydı favorileyen müşteriler
        salonunuzu favorilerinde görür.
      </p>
      {claims.data?.map((c) => (
        <p key={c.id} className="small">
          <Stamp tone={c.status === "APPROVED" ? "ok" : c.status === "REJECTED" ? "bad" : "warn"}>
            {c.status === "APPROVED" ? "Onaylandı" : c.status === "REJECTED" ? "Reddedildi" : "İnceleniyor"}
          </Stamp>{" "}
          {c.listing.name} — {c.listing.address}
          {c.note ? ` (${c.note})` : ""}
        </p>
      ))}
      {!pending ? (
        <>
          <Input
            label="Salon adıyla arayın"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Örn. Moda Kuaför"
          />
          {results.data?.length ? (
            <div className="rows">
              {results.data.map((l) => (
                <div key={l.id} className="row">
                  <span className="grow">
                    <b>{l.name}</b>
                    <span className="small muted" style={{ display: "block" }}>
                      {l.address}
                      {l.phone ? ` · ${l.phone}` : ""}
                    </span>
                  </span>
                  <Button size="sm" loading={claim.isPending} onClick={() => claim.mutate(l.id)}>
                    Bu salon benim
                  </Button>
                </div>
              ))}
            </div>
          ) : q.trim().length >= 2 && results.isSuccess ? (
            <p className="small faint">
              Eşleşen rehber kaydı yok; salonunuz zaten yalnızca sizin kaydınızla görünüyor.
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
