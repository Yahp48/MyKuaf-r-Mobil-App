import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Phone } from "@phosphor-icons/react";
import { api, ApiError } from "../../lib/api";
import { usePageMeta } from "../../lib/seo";
import { dateTime, formatPhone, money, weekdayLong, ymd } from "../../lib/format";
import {
  Button,
  Dialog,
  ErrorBox,
  Input,
  Loading,
  PageHead,
  Select,
  Stamp,
  Stars,
  Textarea,
} from "../../components/ui";
import { useToast } from "../../components/Toast";
import type { Appointment, AppointmentStatus } from "../../lib/types";
import { STATUS, useStaff } from "./queries";

export default function AppointmentDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({
    queryKey: ["salon", "appointment", id],
    queryFn: () => api.get<{ appointment: Appointment; history: Appointment[] }>(`/business/salon/appointments/${id}`),
  });
  usePageMeta({ title: q.data ? `Randevu · ${q.data.appointment.customer.name}` : "Randevu" });

  const [cancelOpen, setCancelOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  useEffect(() => setNote(q.data?.appointment.businessNote ?? ""), [q.data?.appointment.businessNote]);

  const done = (msg: string) => {
    toast(msg);
    void qc.invalidateQueries({ queryKey: ["salon"] });
  };
  const fail = (e: unknown) => toast(e instanceof ApiError ? e.message : "İşlem yapılamadı", "bad");

  const setStatus = useMutation({
    mutationFn: (body: { status: AppointmentStatus; reason?: string }) =>
      api.post<{ appointment: Appointment }>(`/business/salon/appointments/${id}/status`, body),
    onSuccess: (_r, v) => {
      setCancelOpen(false);
      done(
        {
          CONFIRMED: "Randevu onaylandı, müşteriye bildirildi",
          COMPLETED: "Randevu tamamlandı olarak işaretlendi",
          NO_SHOW: "Gelmedi olarak işaretlendi",
          CANCELLED: "Randevu iptal edildi",
          PENDING: "",
        }[v.status],
      );
    },
    onError: fail,
  });

  const saveNote = useMutation({
    mutationFn: () => api.patch(`/business/salon/appointments/${id}`, { businessNote: note.trim() || null }),
    onSuccess: () => done("Not kaydedildi"),
    onError: fail,
  });

  if (q.isLoading) return <Loading rows={6} />;
  if (q.error) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;
  const { appointment: a, history } = q.data!;
  const started = new Date(a.startsAt) <= new Date();
  const active = a.status === "PENDING" || a.status === "CONFIRMED";

  return (
    <>
      <Link
        to={`/salon/randevular?gun=${a.date}`}
        className="small muted"
        style={{ display: "inline-flex", gap: 6, alignItems: "center", marginBottom: 16 }}
      >
        <ArrowLeft size={14} /> {weekdayLong(a.date)} defterine dön
      </Link>
      <PageHead
        kicker={
          <>
            Randevu <span className="mono">{a.code}</span> · {a.source === "APP" ? "uygulamadan" : "salon girdi"}
          </>
        }
        title={a.customer.name}
        sub={
          <>
            {weekdayLong(a.date)},{" "}
            <span className="mono">
              {a.time}–{a.endTime}
            </span>{" "}
            · {a.staff.name}
          </>
        }
        actions={<Stamp tone={STATUS[a.status].tone}>{STATUS[a.status].label}</Stamp>}
      />

      <div className="grid-2">
        <div>
          <section aria-labelledby="actions">
            <h2 id="actions" className="sr-only">
              İşlemler
            </h2>
            <div className="page-actions" style={{ marginBottom: 28 }}>
              {a.status === "PENDING" ? (
                <Button
                  variant="accent"
                  loading={setStatus.isPending}
                  onClick={() => setStatus.mutate({ status: "CONFIRMED" })}
                >
                  Onayla
                </Button>
              ) : null}
              {(a.status === "CONFIRMED" || a.status === "NO_SHOW") && started ? (
                <Button
                  variant="primary"
                  loading={setStatus.isPending}
                  onClick={() => setStatus.mutate({ status: "COMPLETED" })}
                >
                  Tamamlandı
                </Button>
              ) : null}
              {a.status === "CONFIRMED" && started ? (
                <Button onClick={() => setStatus.mutate({ status: "NO_SHOW" })}>Gelmedi</Button>
              ) : null}
              {active ? <Button onClick={() => setMoveOpen(true)}>Saati / personeli değiştir</Button> : null}
              {active ? (
                <Button variant="danger" onClick={() => setCancelOpen(true)}>
                  İptal et
                </Button>
              ) : null}
              {a.customer.phone ? (
                <a className="btn btn-quiet" href={`tel:${a.customer.phone}`}>
                  <Phone size={16} /> Ara
                </a>
              ) : null}
            </div>
            {!started && a.status === "CONFIRMED" ? (
              <p className="small faint" style={{ marginTop: -16, marginBottom: 24 }}>
                "Tamamlandı" ve "Gelmedi" randevu saati gelince açılır.
              </p>
            ) : null}
          </section>

          <section className="section" style={{ marginTop: 0 }}>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Hizmet</th>
                    <th className="right">Süre</th>
                    <th className="right">Fiyat</th>
                  </tr>
                </thead>
                <tbody>
                  {a.services.map((s) => (
                    <tr key={s.id}>
                      <td>{s.name}</td>
                      <td className="right mono">{s.durationMinutes} dk</td>
                      <td className="right mono">{money(s.price)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td style={{ fontWeight: 600 }}>Toplam · salonda tahsil edilir</td>
                    <td className="right mono">{a.durationMinutes} dk</td>
                    <td className="right mono" style={{ fontWeight: 600 }}>
                      {money(a.total)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {a.customerNote ? (
            <section className="section">
              <h2 style={{ fontSize: 18, marginBottom: 8 }}>Müşterinin notu</h2>
              <blockquote
                style={{ margin: 0, paddingLeft: 14, borderLeft: "2px solid var(--accent)", fontStyle: "italic" }}
              >
                {a.customerNote}
              </blockquote>
            </section>
          ) : null}

          {a.status === "CANCELLED" ? (
            <div className="alert section" role="note">
              İptal sebebi: {a.cancelReason ?? "—"} {a.cancelledAt ? `· ${dateTime(a.cancelledAt)}` : ""}
            </div>
          ) : null}

          {a.review ? (
            <section className="section">
              <h2 style={{ fontSize: 18, marginBottom: 8 }}>Müşteri değerlendirmesi</h2>
              <Stars value={a.review.rating} /> <span className="muted">{a.review.comment}</span>
            </section>
          ) : null}

          <section className="section">
            <Textarea
              label="Salon notu"
              hint="Yalnızca salon görür. Örn. renk formülü, alerji, tercih ettiği kuaför."
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
            />
            <Button
              size="sm"
              onClick={() => saveNote.mutate()}
              loading={saveNote.isPending}
              disabled={note === (a.businessNote ?? "")}
            >
              Notu kaydet
            </Button>
          </section>
        </div>

        <aside>
          <div className="leaf leaf-pad">
            <div className="label" style={{ marginBottom: 12 }}>
              Müşteri
            </div>
            <dl className="kv">
              <dt>Ad</dt>
              <dd>{a.customer.name}</dd>
              <dt>Telefon</dt>
              <dd className="mono">{formatPhone(a.customer.phone)}</dd>
              <dt>Kaynak</dt>
              <dd>{a.customer.isAppUser ? "Bakımca uygulaması" : "Telefon / kapıdan"}</dd>
              <dt>Kayıt</dt>
              <dd>{dateTime(a.createdAt)}</dd>
            </dl>
          </div>
          <div style={{ marginTop: 24 }}>
            <div className="section-head">
              <h2 style={{ fontSize: 18 }}>Bu salondaki geçmişi</h2>
              <span className="small faint">{history.length} kayıt</span>
            </div>
            {history.length === 0 ? (
              <p className="muted small">İlk ziyareti.</p>
            ) : (
              <div className="rows">
                {history.map((h) => (
                  <Link key={h.id} to={`/salon/randevular/${h.id}`} className="row" style={{ textDecoration: "none" }}>
                    <span className="grow">
                      <span className="small">{new Date(h.startsAt).toLocaleDateString("tr-TR")}</span>
                      <span className="muted small" style={{ display: "block" }}>
                        {h.services.map((s) => s.name).join(", ")} · {h.staff.name}
                      </span>
                    </span>
                    <Stamp tone={STATUS[h.status].tone}>{STATUS[h.status].label}</Stamp>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>

      <Dialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Randevuyu iptal et"
        footer={
          <>
            <Button onClick={() => setCancelOpen(false)}>Vazgeç</Button>
            <Button
              variant="danger"
              loading={setStatus.isPending}
              disabled={reason.trim().length < 3}
              onClick={() => setStatus.mutate({ status: "CANCELLED", reason: reason.trim() })}
            >
              İptal et
            </Button>
          </>
        }
      >
        <p className="muted" style={{ marginBottom: 14 }}>
          {a.customer.isAppUser
            ? "Müşteriye uygulamadan bildirim gönderilir ve yazdığınız sebep iletilir."
            : "Bu müşteri uygulama kullanmıyor; iptali telefonla bildirmeyi unutmayın."}
        </p>
        <Textarea
          label="İptal sebebi"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={300}
          autoFocus
        />
      </Dialog>

      <MoveDialog
        open={moveOpen}
        onClose={() => setMoveOpen(false)}
        appointment={a}
        onDone={() => done("Randevu taşındı")}
      />
    </>
  );
}

function MoveDialog({
  open,
  onClose,
  appointment: a,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  appointment: Appointment;
  onDone: () => void;
}) {
  const staff = useStaff();
  const toast = useToast();
  const [date, setDate] = useState(a.date);
  const [staffId, setStaffId] = useState(a.staff.id);
  const [time, setTime] = useState("");
  useEffect(() => {
    if (open) {
      setDate(a.date);
      setStaffId(a.staff.id);
      setTime("");
    }
  }, [open, a.date, a.staff.id]);

  const slots = useQuery({
    queryKey: ["salon", "availability", "move", a.id, date, staffId],
    queryFn: () =>
      api.get<{ staff: { slots: string[] }[] }>("/business/salon/availability", {
        date,
        staffId,
        serviceIds: a.services.map((s) => s.id),
        excludeAppointmentId: a.id,
      }),
    enabled: open,
  });

  const move = useMutation({
    mutationFn: () => api.patch(`/business/salon/appointments/${a.id}`, { date, time, staffId }),
    onSuccess: () => {
      onDone();
      onClose();
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Taşınamadı", "bad"),
  });

  const list = slots.data?.staff[0]?.slots ?? [];
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Saati / personeli değiştir"
      footer={
        <>
          <Button onClick={onClose}>Vazgeç</Button>
          <Button variant="primary" disabled={!time} loading={move.isPending} onClick={() => move.mutate()}>
            Taşı
          </Button>
        </>
      }
    >
      <div className="form-row">
        <Input label="Tarih" type="date" value={date} min={ymd()} onChange={(e) => setDate(e.target.value)} />
        <Select label="Personel" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
          {(staff.data ?? [])
            .filter((s) => s.isActive)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
        </Select>
      </div>
      <div className="field">
        <span>Yeni saat ({a.durationMinutes} dk)</span>
        {slots.isLoading ? (
          <span className="hint">Yükleniyor…</span>
        ) : list.length === 0 ? (
          <span className="hint">Bu gün uygun saat yok.</span>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {list.map((t) => (
              <button
                key={t}
                type="button"
                className="btn btn-sm mono"
                aria-pressed={time === t}
                style={
                  time === t ? { background: "var(--accent)", color: "#fff", borderColor: "var(--accent)" } : undefined
                }
                onClick={() => setTime(t)}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>
      {a.customer.isAppUser ? <p className="small faint">Müşteriye yeni saat bildirimi gönderilir.</p> : null}
    </Dialog>
  );
}
