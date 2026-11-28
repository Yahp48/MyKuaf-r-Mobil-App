import { useState } from "react";
import { useSearchParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../lib/api";
import { usePageMeta } from "../../lib/seo";
import { dateShort } from "../../lib/format";
import type { Business, Page, VerificationStatus } from "../../lib/types";
import { Button, Dialog, Empty, ErrorBox, Input, Loading, PageHead, Stamp, Textarea } from "../../components/ui";
import { useToast } from "../../components/Toast";

interface AdminBusiness extends Business {
  verifiedAt: string | null;
  owner: { name: string; email: string; phone: string | null } | null;
  salon: { id: string; name: string; isActive: boolean; address: string } | null;
}

export const VERIFICATION = {
  UNVERIFIED: { tone: "faint", label: "Belge yok" },
  PENDING: { tone: "warn", label: "İnceleme bekliyor" },
  VERIFIED: { tone: "ok", label: "Doğrulandı" },
  REJECTED: { tone: "bad", label: "Reddedildi" },
} as const;

const FILTERS: [VerificationStatus | "", string][] = [
  ["", "Tümü"],
  ["PENDING", "İnceleme bekleyen"],
  ["VERIFIED", "Doğrulanmış"],
  ["REJECTED", "Reddedilen"],
  ["UNVERIFIED", "Belgesiz"],
];

export default function AdminBusinesses() {
  usePageMeta({ title: "İşletmeler" });
  const [params, setParams] = useSearchParams();
  const verification = params.get("dogrulama") ?? "";
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<AdminBusiness | null>(null);
  const list = useQuery({
    queryKey: ["admin", "businesses", verification, q],
    queryFn: () =>
      api.get<Page<AdminBusiness>>("/admin/businesses", {
        verification: verification || undefined,
        q: q.trim() || undefined,
        pageSize: 50,
      }),
  });

  return (
    <>
      <PageHead
        kicker="Platform"
        title="İşletmeler"
        sub="Vergi levhasını inceleyip doğrulayın; kurallara aykırı işletmeleri askıya alın."
      />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end", marginBottom: 16 }}>
        <div className="tabs" role="tablist" style={{ margin: 0 }}>
          {FILTERS.map(([k, label]) => (
            <button
              key={label}
              role="tab"
              aria-selected={verification === k}
              onClick={() => setParams(k ? { dogrulama: k } : {}, { replace: true })}
            >
              {label}
            </button>
          ))}
        </div>
        <div style={{ minWidth: 240, flex: 1, maxWidth: 360 }}>
          <Input label="Ara" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ad, unvan, VKN, e-posta" />
        </div>
      </div>
      {list.isLoading ? (
        <Loading />
      ) : list.error ? (
        <ErrorBox error={list.error} onRetry={() => list.refetch()} />
      ) : !list.data!.items.length ? (
        <Empty title="İşletme bulunamadı" />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>İşletme</th>
                <th>Tür</th>
                <th>VKN / TCKN</th>
                <th>Doğrulama</th>
                <th>Durum</th>
                <th>Kayıt</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.data!.items.map((b) => (
                <tr key={b.id}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{b.displayName}</div>
                    <div className="small faint">{b.legalName}</div>
                  </td>
                  <td className="small">{b.type === "SALON" ? "Kuaför" : "Satıcı"}</td>
                  <td className="mono small">{b.taxNumber}</td>
                  <td>
                    <Stamp tone={VERIFICATION[b.verificationStatus].tone}>
                      {VERIFICATION[b.verificationStatus].label}
                    </Stamp>
                  </td>
                  <td>{b.status === "ACTIVE" ? <Stamp tone="ok">Aktif</Stamp> : <Stamp tone="bad">Askıda</Stamp>}</td>
                  <td className="small">{dateShort(b.createdAt)}</td>
                  <td className="right">
                    <Button size="sm" variant="quiet" onClick={() => setOpen(b)}>
                      İncele
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <BusinessDialog business={open} onClose={() => setOpen(null)} />
    </>
  );
}

function BusinessDialog({ business: b, onClose }: { business: AdminBusiness | null; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [note, setNote] = useState("");
  const done = (msg: string) => {
    toast(msg);
    setNote("");
    void qc.invalidateQueries({ queryKey: ["admin"] });
    onClose();
  };
  const fail = (e: unknown) => toast(e instanceof ApiError ? e.message : "İşlem yapılamadı", "bad");
  const verify = useMutation({
    mutationFn: (status: "VERIFIED" | "REJECTED") =>
      api.post(`/admin/businesses/${b!.id}/verification`, { status, note: note.trim() || undefined }),
    onSuccess: (_r, status) => done(status === "VERIFIED" ? "İşletme doğrulandı" : "Doğrulama reddedildi"),
    onError: fail,
  });
  const setStatus = useMutation({
    mutationFn: (status: "ACTIVE" | "SUSPENDED") =>
      api.post(`/admin/businesses/${b!.id}/status`, { status, reason: note.trim() || undefined }),
    onSuccess: (_r, status) => done(status === "SUSPENDED" ? "İşletme askıya alındı" : "İşletme yeniden etkin"),
    onError: fail,
  });
  const openCertificate = async () => {
    try {
      const blob = await api.blob(`/admin/businesses/${b!.id}/tax-certificate`);
      window.open(URL.createObjectURL(blob), "_blank", "noopener");
    } catch (e) {
      fail(e);
    }
  };

  return (
    <Dialog open={!!b} onClose={onClose} title={b?.displayName ?? ""} wide>
      {b ? (
        <>
          <dl className="facts">
            <dt>Ticari unvan</dt>
            <dd>{b.legalName}</dd>
            <dt>Vergi no / dairesi</dt>
            <dd className="mono">
              {b.taxNumber} · {b.taxOffice}
            </dd>
            {b.mersisNo ? (
              <>
                <dt>MERSİS</dt>
                <dd className="mono">{b.mersisNo}</dd>
              </>
            ) : null}
            <dt>Adres</dt>
            <dd>
              {b.address}, {b.district}/{b.city}
            </dd>
            <dt>İletişim</dt>
            <dd>
              {b.phone} · {b.email}
            </dd>
            {b.owner ? (
              <>
                <dt>Hesap sahibi</dt>
                <dd>
                  {b.owner.name} · {b.owner.email}
                </dd>
              </>
            ) : null}
            {b.salon ? (
              <>
                <dt>Salon</dt>
                <dd>
                  {b.salon.name} — {b.salon.address}
                </dd>
              </>
            ) : null}
            {b.verificationNote ? (
              <>
                <dt>Not</dt>
                <dd>{b.verificationNote}</dd>
              </>
            ) : null}
          </dl>
          <ol className="small" style={{ paddingLeft: 18, lineHeight: 1.6 }}>
            <li>Vergi levhasını açın; unvan, vergi numarası, vergi dairesi ve adres yukarıdakilerle aynı olmalı.</li>
            <li>
              Levhadaki <b>onay kodu</b> ile levhanın gerçekliğini{" "}
              <a href="https://www.turkiye.gov.tr/gib-intvrg-e-vergi-levhasi-dogrulama" target="_blank" rel="noreferrer">
                e-Devlet › e-Vergi Levhası Doğrulama
              </a>{" "}
              sayfasından kontrol edin (kendi e-Devlet girişinizle).
            </li>
            <li>Şirketlerde MERSİS numarası ve ticaret sicil kaydı unvanla uyuşmalı.</li>
            <li>Uyuşmazlık varsa sebebini yazarak reddedin; işletme panelinde görür ve yeni belge yükler.</li>
          </ol>
          {b.hasTaxCertificate ? (
            <Button onClick={openCertificate}>Vergi levhasını aç</Button>
          ) : (
            <p className="small faint">İşletme henüz vergi levhası yüklemedi.</p>
          )}
          <Textarea
            label="Not / sebep (ret ve askıya almada zorunlu)"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
          />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button
              variant="primary"
              disabled={!b.hasTaxCertificate || b.verificationStatus === "VERIFIED"}
              loading={verify.isPending}
              onClick={() => verify.mutate("VERIFIED")}
            >
              Doğrula
            </Button>
            <Button disabled={!note.trim()} onClick={() => verify.mutate("REJECTED")}>
              Reddet
            </Button>
            {b.status === "ACTIVE" ? (
              <Button disabled={!note.trim()} onClick={() => setStatus.mutate("SUSPENDED")}>
                Askıya al
              </Button>
            ) : (
              <Button onClick={() => setStatus.mutate("ACTIVE")}>Yeniden etkinleştir</Button>
            )}
          </div>
        </>
      ) : null}
    </Dialog>
  );
}
