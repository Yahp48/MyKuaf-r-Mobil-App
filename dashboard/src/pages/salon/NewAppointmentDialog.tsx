import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, fieldErrors } from "../../lib/api";
import { money, ymd } from "../../lib/format";
import { isMobile } from "../../lib/validators";
import { Button, Dialog, Input, Select, Textarea } from "../../components/ui";
import { useToast } from "../../components/Toast";
import { useServices, useStaff } from "./queries";
import type { Appointment } from "../../lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  initialDate?: string;
  initialStaffId?: string;
  initialTime?: string;
  onCreated?: (a: Appointment) => void;
}

/** Telefonla veya kapıdan gelen müşteri için randevu. Boş saatler sunucudan, çakışma sunucuda engellenir. */
export function NewAppointmentDialog({ open, onClose, initialDate, initialStaffId, initialTime, onCreated }: Props) {
  const qc = useQueryClient();
  const toast = useToast();
  const staff = useStaff();
  const services = useServices();
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [staffId, setStaffId] = useState("");
  const [date, setDate] = useState(initialDate ?? ymd());
  const [time, setTime] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const activeStaff = useMemo(() => (staff.data ?? []).filter((s) => s.isActive), [staff.data]);
  const activeServices = useMemo(() => (services.data ?? []).filter((s) => s.isActive), [services.data]);

  useEffect(() => {
    if (!open) return;
    setDate(initialDate ?? ymd());
    setStaffId(initialStaffId ?? "");
    setTime(initialTime ?? "");
    setServiceIds([]);
    setName("");
    setPhone("");
    setNote("");
    setErrors({});
  }, [open, initialDate, initialStaffId, initialTime]);

  useEffect(() => {
    if (!staffId && activeStaff[0]) setStaffId(activeStaff[0].id);
  }, [activeStaff, staffId]);

  const slots = useQuery({
    queryKey: ["salon", "availability", date, staffId, serviceIds.join(",")],
    queryFn: () =>
      api.get<{ staff: { staffId: string; slots: string[] }[] }>("/business/salon/availability", {
        date,
        serviceIds,
        staffId,
      }),
    enabled: open && !!staffId && serviceIds.length > 0 && !!date,
  });
  const available = slots.data?.staff[0]?.slots ?? [];

  useEffect(() => {
    if (time && slots.data && !available.includes(time)) setTime("");
  }, [available, slots.data, time]);

  const selected = activeServices.filter((s) => serviceIds.includes(s.id));
  const total = selected.reduce((n, s) => n + s.price, 0);
  const duration = selected.reduce((n, s) => n + s.durationMinutes, 0);

  const create = useMutation({
    mutationFn: () =>
      api.post<{ appointment: Appointment }>("/business/salon/appointments", {
        staffId,
        serviceIds,
        date,
        time,
        customerName: name.trim(),
        customerPhone: phone,
        businessNote: note.trim() || undefined,
      }),
    onSuccess: ({ appointment }) => {
      toast(`${appointment.customer.name} · ${appointment.time} randevusu deftere yazıldı`);
      void qc.invalidateQueries({ queryKey: ["salon"] });
      onCreated?.(appointment);
      onClose();
    },
    onError: (e) => {
      setErrors(fieldErrors(e));
      toast(e instanceof ApiError ? e.message : "Randevu eklenemedi", "bad");
    },
  });

  const submit = () => {
    const e: Record<string, string> = {};
    if (!serviceIds.length) e.serviceIds = "En az bir hizmet seçin";
    if (!time) e.time = "Boş bir saat seçin";
    if (name.trim().length < 2) e.customerName = "Müşteri adını yazın";
    if (!isMobile(phone)) e.customerPhone = "Cep telefonu 05XX XXX XX XX";
    setErrors(e);
    if (!Object.keys(e).length) create.mutate();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Deftere randevu yaz"
      wide
      footer={
        <>
          <span className="muted small" style={{ marginRight: "auto" }}>
            {selected.length ? `${duration} dk · ${money(total)}` : "Hizmet seçin"}
          </span>
          <Button onClick={onClose}>Vazgeç</Button>
          <Button variant="primary" onClick={submit} loading={create.isPending}>
            Randevuyu kaydet
          </Button>
        </>
      }
    >
      <div className="field">
        <span>Hizmetler</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {activeServices.map((s) => {
            const on = serviceIds.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                className="btn btn-sm"
                aria-pressed={on}
                style={on ? { background: "var(--ink)", color: "var(--leaf)", borderColor: "var(--ink)" } : undefined}
                onClick={() => setServiceIds((ids) => (on ? ids.filter((x) => x !== s.id) : [...ids, s.id]))}
              >
                {s.name}{" "}
                <span className="mono" style={{ opacity: 0.7 }}>
                  {s.durationMinutes}′
                </span>
              </button>
            );
          })}
        </div>
        {errors.serviceIds ? <span className="error">{errors.serviceIds}</span> : null}
        {!activeServices.length && !services.isLoading ? (
          <span className="hint">Önce Hizmetler sayfasından hizmet ekleyin.</span>
        ) : null}
      </div>

      <div className="form-row">
        <Select label="Personel" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
          {activeStaff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <Input label="Tarih" type="date" value={date} min={ymd()} onChange={(e) => setDate(e.target.value)} />
      </div>

      <div className="field">
        <span>Saat</span>
        {!serviceIds.length ? (
          <span className="hint">Boş saatleri görmek için hizmet seçin.</span>
        ) : slots.isLoading ? (
          <span className="hint">Boş saatler yükleniyor…</span>
        ) : available.length === 0 ? (
          <span className="hint">Bu gün bu personel için boş saat yok (salon kapalı, izin veya dolu).</span>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {available.map((t) => (
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
        {errors.time ? <span className="error">{errors.time}</span> : null}
      </div>

      <div className="form-row">
        <Input
          label="Müşteri adı soyadı"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.customerName}
        />
        <Input
          label="Cep telefonu"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          error={errors.customerPhone}
          placeholder="05XX XXX XX XX"
        />
      </div>
      <Textarea
        label="Salon notu (müşteri görmez)"
        rows={2}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={500}
      />
    </Dialog>
  );
}
