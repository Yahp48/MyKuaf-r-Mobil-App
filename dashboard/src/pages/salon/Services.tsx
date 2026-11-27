import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Tag, Trash } from "@phosphor-icons/react";
import { api, ApiError, fieldErrors } from "../../lib/api";
import { usePageMeta } from "../../lib/seo";
import { addDays, dateShort, money, ymd } from "../../lib/format";
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
const PERCENTS = [10, 15, 20, 25, 30, 40, 50];

/** Sunucudaki yuvarlamayla aynı: tam TL */
const discounted = (price: number, percent: number) => Math.round((price * (100 - percent)) / 100);

const DISCOUNT_STATUS = {
  ACTIVE: { tone: "accent", label: "İndirimde" },
  SCHEDULED: { tone: "warn", label: "Planlandı" },
  ENDED: { tone: "faint", label: "İndirim bitti" },
} as const;

export default function Services() {
  usePageMeta({ title: "Hizmetler ve fiyatlar" });
  const q = useServices();
  const qc = useQueryClient();
  const toast = useToast();
  const [edit, setEdit] = useState<Service | "new" | null>(null);
  const [campaign, setCampaign] = useState(false);

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
          <>
            {q.data?.length ? (
              <Button onClick={() => setCampaign(true)}>
                <Tag size={16} /> Toplu indirim
              </Button>
            ) : null}
            <Button variant="primary" onClick={() => setEdit("new")}>
              <Plus size={16} /> Hizmet ekle
            </Button>
          </>
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
                <th>İndirim</th>
                <th>Durum</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {q.data!.map((s) => {
                const d = s.discount && s.discount.status !== "ENDED" ? s.discount : null;
                return (
                  <tr key={s.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{s.name}</div>
                      {s.description ? <div className="small faint">{s.description}</div> : null}
                    </td>
                    <td className="right mono" style={{ whiteSpace: "nowrap" }}>
                      {s.durationMinutes} dk
                    </td>
                    <td className="right mono" style={{ whiteSpace: "nowrap" }}>
                      {d?.status === "ACTIVE" ? (
                        <>
                          <span className="price-old">{money(s.price)}</span>
                          {money(d.price)}
                        </>
                      ) : (
                        money(s.price)
                      )}
                    </td>
                    <td>
                      {s.discount ? (
                        <span>
                          <Stamp tone={DISCOUNT_STATUS[s.discount.status].tone}>
                            %{s.discount.percent} · {DISCOUNT_STATUS[s.discount.status].label}
                          </Stamp>
                          <span className="small faint" style={{ display: "block", marginTop: 4 }}>
                            {dateShort(s.discount.startsOn)} – {dateShort(s.discount.endsOn)}
                          </span>
                        </span>
                      ) : (
                        <span className="faint">—</span>
                      )}
                    </td>
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
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="small faint" style={{ marginTop: 16, maxWidth: 680 }}>
        İndirimler, uygulamada indirimli fiyat ve eski fiyatla birlikte gösterilir ve yalnızca seçilen tarihlerdeki
        randevulara uygulanır. Tüketiciyi yanıltmamak için son 30 günde fiyatı artırılan hizmette indirim başlatılamaz;
        indirim sürerken fiyat artırılamaz.
      </p>
      <ServiceDialog value={edit} onClose={() => setEdit(null)} />
      <CampaignDialog open={campaign} services={q.data ?? []} onClose={() => setCampaign(false)} />
    </>
  );
}

/** İndirim alanları: oran + tarih aralığı + önizleme. */
function DiscountFields({
  price,
  percent,
  setPercent,
  from,
  setFrom,
  to,
  setTo,
  allowedFrom,
}: {
  price: number | null;
  percent: number;
  setPercent: (v: number) => void;
  from: string;
  setFrom: (v: string) => void;
  to: string;
  setTo: (v: string) => void;
  allowedFrom?: string | null;
}) {
  return (
    <div className="discount-box">
      <div className="field">
        <label htmlFor="disc-pct">İndirim oranı</label>
        <select id="disc-pct" className="select" value={percent} onChange={(e) => setPercent(Number(e.target.value))}>
          {[...new Set([...PERCENTS, percent])]
            .sort((a, b) => a - b)
            .map((p) => (
              <option key={p} value={p}>
                %{p}
              </option>
            ))}
        </select>
      </div>
      <div className="form-row">
        <Input label="Başlangıç" type="date" value={from} min={ymd()} onChange={(e) => setFrom(e.target.value)} />
        <Input
          label="Bitiş"
          type="date"
          value={to}
          min={from || ymd()}
          max={from ? addDays(from, 90) : undefined}
          onChange={(e) => setTo(e.target.value)}
        />
      </div>
      {price !== null && Number.isFinite(price) ? (
        <p className="small" style={{ margin: 0 }}>
          Müşteri görür: <span className="price-old">{money(price)}</span>
          <strong>{money(discounted(price, percent))}</strong>
        </p>
      ) : null}
      {allowedFrom ? (
        <p className="small" style={{ margin: 0, color: "var(--bad, #a33)" }}>
          Bu hizmetin fiyatı yakın zamanda artırıldı; indirim en erken {dateShort(allowedFrom)} tarihinde
          başlatılabilir.
        </p>
      ) : null}
    </div>
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
  const [hasDiscount, setHasDiscount] = useState(false);
  const [percent, setPercent] = useState(20);
  const [from, setFrom] = useState(ymd());
  const [to, setTo] = useState(addDays(ymd(), 14));
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!value) return;
    const s = isNew ? null : value;
    setName(s?.name ?? "");
    setDescription(s?.description ?? "");
    setDuration(s?.durationMinutes ?? 30);
    setPrice(s ? String(s.price).replace(".", ",") : "");
    setActive(s?.isActive ?? true);
    const d = s?.discount && s.discount.status !== "ENDED" ? s.discount : null;
    setHasDiscount(!!d);
    setPercent(d?.percent ?? 20);
    setFrom(d?.startsOn ?? ymd());
    setTo(d?.endsOn ?? addDays(ymd(), 14));
    setErrors({});
  }, [value, isNew]);

  const priceNum = Number(price.replace(",", "."));
  const hadDiscount = !isNew && !!(value as Service | null)?.discount;
  const save = useMutation({
    mutationFn: () => {
      const discount = hasDiscount
        ? { discountPercent: percent, discountStartsOn: from, discountEndsOn: to }
        : hadDiscount
          ? { discountPercent: null }
          : {};
      const body = {
        name: name.trim(),
        description: description.trim() || null,
        durationMinutes: duration,
        price: priceNum,
        isActive: active,
        ...discount,
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

  const invalidDiscount = hasDiscount && (!from || !to || to < from);

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
            disabled={name.trim().length < 2 || !Number.isFinite(priceNum) || priceNum < 0 || !price || invalidDiscount}
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
      <Switch checked={hasDiscount} onChange={setHasDiscount} label="İndirim uygula" />
      {hasDiscount ? (
        <DiscountFields
          price={price ? priceNum : null}
          percent={percent}
          setPercent={setPercent}
          from={from}
          setFrom={setFrom}
          to={to}
          setTo={setTo}
          allowedFrom={isNew ? null : (value as Service).discountAllowedFrom}
        />
      ) : null}
      {!isNew ? <Switch checked={active} onChange={setActive} label="Uygulamada sunulsun" /> : null}
    </Dialog>
  );
}

/** Birden çok hizmete aynı indirimi uygular (ör. "Aralık boyunca boyalarda %20"). */
function CampaignDialog({ open, services, onClose }: { open: boolean; services: Service[]; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const active = services.filter((s) => s.isActive);
  const [picked, setPicked] = useState<string[]>([]);
  const [percent, setPercent] = useState(20);
  const [from, setFrom] = useState(ymd());
  const [to, setTo] = useState(addDays(ymd(), 14));

  useEffect(() => {
    if (open) {
      setPicked([]);
      setPercent(20);
      setFrom(ymd());
      setTo(addDays(ymd(), 14));
    }
  }, [open]);

  const apply = useMutation({
    mutationFn: async () => {
      const failed: string[] = [];
      for (const id of picked) {
        try {
          await api.patch(`/business/salon/services/${id}`, {
            discountPercent: percent,
            discountStartsOn: from,
            discountEndsOn: to,
          });
        } catch (e) {
          const s = services.find((x) => x.id === id);
          failed.push(`${s?.name ?? "Hizmet"}: ${e instanceof ApiError ? e.message : "uygulanamadı"}`);
        }
      }
      return failed;
    },
    onSuccess: (failed) => {
      void qc.invalidateQueries({ queryKey: ["salon"] });
      if (failed.length) toast(failed.join(" · "), "bad");
      else toast(`${picked.length} hizmete %${percent} indirim uygulandı`);
      if (failed.length < picked.length) onClose();
    },
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Toplu indirim"
      wide
      footer={
        <>
          <Button onClick={onClose}>Vazgeç</Button>
          <Button
            variant="primary"
            loading={apply.isPending}
            disabled={!picked.length || !from || !to || to < from}
            onClick={() => apply.mutate()}
          >
            {picked.length ? `${picked.length} hizmete uygula` : "Hizmet seçin"}
          </Button>
        </>
      }
    >
      <div className="field">
        <span className="label">Hizmetler</span>
        <div className="rows">
          {active.map((s) => (
            <label key={s.id} className="row" style={{ cursor: "pointer" }}>
              <input
                type="checkbox"
                aria-label={s.name}
                checked={picked.includes(s.id)}
                onChange={(e) => setPicked((p) => (e.target.checked ? [...p, s.id] : p.filter((x) => x !== s.id)))}
              />
              <span className="grow">{s.name}</span>
              <span className="mono small">
                <span className="price-old">{money(s.price)}</span>
                {money(discounted(s.price, percent))}
              </span>
            </label>
          ))}
        </div>
      </div>
      <DiscountFields
        price={null}
        percent={percent}
        setPercent={setPercent}
        from={from}
        setFrom={setFrom}
        to={to}
        setTo={setTo}
      />
    </Dialog>
  );
}
