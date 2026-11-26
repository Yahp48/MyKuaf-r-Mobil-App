import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../lib/api";
import { usePageMeta } from "../../lib/seo";
import { toMinutes, WEEKDAYS } from "../../lib/format";
import { Button, ErrorBox, Loading, PageHead, Switch } from "../../components/ui";
import { useToast } from "../../components/Toast";
import { useHours, type DayHours } from "./queries";

export default function Hours() {
  usePageMeta({ title: "Çalışma saatleri" });
  const q = useHours();
  const qc = useQueryClient();
  const toast = useToast();
  const [rows, setRows] = useState<DayHours[]>([]);
  useEffect(() => {
    if (q.data) setRows(q.data);
  }, [q.data]);

  const invalid = rows.some((r) => !r.isClosed && toMinutes(r.closes) <= toMinutes(r.opens));
  const dirty = JSON.stringify(rows) !== JSON.stringify(q.data);

  const save = useMutation({
    mutationFn: () => api.put("/business/salon/hours", { items: rows }),
    onSuccess: () => {
      toast("Çalışma saatleri kaydedildi; uygulamadaki boş saatler güncellendi");
      void qc.invalidateQueries({ queryKey: ["salon"] });
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Kaydedilemedi", "bad"),
  });

  const update = (i: number, patch: Partial<DayHours>) =>
    setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const copyMonday = () =>
    setRows((r) =>
      r.map((x, i) =>
        i === 0 || i === 6 ? x : { ...x, isClosed: r[0]!.isClosed, opens: r[0]!.opens, closes: r[0]!.closes },
      ),
    );

  return (
    <>
      <PageHead
        kicker="Salon"
        title="Çalışma saatleri"
        sub="Müşteriler yalnızca bu saatler içinde randevu alabilir. Var olan randevular değişmez."
        actions={
          <>
            <Button onClick={copyMonday}>Pazartesiyi hafta içine kopyala</Button>
            <Button
              variant="primary"
              onClick={() => save.mutate()}
              loading={save.isPending}
              disabled={!dirty || invalid}
            >
              Kaydet
            </Button>
          </>
        }
      />
      {q.isLoading ? (
        <Loading rows={7} />
      ) : q.error ? (
        <ErrorBox error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <div className="rows" style={{ maxWidth: 720 }}>
          {rows.map((r, i) => {
            const bad = !r.isClosed && toMinutes(r.closes) <= toMinutes(r.opens);
            return (
              <div key={r.weekday} className="row" style={{ flexWrap: "wrap" }}>
                <span style={{ width: 120, fontWeight: 500 }}>{WEEKDAYS[i]}</span>
                <Switch
                  checked={!r.isClosed}
                  onChange={(open) => update(i, { isClosed: !open })}
                  label={r.isClosed ? "Kapalı" : "Açık"}
                />
                <span className="grow" />
                <input
                  type="time"
                  className="input mono"
                  style={{ width: 120 }}
                  value={r.opens}
                  disabled={r.isClosed}
                  step={900}
                  onChange={(e) => update(i, { opens: e.target.value })}
                  aria-label={`${WEEKDAYS[i]} açılış`}
                />
                <span className="faint">–</span>
                <input
                  type="time"
                  className="input mono"
                  style={{ width: 120 }}
                  value={r.closes}
                  disabled={r.isClosed}
                  step={900}
                  onChange={(e) => update(i, { closes: e.target.value })}
                  aria-label={`${WEEKDAYS[i]} kapanış`}
                  aria-invalid={bad}
                />
                {bad ? (
                  <span className="small" style={{ width: "100%", color: "var(--bad)", textAlign: "right" }}>
                    Kapanış açılıştan sonra olmalı
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
