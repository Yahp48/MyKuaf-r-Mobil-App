import { Link, useLocation } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "@phosphor-icons/react";
import { api } from "../../lib/api";
import { usePageMeta } from "../../lib/seo";
import { useBusiness } from "../../lib/session";
import { dateShort, money, moneyShort } from "../../lib/format";
import { BarChart } from "../../components/BarChart";
import { Empty, ErrorBox, Figure, LinkButton, Loading, PageHead } from "../../components/ui";

interface Overview {
  kpis: {
    revenueToday: number;
    revenue7d: number;
    revenue30d: number;
    orders30d: number;
    averageOrder: number;
    toShip: number;
    activeProducts: number;
  };
  series: { date: string; revenue: number; orders: number }[];
  lowStock: { id: string; name: string; stock: number; image: string | null }[];
  topProducts: { productId: string; name: string; quantity: number; revenue: number }[];
}

export default function SellerOverview() {
  usePageMeta({ title: "Özet" });
  const { business } = useBusiness();
  const welcome = (useLocation().state as { welcome?: boolean } | null)?.welcome;
  const q = useQuery({
    queryKey: ["seller", "overview"],
    queryFn: () => api.get<Overview>("/business/seller/overview"),
  });

  if (q.isLoading) return <Loading rows={8} />;
  if (q.error) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data!;

  return (
    <>
      <PageHead
        kicker={new Date().toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" })}
        title={business.displayName}
        sub={
          d.kpis.toShip
            ? `${d.kpis.toShip} sipariş hazırlanmayı ve kargolanmayı bekliyor.`
            : "Bekleyen sipariş yok; her şey yolunda."
        }
        actions={
          <>
            <LinkButton to="/magaza/urunler/yeni">
              <Plus size={16} /> Ürün ekle
            </LinkButton>
            <LinkButton to="/magaza/siparisler" variant="primary">
              Siparişlere git
            </LinkButton>
          </>
        }
      />

      {welcome || d.kpis.activeProducts === 0 ? (
        <section className="leaf leaf-pad" style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 22, marginBottom: 4 }}>{welcome ? "Mağazanız açıldı. " : ""}İlk ürününüzü ekleyin</h2>
          <p className="muted" style={{ marginBottom: 14 }}>
            Eklediğiniz ürün, Bakımca uygulamasının mağaza bölümünde hemen satışa çıkar. Kargo ücretinizi Ayarlar'dan
            belirleyebilirsiniz.
          </p>
          <LinkButton to="/magaza/urunler/yeni" variant="accent">
            Ürün ekle
          </LinkButton>
        </section>
      ) : null}

      <div className="figures">
        <Figure label="Bugün" value={moneyShort(d.kpis.revenueToday)} />
        <Figure label="Son 7 gün" value={moneyShort(d.kpis.revenue7d)} />
        <Figure label="Son 30 gün" value={moneyShort(d.kpis.revenue30d)} note={`${d.kpis.orders30d} sipariş`} />
        <Figure label="Ortalama sepet" value={moneyShort(d.kpis.averageOrder)} />
        <Figure
          label="Kargolanacak"
          value={<span style={{ color: d.kpis.toShip ? "var(--accent)" : undefined }}>{d.kpis.toShip}</span>}
          note={<Link to="/magaza/siparisler">Listeyi aç →</Link>}
        />
      </div>

      <section className="section">
        <div className="section-head">
          <h2>Son 30 gün satış</h2>
          <span className="small faint">Ödenmiş siparişler, iadeler hariç</span>
        </div>
        <div className="leaf leaf-pad">
          <BarChart
            caption="Son 30 günün günlük satışları"
            data={d.series.map((p) => ({
              label: String(Number(p.date.slice(8))),
              title: `${dateShort(p.date)} · ${p.orders} sipariş`,
              value: p.revenue,
            }))}
          />
        </div>
      </section>

      <div className="grid-cols section">
        <section>
          <h2 style={{ marginBottom: 12 }}>En çok satanlar</h2>
          {d.topProducts.length === 0 ? (
            <p className="muted">Son 30 günde satış yok.</p>
          ) : (
            <div className="rows">
              {d.topProducts.map((t, i) => (
                <Link
                  key={t.productId}
                  to={`/magaza/urunler/${t.productId}`}
                  className="row"
                  style={{ textDecoration: "none" }}
                >
                  <span className="mono faint" style={{ width: 18 }}>
                    {i + 1}
                  </span>
                  <span className="grow">{t.name}</span>
                  <span className="mono small muted">{t.quantity} adet</span>
                  <span className="mono">{money(t.revenue)}</span>
                </Link>
              ))}
            </div>
          )}
        </section>
        <section>
          <h2 style={{ marginBottom: 12 }}>Stoğu azalanlar</h2>
          {d.lowStock.length === 0 ? (
            <Empty title="Stoklar yeterli">5 adet ve altına düşen ürünler burada görünür.</Empty>
          ) : (
            <div className="rows">
              {d.lowStock.map((p) => (
                <Link key={p.id} to={`/magaza/urunler/${p.id}`} className="row" style={{ textDecoration: "none" }}>
                  {p.image ? <img className="thumb" src={p.image} alt="" /> : <span className="thumb" />}
                  <span className="grow">{p.name}</span>
                  <span className="mono" style={{ color: p.stock === 0 ? "var(--bad)" : "var(--warn)" }}>
                    {p.stock === 0 ? "Tükendi" : `${p.stock} adet`}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
