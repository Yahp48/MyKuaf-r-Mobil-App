import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../lib/api";
import { Button, Dialog, Stamp } from "../../components/ui";
import { useToast } from "../../components/Toast";

interface Template {
  name: string;
  durationMinutes: number;
  description?: string;
  added: boolean;
}
interface Category {
  key: string;
  name: string;
  recommended: boolean;
  items: Template[];
}

type Picked = Record<string, { category: string; duration: string; price: string; description?: string }>;

/**
 * Hazır hizmet kataloğundan toplu ekleme. İşletme türüne uygun kategoriler önce gelir.
 * Fiyatı işletme girer; süre önerilir ve değiştirilebilir.
 */
export function ServiceTemplatesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [picked, setPicked] = useState<Picked>({});
  const [showAll, setShowAll] = useState(false);
  const q = useQuery({
    queryKey: ["salon", "service-templates"],
    queryFn: () => api.get<{ items: Category[] }>("/business/salon/service-templates").then((r) => r.items),
    enabled: open,
  });
  useEffect(() => {
    if (open) {
      setPicked({});
      setShowAll(false);
    }
  }, [open]);

  const cats = useMemo(() => (q.data ?? []).filter((c) => showAll || c.recommended), [q.data, showAll]);
  const entries = Object.entries(picked);
  const num = (v: string) => Number(v.replace(",", "."));
  const missingPrice = entries.some(([, p]) => !p.price || !(num(p.price) >= 0));

  const toggle = (c: Category, t: Template) =>
    setPicked((p) => {
      const next = { ...p };
      if (next[t.name]) delete next[t.name];
      else
        next[t.name] = { category: c.name, duration: String(t.durationMinutes), price: "", description: t.description };
      return next;
    });
  const update = (name: string, patch: Partial<Picked[string]>) =>
    setPicked((p) => ({ ...p, [name]: { ...p[name]!, ...patch } }));

  const save = useMutation({
    mutationFn: () =>
      api.post<{ added: number; skipped: number }>("/business/salon/services/bulk", {
        items: entries.map(([name, p]) => ({
          name,
          category: p.category,
          durationMinutes: Math.max(5, Math.min(600, Math.round(num(p.duration) || 30))),
          price: Math.round(num(p.price) * 100) / 100,
          ...(p.description ? { description: p.description } : {}),
        })),
      }),
    onSuccess: (r) => {
      toast(`${r.added} hizmet eklendi${r.skipped ? `, ${r.skipped} tanesi zaten vardı` : ""}; uygulamada görünüyor`);
      void qc.invalidateQueries({ queryKey: ["salon"] });
      onClose();
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Eklenemedi", "bad"),
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Hazır listeden hizmet ekle"
      wide
      footer={
        <>
          <span className="small muted" style={{ marginRight: "auto" }}>
            {entries.length ? `${entries.length} hizmet seçildi` : "Eklemek istediklerinizi işaretleyin"}
          </span>
          <Button onClick={onClose}>Vazgeç</Button>
          <Button
            variant="primary"
            loading={save.isPending}
            disabled={!entries.length || missingPrice}
            onClick={() => save.mutate()}
          >
            {missingPrice && entries.length ? "Fiyatları girin" : "Ekle"}
          </Button>
        </>
      }
    >
      <p className="small muted" style={{ marginTop: 0 }}>
        Süreler öneridir; kendi uygulamanıza göre değiştirin. Tıbbi işlem sayılan uygulamalar (dolgu, botoks vb.)
        listede yoktur.
      </p>
      {q.isLoading ? <p className="small faint">Yükleniyor…</p> : null}
      {cats.map((c) => (
        <section key={c.key} style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "6px 0" }}>
            <b>{c.name}</b>
            {c.recommended ? <Stamp tone="accent">Önerilen</Stamp> : null}
          </div>
          <div className="rows">
            {c.items.map((t) => {
              const p = picked[t.name];
              return (
                <div key={t.name} className="row" style={{ flexWrap: "wrap", gap: 8 }}>
                  <label
                    style={{ display: "flex", alignItems: "center", gap: 8, flex: "1 1 220px", cursor: "pointer" }}
                  >
                    <input
                      type="checkbox"
                      disabled={t.added}
                      checked={!!p || t.added}
                      onChange={() => toggle(c, t)}
                      aria-label={t.name}
                    />
                    <span>
                      {t.name}
                      {t.added ? <span className="small faint"> · zaten var</span> : null}
                    </span>
                  </label>
                  {p ? (
                    <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input
                        className="input mono"
                        style={{ width: 70 }}
                        inputMode="numeric"
                        value={p.duration}
                        onChange={(e) => update(t.name, { duration: e.target.value.replace(/[^\d]/g, "") })}
                        aria-label={`${t.name} süresi (dakika)`}
                      />
                      <span className="small muted">dk</span>
                      <input
                        className="input mono"
                        style={{ width: 96 }}
                        inputMode="decimal"
                        placeholder="Fiyat"
                        value={p.price}
                        onChange={(e) => update(t.name, { price: e.target.value.replace(/[^\d.,]/g, "") })}
                        aria-label={`${t.name} fiyatı (TL)`}
                      />
                      <span className="small muted">TL</span>
                    </span>
                  ) : (
                    <span className="small faint mono">{t.durationMinutes} dk</span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
      {q.data && !showAll ? (
        <Button size="sm" onClick={() => setShowAll(true)}>
          Diğer kategorileri de göster
        </Button>
      ) : null}
    </Dialog>
  );
}
