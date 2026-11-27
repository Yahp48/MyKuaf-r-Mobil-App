import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { api } from "../../lib/api";
import { usePageMeta } from "../../lib/seo";
import { number } from "../../lib/format";
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

export default function AdminOverview() {
  usePageMeta({ title: "Platform yönetimi" });
  const q = useQuery({ queryKey: ["admin", "overview"], queryFn: () => api.get<OverviewData>("/admin/overview") });
  return (
    <>
      <PageHead kicker="Platform" title="Genel bakış" sub="Bekleyen işler ve platformun genel durumu." />
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <ErrorBox error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <>
          <section className="section">
            <h2>Bekleyen işler</h2>
            <div className="figures">
              <Figure
                label="Doğrulama bekleyen işletme"
                value={number(q.data!.pendingVerifications)}
                note={<Link to="/yonetim/isletmeler?dogrulama=PENDING">İncele</Link>}
              />
              <Figure
                label="Sahiplenme talebi"
                value={number(q.data!.pendingClaims)}
                note={<Link to="/yonetim/sahiplenme">İncele</Link>}
              />
              <Figure
                label="Açık destek talebi"
                value={number(q.data!.openTickets)}
                note={<Link to="/yonetim/destek">Yanıtla</Link>}
              />
            </div>
          </section>
          <section className="section">
            <h2>Platform</h2>
            <div className="figures">
              <Figure label="İşletme" value={number(q.data!.businesses)} note={`${q.data!.suspended} askıda`} />
              <Figure label="Müşteri" value={number(q.data!.customers)} />
              <Figure label="Online randevulu salon" value={number(q.data!.bookable)} />
              <Figure label="Rehber kaydı" value={number(q.data!.listings)} note="OpenStreetMap" />
              <Figure label="Gizlenen yorum" value={number(q.data!.hidden)} />
            </div>
          </section>
        </>
      )}
    </>
  );
}
