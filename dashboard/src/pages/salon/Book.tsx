import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { CaretLeft, CaretRight, MagnifyingGlass, Plus } from "@phosphor-icons/react";
import { usePageMeta } from "../../lib/seo";
import { addDays, formatPhone, money, weekdayLong, ymd } from "../../lib/format";
import { Button, Empty, ErrorBox, Loading, PageHead, Stamp } from "../../components/ui";
import type { AppointmentStatus } from "../../lib/types";
import { DayBoard } from "./DayBoard";
import { NewAppointmentDialog } from "./NewAppointmentDialog";
import { isoWeekday, STATUS, useAppointments, useHours, useStaff } from "./queries";

export default function Book() {
  usePageMeta({ title: "Randevu defteri" });
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const date = params.get("gun") ?? ymd();
  const view = params.get("gorunum") === "liste" ? "list" : "board";
  const [status, setStatus] = useState<AppointmentStatus | "ALL">("ALL");
  const [q, setQ] = useState("");
  const [dialog, setDialog] = useState<{ staffId?: string; time?: string } | null>(null);

  const staff = useStaff();
  const hours = useHours();
  // Liste görünümünde 7 günlük pencere, defterde tek gün
  const to = view === "list" ? addDays(date, 6) : date;
  const appts = useAppointments(date, to);

  const setDate = (d: string) => setParams((p) => (p.set("gun", d), p), { replace: true });
  const setView = (v: "board" | "list") =>
    setParams((p) => (v === "list" ? p.set("gorunum", "liste") : p.delete("gorunum"), p), { replace: true });

  const filtered = useMemo(() => {
    const term = q.trim().toLocaleLowerCase("tr-TR");
    return (appts.data ?? []).filter(
      (a) =>
        (status === "ALL" || a.status === status) &&
        (!term ||
          a.customer.name.toLocaleLowerCase("tr-TR").includes(term) ||
          (a.customer.phone ?? "").includes(term.replace(/\D/g, "") || "§") ||
          a.code.toLowerCase().includes(term)),
    );
  }, [appts.data, status, q]);

  const dayHours = hours.data?.find((h) => h.weekday === isoWeekday(date));
  const counts = (appts.data ?? []).reduce<Record<string, number>>(
    (m, a) => ((m[a.status] = (m[a.status] ?? 0) + 1), m),
    {},
  );

  return (
    <>
      <PageHead
        kicker="Randevu defteri"
        title={view === "board" ? weekdayLong(date) : `${weekdayLong(date)} – ${weekdayLong(to)}`}
        sub={dayHours?.isClosed && view === "board" ? "Salon bu gün kapalı." : undefined}
        actions={
          <>
            <div className="segmented" role="group" aria-label="Görünüm">
              <button aria-pressed={view === "board"} onClick={() => setView("board")}>
                Defter
              </button>
              <button aria-pressed={view === "list"} onClick={() => setView("list")}>
                Liste
              </button>
            </div>
            <Button variant="primary" onClick={() => setDialog({})}>
              <Plus size={16} /> Randevu yaz
            </Button>
          </>
        }
      />

      <div className="toolbar">
        <div className="segmented" role="group" aria-label="Tarih">
          <button onClick={() => setDate(addDays(date, view === "list" ? -7 : -1))} aria-label="Önceki">
            <CaretLeft size={14} />
          </button>
          <button aria-pressed={date === ymd()} onClick={() => setDate(ymd())}>
            Bugün
          </button>
          <button onClick={() => setDate(addDays(date, view === "list" ? 7 : 1))} aria-label="Sonraki">
            <CaretRight size={14} />
          </button>
        </div>
        <input
          type="date"
          className="input"
          style={{ width: "auto" }}
          value={date}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          aria-label="Tarih seç"
        />
        <div className="search">
          <MagnifyingGlass size={16} />
          <input
            className="input"
            placeholder="Müşteri, telefon veya kod"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Randevu ara"
          />
        </div>
        <select
          className="select"
          style={{ width: "auto" }}
          value={status}
          onChange={(e) => setStatus(e.target.value as never)}
          aria-label="Durum"
        >
          <option value="ALL">Tüm durumlar ({appts.data?.length ?? 0})</option>
          {(Object.keys(STATUS) as AppointmentStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS[s].label} ({counts[s] ?? 0})
            </option>
          ))}
        </select>
      </div>

      {appts.error ? <ErrorBox error={appts.error} onRetry={() => appts.refetch()} /> : null}
      {appts.isLoading || staff.isLoading || hours.isLoading ? (
        <Loading rows={8} />
      ) : view === "board" ? (
        (staff.data ?? []).length === 0 ? (
          <Empty
            title="Defterde sütun yok"
            action={<Button onClick={() => navigate("/salon/personel")}>Personel ekle</Button>}
          >
            Randevu defteri personel sütunlarından oluşur. Önce personel ekleyin.
          </Empty>
        ) : (
          <>
            <DayBoard
              date={date}
              staff={staff.data ?? []}
              hours={dayHours}
              appointments={filtered}
              onEmptyClick={date >= ymd() ? (staffId, time) => setDialog({ staffId, time }) : undefined}
            />
            <p className="small faint" style={{ marginTop: 10 }}>
              Boş bir satıra tıklayarak o personel ve saat için randevu yazabilirsiniz. Kesikli çerçeveli randevular
              onay bekler.
            </p>
          </>
        )
      ) : filtered.length === 0 ? (
        <Empty title="Bu aralıkta randevu yok" />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Saat</th>
                <th>Müşteri</th>
                <th>Hizmet</th>
                <th>Personel</th>
                <th className="right">Tutar</th>
                <th>Durum</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id} data-href onClick={() => navigate(`/salon/randevular/${a.id}`)}>
                  <td>
                    {new Date(`${a.date}T12:00`).toLocaleDateString("tr-TR", {
                      day: "numeric",
                      month: "short",
                      weekday: "short",
                    })}
                  </td>
                  <td className="mono">
                    {a.time}–{a.endTime}
                  </td>
                  <td>
                    <a
                      href={`/salon/randevular/${a.id}`}
                      onClick={(e) => e.preventDefault()}
                      style={{ textDecoration: "none", fontWeight: 500 }}
                    >
                      {a.customer.name}
                    </a>
                    <div className="small faint mono">{formatPhone(a.customer.phone)}</div>
                  </td>
                  <td>{a.services.map((s) => s.name).join(", ")}</td>
                  <td>{a.staff.name}</td>
                  <td className="right mono">{money(a.total)}</td>
                  <td>
                    <Stamp tone={STATUS[a.status].tone}>{STATUS[a.status].label}</Stamp>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <NewAppointmentDialog
        open={!!dialog}
        onClose={() => setDialog(null)}
        initialDate={date < ymd() ? ymd() : date}
        initialStaffId={dialog?.staffId}
        initialTime={dialog?.time}
      />
    </>
  );
}
