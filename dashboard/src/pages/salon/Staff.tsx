import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash } from "@phosphor-icons/react";
import { api, ApiError, fieldErrors } from "../../lib/api";
import { usePageMeta } from "../../lib/seo";
import { dateTime, moneyShort } from "../../lib/format";
import { Button, Dialog, Empty, ErrorBox, Input, Loading, PageHead, Stamp, Switch } from "../../components/ui";
import { useToast } from "../../components/Toast";
import type { Staff as StaffT } from "../../lib/types";
import { useStaff } from "./queries";

export default function Staff() {
  usePageMeta({ title: "Personel" });
  const q = useStaff();
  const qc = useQueryClient();
  const toast = useToast();
  const [edit, setEdit] = useState<StaffT | "new" | null>(null);
  const [leave, setLeave] = useState<StaffT | null>(null);

  const remove = useMutation({
    mutationFn: (s: StaffT) => api.del<{ deleted: boolean }>(`/business/salon/staff/${s.id}`),
    onSuccess: (r) => {
      toast(r.deleted ? "Personel silindi" : "Geçmiş randevuları olduğu için pasife alındı");
      void qc.invalidateQueries({ queryKey: ["salon"] });
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Silinemedi", "bad"),
  });

  return (
    <>
      <PageHead
        kicker="Salon"
        title="Personel"
        sub="Randevu defterinde her personel bir sütundur. Pasif personel uygulamada seçilemez."
        actions={
          <Button variant="primary" onClick={() => setEdit("new")}>
            <Plus size={16} /> Personel ekle
          </Button>
        }
      />
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <ErrorBox error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data!.length ? (
        <Empty
          title="Henüz personel yok"
          action={
            <Button variant="primary" onClick={() => setEdit("new")}>
              İlk personeli ekle
            </Button>
          }
        >
          Müşteriler randevu alırken personel seçer veya "fark etmez" der.
        </Empty>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Ad</th>
                <th>Ünvan</th>
                <th className="right">Bu ay tamamlanan</th>
                <th className="right">Bu ay ciro</th>
                <th className="right">İleri randevu</th>
                <th>Durum</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {q.data!.map((s) => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 500 }}>{s.name}</td>
                  <td className="muted">{s.title ?? "—"}</td>
                  <td className="right mono">{s.monthCompleted}</td>
                  <td className="right mono">{moneyShort(s.monthRevenue ?? 0)}</td>
                  <td className="right mono">{s.upcomingCount}</td>
                  <td>{s.isActive ? <Stamp tone="ok">Aktif</Stamp> : <Stamp tone="faint">Pasif</Stamp>}</td>
                  <td className="right" style={{ whiteSpace: "nowrap" }}>
                    <Button size="sm" variant="quiet" onClick={() => setLeave(s)}>
                      İzinler
                    </Button>
                    <Button size="sm" variant="quiet" onClick={() => setEdit(s)}>
                      Düzenle
                    </Button>
                    <Button
                      size="sm"
                      variant="quiet"
                      aria-label={`${s.name} personelini sil`}
                      onClick={() => {
                        if (confirm(`${s.name} silinsin mi? Geçmiş randevuları varsa pasife alınır.`)) remove.mutate(s);
                      }}
                    >
                      <Trash size={16} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <StaffDialog value={edit} onClose={() => setEdit(null)} />
      <LeaveDialog staff={leave} onClose={() => setLeave(null)} />
    </>
  );
}

function StaffDialog({ value, onClose }: { value: StaffT | "new" | null; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const isNew = value === "new";
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [active, setActive] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!value) return;
    setName(isNew ? "" : value.name);
    setTitle(isNew ? "" : (value.title ?? ""));
    setActive(isNew ? true : value.isActive);
    setErrors({});
  }, [value, isNew]);

  const save = useMutation({
    mutationFn: () => {
      const body = { name: name.trim(), title: title.trim() || null, isActive: active };
      return isNew
        ? api.post("/business/salon/staff", body)
        : api.patch(`/business/salon/staff/${(value as StaffT).id}`, body);
    },
    onSuccess: () => {
      toast(isNew ? "Personel eklendi" : "Kaydedildi");
      void qc.invalidateQueries({ queryKey: ["salon"] });
      onClose();
    },
    onError: (e) => {
      setErrors(fieldErrors(e));
      toast(e instanceof ApiError ? e.message : "Kaydedilemedi", "bad");
    },
  });

  return (
    <Dialog
      open={!!value}
      onClose={onClose}
      title={isNew ? "Personel ekle" : "Personeli düzenle"}
      footer={
        <>
          <Button onClick={onClose}>Vazgeç</Button>
          <Button
            variant="primary"
            loading={save.isPending}
            disabled={name.trim().length < 2}
            onClick={() => save.mutate()}
          >
            Kaydet
          </Button>
        </>
      }
    >
      <Input label="Ad soyad" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} autoFocus />
      <Input
        label="Ünvan (isteğe bağlı)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Kuaför, renk uzmanı…"
      />
      {!isNew ? <Switch checked={active} onChange={setActive} label="Randevu alabilir (aktif)" /> : null}
    </Dialog>
  );
}

interface TimeOff {
  id: string;
  startsAt: string;
  endsAt: string;
  reason: string | null;
}

function LeaveDialog({ staff, onClose }: { staff: StaffT | null; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const list = useQuery({
    queryKey: ["salon", "timeoff", staff?.id],
    queryFn: () => api.get<{ items: TimeOff[] }>(`/business/salon/staff/${staff!.id}/time-off`).then((r) => r.items),
    enabled: !!staff,
  });
  const add = useMutation({
    mutationFn: () =>
      api.post(`/business/salon/staff/${staff!.id}/time-off`, {
        startsAt: new Date(from).toISOString(),
        endsAt: new Date(to).toISOString(),
        reason: reason.trim() || undefined,
      }),
    onSuccess: () => {
      toast("İzin eklendi; bu aralıkta randevu alınamaz");
      setFrom("");
      setTo("");
      setReason("");
      void qc.invalidateQueries({ queryKey: ["salon"] });
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Eklenemedi", "bad"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/business/salon/staff/${staff!.id}/time-off/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["salon"] }),
  });

  return (
    <Dialog open={!!staff} onClose={onClose} title={`${staff?.name ?? ""} · izinler`} wide>
      <div className="form-row">
        <Input label="Başlangıç" type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input label="Bitiş" type="datetime-local" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
      </div>
      <Input
        label="Sebep (isteğe bağlı)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Yıllık izin, rapor…"
      />
      <Button
        variant="primary"
        onClick={() => add.mutate()}
        loading={add.isPending}
        disabled={!from || !to || to <= from}
      >
        İzni ekle
      </Button>

      <div className="rows" style={{ marginTop: 24 }}>
        {list.data?.length === 0 ? (
          <p className="muted small" style={{ padding: "12px 0" }}>
            Kayıtlı izin yok.
          </p>
        ) : null}
        {list.data?.map((t) => (
          <div key={t.id} className="row">
            <span className="grow">
              <span className="mono small">
                {dateTime(t.startsAt)} → {dateTime(t.endsAt)}
              </span>
              <span className="muted small" style={{ display: "block" }}>
                {t.reason ?? "İzin"}
              </span>
            </span>
            <Button size="sm" variant="quiet" onClick={() => remove.mutate(t.id)} aria-label="İzni sil">
              <Trash size={16} />
            </Button>
          </div>
        ))}
      </div>
    </Dialog>
  );
}
