import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { hhmm, toMinutes, ymd } from "../../lib/format";
import type { Appointment, Staff } from "../../lib/types";
import type { DayHours } from "./queries";

const ROW = 44; // px / satır (30 dk randevuda ad ve saat iki satır sığar)
const STEP = 30; // dk / satır

/**
 * Günlük randevu defteri: saat satırları × personel sütunları.
 * Boş bir hücreye tıklanınca o personel ve saat için yeni randevu açılır.
 */
export function DayBoard({
  date,
  staff,
  hours,
  appointments,
  onEmptyClick,
}: {
  date: string;
  staff: Staff[];
  hours: DayHours | undefined;
  appointments: Appointment[];
  onEmptyClick?: (staffId: string, time: string) => void;
}) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Defter aralığı: çalışma saatleri + saat dışına taşan randevular
  const { start, end } = useMemo(() => {
    let s = hours && !hours.isClosed ? toMinutes(hours.opens) : 9 * 60;
    let e = hours && !hours.isClosed ? toMinutes(hours.closes) : 19 * 60;
    for (const a of appointments) {
      s = Math.min(s, toMinutes(a.time));
      e = Math.max(e, toMinutes(a.time) + a.durationMinutes);
    }
    return { start: Math.floor(s / 60) * 60, end: Math.ceil(e / 60) * 60 };
  }, [hours, appointments]);

  const rows = Math.max(1, (end - start) / STEP);
  const px = (min: number) => ((min - start) / STEP) * ROW;
  const isToday = date === ymd(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const columns = staff.filter((s) => s.isActive || appointments.some((a) => a.staff.id === s.id));
  const closed = !hours || hours.isClosed;

  return (
    <div
      className="board"
      style={{ gridTemplateColumns: `56px repeat(${Math.max(1, columns.length)}, minmax(170px, 1fr))` }}
      role="grid"
      aria-label="Günlük randevu defteri"
    >
      <div
        style={{
          position: "sticky",
          top: 0,
          height: 44,
          background: "var(--paper)",
          zIndex: 3,
          borderBottom: "1px solid var(--rule-strong)",
        }}
      />
      {columns.map((s) => {
        const count = appointments.filter((a) => a.staff.id === s.id && a.status !== "CANCELLED").length;
        return (
          <div key={s.id} className="board-head" role="columnheader">
            {s.name}
            <small>{count ? `${count} randevu` : "boş"}</small>
          </div>
        );
      })}

      <div className="board-times">
        {Array.from({ length: rows }, (_, i) => {
          const m = start + i * STEP;
          return (
            <div key={m} className="board-time" data-hour={m % 60 === 0}>
              {m % 60 === 0 ? hhmm(m) : ""}
            </div>
          );
        })}
      </div>

      {columns.map((s) => (
        <div key={s.id} className="board-col" style={{ height: rows * ROW }} role="gridcell">
          {closed ? <div className="board-off" style={{ top: 0, height: rows * ROW }} title="Salon kapalı" /> : null}
          {!closed && hours ? (
            <>
              <div className="board-off" style={{ top: 0, height: px(toMinutes(hours.opens)) }} />
              <div
                className="board-off"
                style={{ top: px(toMinutes(hours.closes)), height: px(end) - px(toMinutes(hours.closes)) }}
              />
            </>
          ) : null}

          {onEmptyClick && !closed
            ? Array.from({ length: rows }, (_, i) => {
                const m = start + i * STEP;
                const past = isToday && m + STEP <= nowMin;
                if (past || (hours && (m < toMinutes(hours.opens) || m >= toMinutes(hours.closes)))) return null;
                return (
                  <button
                    key={m}
                    type="button"
                    aria-label={`${s.name} için ${hhmm(m)} randevusu ekle`}
                    onClick={() => onEmptyClick(s.id, hhmm(m))}
                    style={{
                      position: "absolute",
                      top: i * ROW,
                      height: ROW,
                      left: 0,
                      right: 0,
                      border: 0,
                      background: "transparent",
                      cursor: "copy",
                    }}
                    className="board-slot"
                  />
                );
              })
            : null}

          {appointments
            .filter((a) => a.staff.id === s.id)
            .sort((a, b) => (a.status === "CANCELLED" ? -1 : 0) - (b.status === "CANCELLED" ? -1 : 0))
            .map((a) => {
              const top = px(toMinutes(a.time));
              const height = Math.max(ROW - 2, (a.durationMinutes / STEP) * ROW - 2);
              return (
                <Link
                  key={a.id}
                  to={`/salon/randevular/${a.id}`}
                  className="appt"
                  data-status={a.status}
                  style={{ top: top + 1, height }}
                  title={`${a.time}–${a.endTime} · ${a.customer.name} · ${a.services.map((x) => x.name).join(", ")}`}
                >
                  <b>{a.customer.name}</b>
                  <span className="t">
                    {a.time}–{a.endTime}
                    {a.source === "APP" ? " · uygulama" : ""}
                  </span>
                  {height > 60 ? (
                    <span className="small" style={{ display: "block" }}>
                      {a.services.map((x) => x.name).join(", ")}
                    </span>
                  ) : null}
                </Link>
              );
            })}

          {isToday && nowMin >= start && nowMin <= end ? (
            <div
              className="now-line"
              style={{ top: px(nowMin) }}
              data-time={s === columns[0] ? hhmm(nowMin) : undefined}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}
