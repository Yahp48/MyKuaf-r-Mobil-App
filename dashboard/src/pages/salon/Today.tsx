import { useState } from "react";
import { Link, useLocation } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "@phosphor-icons/react";
import { api } from "../../lib/api";
import { usePageMeta } from "../../lib/seo";
import { useBusiness } from "../../lib/session";
import { dateShort, money, moneyShort, weekdayLong } from "../../lib/format";
import { BarChart } from "../../components/BarChart";
import { Button, Empty, ErrorBox, Figure, LinkButton, Loading, PageHead, Stamp } from "../../components/ui";
import type { Appointment } from "../../lib/types";
import { NewAppointmentDialog } from "./NewAppointmentDialog";
import { STATUS } from "./queries";

interface Overview {
  date: string;
  today: { appointments: Appointment[]; count: number; expectedRevenue: number; occupancy: number };
  month: { revenue: number; completed: number };
  cancellationRate30d: number;
  pendingApprovals: number;
  rating: { value: number; count: number };
  revenueSeries: { date: string; value: number }[];
  setup: { hasStaff: boolean; hasServices: boolean; hasOpenDay: boolean; isActive: boolean; visibleOnMap: boolean };
}

function greeting() {
  const h = new Date().getHours();
  return h < 11 ? "Günaydın" : h < 17 ? "İyi günler" : "İyi akşamlar";
}

export default function Today() {
  usePageMeta({ title: "Bugün" });
  const { owner } = useBusiness();
  const location = useLocation();
  const welcome = (location.state as { welcome?: boolean } | null)?.welcome;
  const [newOpen, setNewOpen] = useState(false);
  const q = useQuery({ queryKey: ["salon", "overview"], queryFn: () => api.get<Overview>("/business/salon/overview") });

  if (q.isLoading) return <Loading rows={8} />;
  if (q.error) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data!;
  const now = new Date();
  const upcoming = d.today.appointments.filter((a) => a.status !== "CANCELLED" && new Date(a.endsAt) > now);
  const done = d.today.appointments.filter((a) => a.status === "COMPLETED").length;

  return (
    <>
      <PageHead
        kicker={weekdayLong(d.date)}
        title={`${greeting()}, ${owner.name.split(" ")[0]}.`}
        sub={
          d.today.count
            ? `Bugün defterde ${d.today.count} randevu var${done ? `, ${done} tanesi tamamlandı` : ""}.`
            : "Bugün için henüz randevu yok."
        }
        actions={
          <>
            <LinkButton to="/salon/randevular">Defteri aç</LinkButton>
            <Button variant="primary" onClick={() => setNewOpen(true)}>
              <Plus size={16} /> Randevu yaz
            </Button>
          </>
        }
      />

      {!d.setup.visibleOnMap ? (
        <section className="leaf leaf-pad" style={{ marginBottom: 32 }} aria-labelledby="setup">
          <h2 id="setup" style={{ fontSize: 22, marginBottom: 4 }}>
            {welcome ? "Hoş geldiniz! " : ""}Salonunuzu uygulamada yayına alalım
          </h2>
          <p className="muted" style={{ marginBottom: 12 }}>
            Bu adımlar tamamlanınca salonunuz BiBakım uygulamasının haritasında hemen görünür.
          </p>
          <ol className="setup" style={{ padding: 0, margin: 0 }}>
            <li data-done={d.setup.hasStaff}>
              <span style={{ flex: 1 }}>En az bir personel ekleyin</span>
              {!d.setup.hasStaff ? (
                <LinkButton to="/salon/personel" size="sm">
                  Personel ekle
                </LinkButton>
              ) : null}
            </li>
            <li data-done={d.setup.hasServices}>
              <span style={{ flex: 1 }}>Hizmetlerinizi ve fiyatlarınızı girin</span>
              {!d.setup.hasServices ? (
                <LinkButton to="/salon/hizmetler" size="sm">
                  Hizmet ekle
                </LinkButton>
              ) : null}
            </li>
            <li data-done={d.setup.hasOpenDay}>
              <span style={{ flex: 1 }}>Çalışma saatlerinizi kontrol edin</span>
              <LinkButton to="/salon/calisma-saatleri" size="sm">
                Saatler
              </LinkButton>
            </li>
            <li data-done={d.setup.isActive}>
              <span style={{ flex: 1 }}>Salon görünürlüğünü açın</span>
              {!d.setup.isActive ? (
                <LinkButton to="/salon/ayarlar" size="sm">
                  Ayarlar
                </LinkButton>
              ) : null}
            </li>
          </ol>
        </section>
      ) : null}

      <div className="figures" role="group" aria-label="Bugünün özeti">
        <Figure label="Bugün beklenen" value={moneyShort(d.today.expectedRevenue)} note={`${d.today.count} randevu`} />
        <Figure
          label="Doluluk"
          value={
            <>
              {d.today.occupancy}
              <small>%</small>
            </>
          }
          note="Personel kapasitesine göre"
        />
        <Figure
          label="Bu ay ciro"
          value={moneyShort(d.month.revenue)}
          note={`${d.month.completed} tamamlanan randevu`}
        />
        <Figure
          label="İptal / gelmeme"
          value={
            <>
              {d.cancellationRate30d}
              <small>%</small>
            </>
          }
          note="Son 30 gün"
        />
        <Figure
          label="Puan"
          value={d.rating.count ? d.rating.value.toLocaleString("tr-TR") : "—"}
          note={d.rating.count ? `${d.rating.count} değerlendirme` : "Henüz değerlendirme yok"}
        />
      </div>

      <div className="grid-2 section">
        <section aria-labelledby="next">
          <div className="section-head">
            <h2 id="next">Sıradakiler</h2>
            {d.pendingApprovals ? (
              <Link to="/salon/randevular" className="small">
                {d.pendingApprovals} randevu onay bekliyor →
              </Link>
            ) : null}
          </div>
          {upcoming.length === 0 ? (
            <Empty title="Bugün için sırada kimse yok">Boş saatlere telefonla gelen randevuları yazabilirsiniz.</Empty>
          ) : (
            <div className="rows">
              {upcoming.map((a) => (
                <Link key={a.id} to={`/salon/randevular/${a.id}`} className="row" style={{ textDecoration: "none" }}>
                  <span className="time-cell">{a.time}</span>
                  <span className="grow">
                    <span className="title">{a.customer.name}</span>
                    <span className="muted small" style={{ display: "block" }}>
                      {a.services.map((s) => s.name).join(", ")} · {a.staff.name}
                    </span>
                  </span>
                  <span className="mono small muted">{money(a.total)}</span>
                  <Stamp tone={STATUS[a.status].tone}>{STATUS[a.status].label}</Stamp>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="trend">
          <div className="section-head">
            <h2 id="trend">Son 14 gün</h2>
            <span className="small faint">Tamamlanan randevu cirosu</span>
          </div>
          <div className="leaf leaf-pad">
            <BarChart
              caption="Son 14 günün günlük cirosu"
              data={d.revenueSeries.map((p) => ({
                label: dateShort(p.date).split(" ")[0]!,
                title: dateShort(p.date),
                value: p.value,
              }))}
            />
          </div>
        </section>
      </div>

      <NewAppointmentDialog open={newOpen} onClose={() => setNewOpen(false)} initialDate={d.date} />
    </>
  );
}
