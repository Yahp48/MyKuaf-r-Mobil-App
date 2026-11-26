import { useState } from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { usePageMeta } from "../../lib/seo";
import { dateLong } from "../../lib/format";
import { Button, Empty, ErrorBox, Loading, PageHead, Stars } from "../../components/ui";

interface Data {
  items: {
    id: string;
    rating: number;
    comment: string | null;
    authorName: string;
    product: { id: string; name: string };
    createdAt: string;
  }[];
  total: number;
  hasNextPage: boolean;
  average: number;
}

export default function SellerReviews() {
  usePageMeta({ title: "Yorumlar" });
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ["seller", "reviews", page],
    queryFn: () => api.get<Data>("/business/seller/reviews", { page }),
  });
  return (
    <>
      <PageHead
        kicker="Mağaza"
        title="Ürün yorumları"
        sub={
          q.data?.total
            ? `${q.data.total} yorum · ortalama ${q.data.average.toLocaleString("tr-TR")}`
            : "Yalnızca ürünü teslim almış müşteriler yorum yapabilir."
        }
      />
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <ErrorBox error={q.error} onRetry={() => q.refetch()} />
      ) : q.data!.items.length === 0 ? (
        <Empty title="Henüz yorum yok">Teslim edilen siparişlerin müşterileri uygulamadan puan verebilir.</Empty>
      ) : (
        <div className="rows" style={{ maxWidth: 820 }}>
          {q.data!.items.map((r) => (
            <article key={r.id} className="row" style={{ flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", width: "100%" }}>
                <Stars value={r.rating} />
                <b style={{ fontWeight: 500 }}>{r.authorName}</b>
                <span className="small faint" style={{ marginLeft: "auto" }}>
                  {dateLong(r.createdAt)}
                </span>
              </div>
              {r.comment ? <p>{r.comment}</p> : null}
              <Link to={`/magaza/urunler/${r.product.id}`} className="small muted">
                {r.product.name}
              </Link>
            </article>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <Button size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              Önceki
            </Button>
            <Button size="sm" disabled={!q.data!.hasNextPage} onClick={() => setPage((p) => p + 1)}>
              Sonraki
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
