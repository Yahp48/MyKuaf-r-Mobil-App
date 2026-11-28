import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ListChecks, Plus, Tag, Trash } from "@phosphor-icons/react";
import { ServiceTemplatesDialog } from "./ServiceTemplates";
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
import type { Service, ServicePackage } from "../../lib/types";
import { usePackages, useServices } from "./queries";

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
  const [templates, setTemplates] = useState(false);

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
            <Button onClick={() => setTemplates(true)}>
              <ListChecks size={16} /> Hazır listeden ekle
            </Button>
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
                      {s.category ? <div className="small faint">{s.category}</div> : null}
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
      <PackagesSection services={q.data ?? []} />
      <ServiceDialog value={edit} onClose={() => setEdit(null)} />
      <CampaignDialog open={campaign} services={q.data ?? []} onClose={() => setCampaign(false)} />
      <ServiceTemplatesDialog open={templates} onClose={() => setTemplates(false)} />
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
  const [category, setCategory] = useState("");
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
    setCategory(s?.category ?? "");
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
        category: category.trim() || null,
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
      <Input
        label="Kategori (isteğe bağlı)"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        placeholder="Örn. Boya ve renk, Kalıcı oje, Masaj"
        hint="Uygulamada hizmet menüsü bu başlıklara göre gruplanır"
      />
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

/** Paketler: birden çok hizmet tek fiyatla (ör. "Gelin paketi"). Fiyat, hizmetlerin toplamını aşamaz. */
function PackagesSection({ services }: { services: Service[] }) {
  const q = usePackages();
  const qc = useQueryClient();
  const toast = useToast();
  const [edit, setEdit] = useState<ServicePackage | "new" | null>(null);
  const remove = useMutation({
    mutationFn: (p: ServicePackage) => api.del(`/business/salon/packages/${p.id}`),
    onSuccess: () => {
      toast("Paket silindi");
      void qc.invalidateQueries({ queryKey: ["salon"] });
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Silinemedi", "bad"),
  });

  return (
    <section style={{ marginTop: 40 }}>
      <div style={{ display: "flex", alignItems: "end", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 21 }}>Paketler</h2>
          <p className="small muted" style={{ margin: "4px 0 0" }}>
            Birden çok hizmeti avantajlı tek fiyatla sunun. Müşteri, liste fiyatı ve tasarrufu birlikte görür.
          </p>
        </div>
        <Button onClick={() => setEdit("new")} disabled={services.filter((s) => s.isActive).length < 2}>
          <Plus size={16} /> Paket ekle
        </Button>
      </div>
      {q.data?.length ? (
        <div className="table-wrap" style={{ marginTop: 16 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Paket</th>
                <th>Hizmetler</th>
                <th className="right">Fiyat</th>
                <th>Durum</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {q.data.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{p.name}</div>
                    {p.description ? <div className="small faint">{p.description}</div> : null}
                  </td>
                  <td className="small">{p.services.map((s) => s.name).join(" + ")}</td>
                  <td className="right mono" style={{ whiteSpace: "nowrap" }}>
                    {p.price < p.listPrice ? <span className="price-old">{money(p.listPrice)}</span> : null}
                    {money(p.price)}
                  </td>
                  <td>{p.isActive ? <Stamp tone="ok">Satışta</Stamp> : <Stamp tone="faint">Pasif</Stamp>}</td>
                  <td className="right" style={{ whiteSpace: "nowrap" }}>
                    <Button size="sm" variant="quiet" onClick={() => setEdit(p)}>
                      Düzenle
                    </Button>
                    <Button
                      size="sm"
                      variant="quiet"
                      aria-label={`${p.name} paketini sil`}
                      onClick={() => confirm(`"${p.name}" silinsin mi?`) && remove.mutate(p)}
                    >
                      <Trash size={16} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="small faint" style={{ marginTop: 16 }}>
          Henüz paket yok.
        </p>
      )}
      <PackageDialog value={edit} services={services} onClose={() => setEdit(null)} />
    </section>
  );
}

function PackageDialog({
  value,
  services,
  onClose,
}: {
  value: ServicePackage | "new" | null;
  services: Service[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const isNew = value === "new";
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [price, setPrice] = useState("");
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (!value) return;
    const p = isNew ? null : value;
    setName(p?.name ?? "");
    setDescription(p?.description ?? "");
    setPicked(p?.services.map((s) => s.id) ?? []);
    setPrice(p ? String(p.price).replace(".", ",") : "");
    setActive(p?.isActive ?? true);
  }, [value, isNew]);

  const usable = services.filter((s) => s.isActive);
  const list = usable.filter((s) => picked.includes(s.id)).reduce((sum, s) => sum + s.price, 0);
  const priceNum = Number(price.replace(",", "."));
  const valid = name.trim().length >= 2 && picked.length >= 2 && price !== "" && priceNum >= 0 && priceNum <= list;

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: name.trim(),
        description: description.trim() || null,
        price: priceNum,
        serviceIds: picked,
        isActive: active,
      };
      return isNew
        ? api.post("/business/salon/packages", body)
        : api.patch(`/business/salon/packages/${(value as ServicePackage).id}`, body);
    },
    onSuccess: () => {
      toast(isNew ? "Paket eklendi" : "Kaydedildi");
      void qc.invalidateQueries({ queryKey: ["salon"] });
      onClose();
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Kaydedilemedi", "bad"),
  });

  return (
    <Dialog
      open={!!value}
      onClose={onClose}
      title={isNew ? "Paket ekle" : "Paketi düzenle"}
      wide
      footer={
        <>
          <Button onClick={onClose}>Vazgeç</Button>
          <Button variant="primary" loading={save.isPending} disabled={!valid} onClick={() => save.mutate()}>
            Kaydet
          </Button>
        </>
      }
    >
      <Input label="Paket adı" value={name} onChange={(e) => setName(e.target.value)} placeholder="Gelin paketi" />
      <Textarea
        label="Açıklama (isteğe bağlı)"
        rows={2}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={300}
      />
      <div className="field">
        <span className="label">Hizmetler (en az 2)</span>
        <div className="rows">
          {usable.map((s) => (
            <label key={s.id} className="row" style={{ cursor: "pointer" }}>
              <input
                type="checkbox"
                aria-label={s.name}
                checked={picked.includes(s.id)}
                onChange={(e) => setPicked((p) => (e.target.checked ? [...p, s.id] : p.filter((x) => x !== s.id)))}
              />
              <span className="grow">{s.name}</span>
              <span className="mono small">{money(s.price)}</span>
            </label>
          ))}
        </div>
      </div>
      <Input
        label="Paket fiyatı (TL)"
        inputMode="decimal"
        value={price}
        onChange={(e) => setPrice(e.target.value.replace(/[^\d.,]/g, ""))}
        className="input mono"
        hint={
          picked.length >= 2
            ? priceNum <= list
              ? `Hizmetlerin toplamı ${money(list)}; müşteri ${money(Math.max(0, list - (priceNum || 0)))} tasarruf eder.`
              : `Paket fiyatı hizmetlerin toplamını (${money(list)}) aşamaz.`
            : "Önce en az 2 hizmet seçin."
        }
      />
      {!isNew ? <Switch checked={active} onChange={setActive} label="Uygulamada sunulsun" /> : null}
    </Dialog>
  );
}
