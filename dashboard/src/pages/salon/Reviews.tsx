import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { usePageMeta } from "../../lib/seo";
import { dateLong } from "../../lib/format";
import { Button, Empty, ErrorBox, Loading, PageHead, Stars } from "../../components/ui";

interface ReviewsData {
  items: {
    id: string;
    rating: number;
    comment: string | null;
    photos: string[];
    isHidden: boolean;
    authorName: string;
    staffName: string;
    appointmentDate: string;
    createdAt: string;
  }[];
  total: number;
  hasNextPage: boolean;
  summary: { average: number; count: number; distribution: { rating: number; count: number }[] };
}

export default function Reviews() {
  usePageMeta({ title: "Yorumlar" });
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ["salon", "reviews", page],
    queryFn: () => api.get<ReviewsData>("/business/salon/reviews", { page }),
  });
  const d = q.data;
  const max = Math.max(1, ...(d?.summary.distribution.map((x) => x.count) ?? [1]));

  return (
    <>
      <PageHead
        kicker="İşletme"
        title="Yorumlar"
        sub="Yalnızca randevusu tamamlanan müşteriler yorum yapabilir; böylece puanınız gerçek ziyaretlere dayanır."
      />
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <ErrorBox error={q.error} onRetry={() => q.refetch()} />
      ) : d!.summary.count === 0 ? (
        <Empty title="Henüz yorum yok">
          Randevuları "Tamamlandı" olarak işaretlediğinizde müşteriler uygulamadan puan verebilir.
        </Empty>
      ) : (
        <div className="grid-2" style={{ gridTemplateColumns: "minmax(0, 280px) minmax(0, 1fr)" }}>
          <aside>
            <div className="figure" style={{ borderRight: 0 }}>
              <div className="label">Ortalama</div>
              <div className="value">{d!.summary.average.toLocaleString("tr-TR")}</div>
              <div className="note">{d!.summary.count} değerlendirme</div>
            </div>
            <div style={{ display: "grid", gap: 6, marginTop: 12 }}>
              {d!.summary.distribution.map((x) => (
                <div
                  key={x.rating}
                  style={{ display: "grid", gridTemplateColumns: "28px 1fr 32px", alignItems: "center", gap: 8 }}
                >
                  <span className="mono small">{x.rating}★</span>
                  <span style={{ height: 6, background: "var(--rule)", borderRadius: 3 }}>
                    <span
                      style={{
                        display: "block",
                        height: 6,
                        width: `${(x.count / max) * 100}%`,
                        background: "var(--accent)",
                        borderRadius: 3,
                      }}
                    />
                  </span>
                  <span className="mono small faint">{x.count}</span>
                </div>
              ))}
            </div>
          </aside>
          <div className="rows">
            {d!.items.map((r) => (
              <article key={r.id} className="row" style={{ alignItems: "flex-start", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", width: "100%" }}>
                  <Stars value={r.rating} />
                  <b style={{ fontWeight: 500 }}>{r.authorName}</b>
                  <span className="small faint" style={{ marginLeft: "auto" }}>
                    {dateLong(r.createdAt)}
                  </span>
                </div>
                {r.comment ? <p>{r.comment}</p> : <p className="faint small">Yorum yazılmamış.</p>}
                {r.photos.length ? (
                  <div className="uploader" style={{ marginTop: 8 }}>
                    {r.photos.map((u) => (
                      <a key={u} href={u} target="_blank" rel="noreferrer">
                        <img src={u} alt="Müşteri fotoğrafı" />
                      </a>
                    ))}
                  </div>
                ) : null}
                {r.isHidden ? (
                  <p className="small faint">Bu yorum platform kurallarına aykırı bulunduğu için gizlendi.</p>
                ) : null}
                <span className="small faint">
                  {r.staffName} · {dateLong(r.appointmentDate)} randevusu
                </span>
              </article>
            ))}
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <Button size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                Önceki
              </Button>
              <Button size="sm" disabled={!d!.hasNextPage} onClick={() => setPage((p) => p + 1)}>
                Sonraki
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
