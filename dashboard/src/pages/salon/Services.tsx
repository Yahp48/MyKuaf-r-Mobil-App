import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash } from "@phosphor-icons/react";
import { api, ApiError, fieldErrors } from "../../lib/api";
import { usePageMeta } from "../../lib/seo";
import { money } from "../../lib/format";
import {
  Button,
  Dialog,
  Empty,
  ErrorBox,
  Input,
  Loading,
  PageHead,
  Stamp,
  Switch,
  Textarea,
} from "../../components/ui";
import { useToast } from "../../components/Toast";
import type { Service } from "../../lib/types";
import { useServices } from "./queries";

const DURATIONS = [15, 20, 30, 45, 60, 75, 90, 120, 150, 180, 240];

export default function Services() {
  usePageMeta({ title: "Hizmetler ve fiyatlar" });
  const q = useServices();
  const qc = useQueryClient();
  const toast = useToast();
  const [edit, setEdit] = useState<Service | "new" | null>(null);

  const remove = useMutation({
    mutationFn: (s: Service) => api.del<{ deleted: boolean }>(`/business/salon/services/${s.id}`),
    onSuccess: (r) => {
      toast(r.deleted ? "Hizmet silindi" : "Geçmiş randevularda kullanıldığı için pasife alındı");
      void qc.invalidateQueries({ queryKey: ["salon"] });
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Silinemedi", "bad"),
  });

  return (
    <>
      <PageHead
        kicker="Salon"
        title="Hizmetler ve fiyatlar"
        sub="Süre, müşterinin uygulamada göreceği boş saatleri belirler. Fiyat değişikliği alınmış randevuları etkilemez."
        actions={
          <Button variant="primary" onClick={() => setEdit("new")}>
            <Plus size={16} /> Hizmet ekle
          </Button>
        }
      />
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <ErrorBox error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data!.length ? (
        <Empty
          title="Henüz hizmet yok"
          action={
            <Button variant="primary" onClick={() => setEdit("new")}>
              İlk hizmeti ekle
            </Button>
          }
        >
          Örn. Saç kesimi · 30 dk · 250 TL
        </Empty>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Hizmet</th>
                <th className="right">Süre</th>
                <th className="right">Fiyat</th>
                <th>Durum</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {q.data!.map((s) => (
                <tr key={s.id}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{s.name}</div>
                    {s.description ? <div className="small faint">{s.description}</div> : null}
                  </td>
                  <td className="right mono">{s.durationMinutes} dk</td>
                  <td className="right mono">{money(s.price)}</td>
                  <td>{s.isActive ? <Stamp tone="ok">Satışta</Stamp> : <Stamp tone="faint">Pasif</Stamp>}</td>
                  <td className="right" style={{ whiteSpace: "nowrap" }}>
                    <Button size="sm" variant="quiet" onClick={() => setEdit(s)}>
                      Düzenle
                    </Button>
                    <Button
                      size="sm"
                      variant="quiet"
                      aria-label={`${s.name} hizmetini sil`}
                      onClick={() => confirm(`"${s.name}" silinsin mi?`) && remove.mutate(s)}
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
      <ServiceDialog value={edit} onClose={() => setEdit(null)} />
    </>
  );
}

function ServiceDialog({ value, onClose }: { value: Service | "new" | null; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const isNew = value === "new";
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState(30);
  const [price, setPrice] = useState("");
  const [active, setActive] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!value) return;
    const s = isNew ? null : value;
    setName(s?.name ?? "");
    setDescription(s?.description ?? "");
    setDuration(s?.durationMinutes ?? 30);
    setPrice(s ? String(s.price).replace(".", ",") : "");
    setActive(s?.isActive ?? true);
    setErrors({});
  }, [value, isNew]);

  const priceNum = Number(price.replace(",", "."));
  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: name.trim(),
        description: description.trim() || null,
        durationMinutes: duration,
        price: priceNum,
        isActive: active,
      };
      return isNew
        ? api.post("/business/salon/services", body)
        : api.patch(`/business/salon/services/${(value as Service).id}`, body);
    },
    onSuccess: () => {
      toast(isNew ? "Hizmet eklendi" : "Kaydedildi");
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
      title={isNew ? "Hizmet ekle" : "Hizmeti düzenle"}
      footer={
        <>
          <Button onClick={onClose}>Vazgeç</Button>
          <Button
            variant="primary"
            loading={save.isPending}
            disabled={name.trim().length < 2 || !Number.isFinite(priceNum) || priceNum < 0 || !price}
            onClick={() => save.mutate()}
          >
            Kaydet
          </Button>
        </>
      }
    >
      <Input label="Hizmet adı" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} autoFocus />
      <div className="form-row">
        <div className="field">
          <label htmlFor="svc-dur">Süre</label>
          <select
            id="svc-dur"
            className="select"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
          >
            {[...new Set([...DURATIONS, duration])]
              .sort((a, b) => a - b)
              .map((d) => (
                <option key={d} value={d}>
                  {d} dakika
                </option>
              ))}
          </select>
        </div>
        <Input
          label="Fiyat (TL)"
          inputMode="decimal"
          value={price}
          onChange={(e) => setPrice(e.target.value.replace(/[^\d.,]/g, ""))}
          error={errors.price}
          className="input mono"
        />
      </div>
      <Textarea
        label="Açıklama (isteğe bağlı)"
        rows={2}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={300}
      />
      {!isNew ? <Switch checked={active} onChange={setActive} label="Uygulamada sunulsun" /> : null}
    </Dialog>
  );
}
