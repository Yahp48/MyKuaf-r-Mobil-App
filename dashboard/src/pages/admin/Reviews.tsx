import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../lib/api";
import { usePageMeta } from "../../lib/seo";
import { dateShort } from "../../lib/format";
import type { Page } from "../../lib/types";
import { Button, Empty, ErrorBox, Loading, PageHead, Stamp, Stars } from "../../components/ui";
import { useToast } from "../../components/Toast";

interface AdminReview {
  id: string;
  salonName: string;
  rating: number;
  comment: string | null;
  photos: string[];
  isHidden: boolean;
  hiddenReason: string | null;
  authorName: string;
  createdAt: string;
}

/** Yorum denetimi: hakaret, kişisel veri, alakasız içerik veya uygunsuz fotoğraf içeren yorumlar gizlenir. */
export default function AdminReviews() {
  usePageMeta({ title: "Yorum denetimi" });
  const qc = useQueryClient();
  const toast = useToast();
  const [hidden, setHidden] = useState<"" | "true">("");
  const q = useQuery({
    queryKey: ["admin", "reviews", hidden],
    queryFn: () => api.get<Page<AdminReview>>("/admin/reviews", { hidden: hidden || undefined, pageSize: 50 }),
  });
  const toggle = useMutation({
    mutationFn: ({ id, hide, reason }: { id: string; hide: boolean; reason?: string }) =>
      api.post(`/admin/reviews/${id}/visibility`, { hidden: hide, reason }),
    onSuccess: (_r, v) => {
      toast(v.hide ? "Yorum gizlendi; salon puanı yeniden hesaplandı" : "Yorum yeniden yayında");
      void qc.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Yapılamadı", "bad"),
  });

  return (
    <>
      <PageHead
        kicker="İçerik"
        title="Yorum denetimi"
        sub="Yorumlar yalnızca tamamlanmış randevulardan gelir. Kurallara aykırı olanları gizleyin; gizlenen yorum puana katılmaz."
      />
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={hidden === ""} onClick={() => setHidden("")}>
          Tüm yorumlar
        </button>
        <button role="tab" aria-selected={hidden === "true"} onClick={() => setHidden("true")}>
          Gizlenenler
        </button>
      </div>
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <ErrorBox error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data!.items.length ? (
        <Empty title="Yorum yok" />
      ) : (
        q.data!.items.map((r) => (
          <article key={r.id} className="leaf leaf-pad" style={{ marginBottom: 12, opacity: r.isHidden ? 0.7 : 1 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <b>{r.salonName}</b>
              <Stars value={r.rating} />
              <span className="small muted">
                {r.authorName} · {dateShort(r.createdAt)}
              </span>
              {r.isHidden ? <Stamp tone="bad">Gizli</Stamp> : null}
            </div>
            {r.comment ? <p style={{ margin: "8px 0" }}>{r.comment}</p> : null}
            {r.photos.length ? (
              <div className="uploader" style={{ marginBottom: 8 }}>
                {r.photos.map((u) => (
                  <a key={u} href={u} target="_blank" rel="noreferrer">
                    <img src={u} alt="Yorum fotoğrafı" />
                  </a>
                ))}
              </div>
            ) : null}
            {r.isHidden ? (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span className="small muted">Sebep: {r.hiddenReason}</span>
                <Button size="sm" onClick={() => toggle.mutate({ id: r.id, hide: false })}>
                  Yayına al
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                onClick={() => {
                  const reason = prompt("Gizleme sebebi (ör. hakaret, kişisel veri, alakasız içerik)");
                  if (reason && reason.trim()) toggle.mutate({ id: r.id, hide: true, reason: reason.trim() });
                }}
              >
                Gizle
              </Button>
            )}
          </article>
        ))
      )}
    </>
  );
}
