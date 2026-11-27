import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../lib/api";
import { usePageMeta } from "../../lib/seo";
import { dateShort } from "../../lib/format";
import type { VerificationStatus } from "../../lib/types";
import { Button, Empty, ErrorBox, Loading, PageHead, Stamp } from "../../components/ui";
import { useToast } from "../../components/Toast";
import { VERIFICATION } from "./Businesses";

interface Claim {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  note: string | null;
  createdAt: string;
  listing: {
    id: string;
    name: string;
    address: string;
    phone: string | null;
    website: string | null;
    source: string | null;
  };
  business: {
    id: string;
    displayName: string;
    legalName: string;
    taxNumber: string;
    phone: string;
    address: string;
    verificationStatus: VerificationStatus;
    salonName: string | null;
    ownerEmail: string | null;
  };
}

export default function AdminClaims() {
  usePageMeta({ title: "Sahiplenme talepleri" });
  const qc = useQueryClient();
  const toast = useToast();
  const [status, setStatus] = useState<Claim["status"]>("PENDING");
  const q = useQuery({
    queryKey: ["admin", "claims", status],
    queryFn: () => api.get<{ items: Claim[] }>("/admin/claims", { status }).then((r) => r.items),
  });
  const approve = useMutation({
    mutationFn: (id: string) => api.post(`/admin/claims/${id}/approve`),
    onSuccess: () => {
      toast("Onaylandı: rehber kaydı işletmenin salonuyla değiştirildi");
      void qc.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Onaylanamadı", "bad"),
  });
  const reject = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => api.post(`/admin/claims/${id}/reject`, { note }),
    onSuccess: () => {
      toast("Talep reddedildi");
      void qc.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Reddedilemedi", "bad"),
  });

  return (
    <>
      <PageHead
        kicker="Platform"
        title="Sahiplenme talepleri"
        sub="Rehberdeki (OpenStreetMap) bir salonun sahibi olduğunu söyleyen işletmeler. Onaylamadan önce işletmenin doğrulanmış olması ve bilgilerin örtüşmesi önerilir."
      />
      <div className="tabs" role="tablist">
        {(["PENDING", "APPROVED", "REJECTED"] as const).map((s) => (
          <button key={s} role="tab" aria-selected={status === s} onClick={() => setStatus(s)}>
            {s === "PENDING" ? "Bekleyen" : s === "APPROVED" ? "Onaylanan" : "Reddedilen"}
          </button>
        ))}
      </div>
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <ErrorBox error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data!.length ? (
        <Empty title="Talep yok" />
      ) : (
        <div className="rows">
          {q.data!.map((c) => (
            <div key={c.id} className="leaf leaf-pad" style={{ marginBottom: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>
                <div>
                  <div className="label small">Rehber kaydı</div>
                  <b>{c.listing.name}</b>
                  <div className="small">{c.listing.address}</div>
                  <div className="small muted">{[c.listing.phone, c.listing.website].filter(Boolean).join(" · ")}</div>
                  {c.listing.source ? (
                    <a
                      className="small"
                      href={`https://www.openstreetmap.org/${c.listing.source}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Kaynakta gör
                    </a>
                  ) : null}
                </div>
                <div>
                  <div className="label small">Talep eden işletme</div>
                  <b>{c.business.displayName}</b>{" "}
                  <Stamp tone={VERIFICATION[c.business.verificationStatus].tone}>
                    {VERIFICATION[c.business.verificationStatus].label}
                  </Stamp>
                  <div className="small">{c.business.legalName}</div>
                  <div className="small muted">
                    VKN {c.business.taxNumber} · {c.business.phone} · {c.business.ownerEmail}
                  </div>
                  <div className="small muted">{c.business.address}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 14, alignItems: "center", flexWrap: "wrap" }}>
                <span className="small faint">{dateShort(c.createdAt)}</span>
                {c.status === "PENDING" ? (
                  <>
                    <Button
                      variant="primary"
                      size="sm"
                      loading={approve.isPending}
                      onClick={() => approve.mutate(c.id)}
                    >
                      Onayla
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        const note = prompt("Ret sebebi");
                        if (note && note.trim().length >= 3) reject.mutate({ id: c.id, note: note.trim() });
                      }}
                    >
                      Reddet
                    </Button>
                  </>
                ) : c.note ? (
                  <span className="small muted">{c.note}</span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
