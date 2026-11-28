import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { api } from "../../lib/api";
import { usePageMeta } from "../../lib/seo";
import { dateShort, moneyShort, number } from "../../lib/format";
import { ErrorBox, Figure, Loading, PageHead } from "../../components/ui";

interface OverviewData {
  pendingVerifications: number;
  pendingClaims: number;
  openTickets: number;
  businesses: number;
  suspended: number;
  customers: number;
  bookable: number;
  listings: number;
  hidden: number;
}

interface Metrics {
  appointmentsToday: number;
  upcomingAppointments: number;
  productSales30d: number;
  paidOrders30d: number;
  serviceRevenue30d: number;
  completedAppointments30d: number;
  newCustomers7d: number;
  failedPayments7d: number;
  ordersToShip: number;
  aiTryonsToday: number;
  suspendedUsers: number;
  blockedProducts: number;
  series: { day: string; appointments: number; orders: number; customers: number }[];
}

/** Yönetim merkezi ana sayfası: bekleyen işler, bugünün hareketi, son 30 gün ve 14 günlük akış. Canlı tazelenir. */
export default function AdminOverview() {
  usePageMeta({ title: "Platform yönetimi" });
  const q = useQuery({ queryKey: ["admin", "overview"], queryFn: () => api.get<OverviewData>("/admin/overview") });
  const m = useQuery({ queryKey: ["admin", "metrics"], queryFn: () => api.get<Metrics>("/admin/overview/metrics") });
  if (q.isLoading || m.isLoading) {
    return (
      <>
        <PageHead kicker="Platform" title="Genel bakış" />
        <Loading />
      </>
    );
  }
  if (q.error || m.error) {
    return (
      <>
        <PageHead kicker="Platform" title="Genel bakış" />
        <ErrorBox error={q.error ?? m.error} onRetry={() => (q.refetch(), m.refetch())} />
      </>
    );
  }
  const o = q.data!;
  const x = m.data!;
  return (
    <>
      <PageHead
        kicker="Platform"
        title="Genel bakış"
        sub="Bekleyen işler, bugünün hareketi ve son 30 gün. Uygulamada bir şey olduğunda sayılar kendiliğinden güncellenir."
      />
      <section className="section">
        <h2>Bekleyen işler</h2>
        <div className="figures">
          <Figure
            label="Doğrulama bekleyen işletme"
            value={number(o.pendingVerifications)}
            note={<Link to="/yonetim/isletmeler?dogrulama=PENDING">İncele</Link>}
          />
          <Figure
            label="Sahiplenme talebi"
            value={number(o.pendingClaims)}
            note={<Link to="/yonetim/sahiplenme">İncele</Link>}
          />
          <Figure
            label="Açık destek talebi"
            value={number(o.openTickets)}
            note={<Link to="/yonetim/destek">Yanıtla</Link>}
          />
          <Figure
            label="Kargolanmayı bekleyen sipariş"
            value={number(x.ordersToShip)}
            note={<Link to="/yonetim/siparisler">Takip et</Link>}
          />
          <Figure
            label="Başarısız ödeme (7 gün)"
            value={number(x.failedPayments7d)}
            note={<Link to="/yonetim/odemeler">Gör</Link>}
          />
        </div>
      </section>

      <section className="section">
        <h2>Bugün</h2>
        <div className="figures">
          <Figure
            label="Bugünkü randevu"
            value={number(x.appointmentsToday)}
            note={<Link to="/yonetim/randevular">Listele</Link>}
          />
          <Figure label="Yaklaşan randevu" value={number(x.upcomingAppointments)} />
          <Figure label="Yeni müşteri (7 gün)" value={number(x.newCustomers7d)} />
          <Figure label="Yapay zekâ denemesi (bugün)" value={number(x.aiTryonsToday)} />
        </div>
      </section>

      <section className="section">
        <h2>Son 30 gün</h2>
        <div className="figures">
          <Figure
            label="Ürün satışı (iadeler düşülmüş)"
            value={moneyShort(x.productSales30d)}
            note={`${number(x.paidOrders30d)} ödeme`}
          />
          <Figure
            label="Tamamlanan hizmet tutarı"
            value={moneyShort(x.serviceRevenue30d)}
            note={`${number(x.completedAppointments30d)} randevu · salonda ödenir`}
          />
        </div>
      </section>

      <section className="section">
        <h2>Son 14 gün</h2>
        <div className="grid-cols">
          <MiniBars title="Yeni randevu" data={x.series.map((d) => [d.day, d.appointments])} />
          <MiniBars title="Ödenen sipariş" data={x.series.map((d) => [d.day, d.orders])} />
          <MiniBars title="Yeni müşteri" data={x.series.map((d) => [d.day, d.customers])} />
        </div>
        <details style={{ marginTop: 12 }}>
          <summary className="small muted">Tablo olarak göster</summary>
          <div className="table-wrap" style={{ marginTop: 8 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Gün</th>
                  <th className="right">Randevu</th>
                  <th className="right">Sipariş</th>
                  <th className="right">Müşteri</th>
                </tr>
              </thead>
              <tbody>
                {x.series.map((d) => (
                  <tr key={d.day}>
                    <td>{dateShort(d.day)}</td>
                    <td className="right mono">{d.appointments}</td>
                    <td className="right mono">{d.orders}</td>
                    <td className="right mono">{d.customers}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <section className="section">
        <h2>Platform</h2>
        <div className="figures">
          <Figure label="İşletme" value={number(o.businesses)} note={`${o.suspended} askıda`} />
          <Figure
            label="Müşteri"
            value={number(o.customers)}
            note={x.suspendedUsers ? `${x.suspendedUsers} askıda` : <Link to="/yonetim/musteriler">Listele</Link>}
          />
          <Figure label="Online randevulu salon" value={number(o.bookable)} />
          <Figure label="Rehber kaydı" value={number(o.listings)} note="OpenStreetMap" />
          <Figure label="Gizlenen yorum" value={number(o.hidden)} />
          <Figure label="Kaldırılan ürün" value={number(x.blockedProducts)} />
        </div>
      </section>
    </>
  );
}

/**
 * Tek ölçülü küçük sütun grafiği (küçük çoklu grafiklerden biri): ince sütunlar, ortak taban çizgisi,
 * yalnızca ilk/son gün etiketi; üzerine gelince gün ve değer görünür.
 */
function MiniBars({ title, data }: { title: string; data: [string, number][] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map(([, v]) => v));
  const total = data.reduce((s, [, v]) => s + v, 0);
  const shown = hover ?? data.length - 1;
  return (
    <figure className="leaf leaf-pad minibars" style={{ margin: 0 }}>
      <figcaption style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
        <b>{title}</b>
        <span className="small muted" style={{ marginLeft: "auto" }}>
          14 günde {number(total)}
        </span>
      </figcaption>
      <div className="small" style={{ minHeight: 20 }} aria-live="polite">
        <span className="mono">{number(data[shown]![1])}</span>{" "}
        <span className="muted">{hover === null ? "bugün" : dateShort(data[shown]![0])}</span>
      </div>
      <div className="minibars-plot" onMouseLeave={() => setHover(null)} role="img" aria-label={`${title}, son 14 gün`}>
        {data.map(([day, v], i) => (
          <div
            key={day}
            className="minibars-col"
            data-on={hover === i || undefined}
            onMouseEnter={() => setHover(i)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            tabIndex={0}
            aria-label={`${dateShort(day)}: ${v}`}
          >
            <span style={{ height: `${(v / max) * 100}%` }} data-zero={v === 0 || undefined} />
          </div>
        ))}
      </div>
      <div className="small faint" style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
        <span>{dateShort(data[0]![0])}</span>
        <span>{dateShort(data[data.length - 1]![0])}</span>
      </div>
    </figure>
  );
}
