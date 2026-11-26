import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CaretLeft, CaretRight, Plus, Trash } from "@phosphor-icons/react";
import { api, ApiError } from "../../lib/api";
import { usePageMeta } from "../../lib/seo";
import { money, moneyShort, monthKey, monthLabel, shiftMonth, ymd } from "../../lib/format";
import { BarChart } from "../../components/BarChart";
import { Button, Dialog, Empty, ErrorBox, Figure, Input, Loading, PageHead, Select, Stamp } from "../../components/ui";
import { useToast } from "../../components/Toast";

interface FinanceData {
  totals: {
    appointmentIncome: number;
    otherIncome: number;
    income: number;
    expense: number;
    net: number;
    completedAppointments: number;
  };
  daily: { date: string; income: number; expense: number }[];
  expenseByCategory: { category: string; amount: number }[];
  incomeByStaff: { name: string; amount: number }[];
  entries: {
    id: string;
    type: "INCOME" | "EXPENSE";
    category: string;
    amount: number;
    date: string;
    description: string | null;
  }[];
}

const EXPENSE_CATS = ["Kira", "Maaş", "SGK / vergi", "Malzeme", "Fatura", "Bakım-onarım", "Reklam", "Diğer"];
const INCOME_CATS = ["Ürün satışı", "Bahşiş", "Paket satışı", "Diğer"];

export default function Finance() {
  usePageMeta({ title: "Gelir ve gider" });
  const [month, setMonth] = useState(monthKey());
  const [adding, setAdding] = useState<"INCOME" | "EXPENSE" | null>(null);
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({
    queryKey: ["salon", "finance", month],
    queryFn: () => api.get<FinanceData>("/business/salon/finance", { month }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/business/salon/ledger/${id}`),
    onSuccess: () => {
      toast("Kayıt silindi");
      void qc.invalidateQueries({ queryKey: ["salon", "finance"] });
    },
  });

  const d = q.data;
  const maxCat = Math.max(1, ...(d?.expenseByCategory.map((c) => c.amount) ?? [1]));

  return (
    <>
      <PageHead
        kicker="İşletme"
        title="Gelir ve gider"
        sub="Tamamlanan randevular gelire otomatik yazılır. Kira, maaş, malzeme gibi kalemleri ve salonda yaptığınız diğer satışları elle ekleyin."
        actions={
          <>
            <Button onClick={() => setAdding("INCOME")}>
              <Plus size={16} /> Gelir
            </Button>
            <Button variant="primary" onClick={() => setAdding("EXPENSE")}>
              <Plus size={16} /> Gider
            </Button>
          </>
        }
      />

      <div className="toolbar">
        <div className="segmented" role="group" aria-label="Ay">
          <button onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Önceki ay">
            <CaretLeft size={14} />
          </button>
          <button aria-pressed="true" style={{ minWidth: 140, textTransform: "capitalize" }}>
            {monthLabel(month)}
          </button>
          <button onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Sonraki ay" disabled={month >= monthKey()}>
            <CaretRight size={14} />
          </button>
        </div>
      </div>

      {q.isLoading ? (
        <Loading rows={6} />
      ) : q.error ? (
        <ErrorBox error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <>
          <div className="figures">
            <Figure
              label="Toplam gelir"
              value={moneyShort(d!.totals.income)}
              note={`${d!.totals.completedAppointments} randevu + diğer`}
            />
            <Figure label="Randevu geliri" value={moneyShort(d!.totals.appointmentIncome)} />
            <Figure label="Gider" value={moneyShort(d!.totals.expense)} />
            <Figure
              label="Net"
              value={
                <span style={{ color: d!.totals.net < 0 ? "var(--bad)" : undefined }}>{moneyShort(d!.totals.net)}</span>
              }
              note={d!.totals.net < 0 ? "Bu ay gider gelirden fazla" : undefined}
            />
          </div>

          <section className="section">
            <div className="section-head">
              <h2>Günlük gelir</h2>
              <span className="small faint">Randevular ve elle girilen gelirler · giderler aşağıda kalem kalem</span>
            </div>
            <div className="leaf leaf-pad">
              <BarChart
                caption="Ay içindeki günlük gelir"
                data={d!.daily.map((x) => ({ label: String(Number(x.date.slice(8))), title: x.date, value: x.income }))}
              />
            </div>
          </section>

          <div className="grid-cols section">
            <section>
              <h2 style={{ marginBottom: 12 }}>Gider kalemleri</h2>
              {d!.expenseByCategory.length === 0 ? (
                <p className="muted">Bu ay gider kaydı yok.</p>
              ) : (
                <div className="rows">
                  {d!.expenseByCategory.map((c) => (
                    <div
                      key={c.category}
                      className="row"
                      style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 6 }}
                    >
                      <span>{c.category}</span>
                      <span className="mono">{money(c.amount)}</span>
                      <span style={{ gridColumn: "1 / -1", height: 3, background: "var(--rule)", borderRadius: 2 }}>
                        <span
                          style={{
                            display: "block",
                            height: 3,
                            width: `${(c.amount / maxCat) * 100}%`,
                            background: "var(--ink-2)",
                            borderRadius: 2,
                          }}
                        />
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
            <section>
              <h2 style={{ marginBottom: 12 }}>Personel bazlı ciro</h2>
              {d!.incomeByStaff.length === 0 ? (
                <p className="muted">Bu ay tamamlanan randevu yok.</p>
              ) : (
                <div className="rows">
                  {d!.incomeByStaff.map((s) => (
                    <div key={s.name} className="row">
                      <span className="grow">{s.name}</span>
                      <span className="mono">{money(s.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <section className="section">
            <h2 style={{ marginBottom: 12 }}>Elle girilen kayıtlar</h2>
            {d!.entries.length === 0 ? (
              <Empty title="Bu ay kayıt yok">Kira, maaş ve fatura gibi giderleri ekleyerek net kârınızı görün.</Empty>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Tarih</th>
                      <th>Tür</th>
                      <th>Kategori</th>
                      <th>Açıklama</th>
                      <th className="right">Tutar</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {d!.entries.map((e) => (
                      <tr key={e.id}>
                        <td className="mono">{new Date(`${e.date}T12:00`).toLocaleDateString("tr-TR")}</td>
                        <td>{e.type === "INCOME" ? <Stamp tone="ok">Gelir</Stamp> : <Stamp>Gider</Stamp>}</td>
                        <td>{e.category}</td>
                        <td className="muted">{e.description ?? "—"}</td>
                        <td className="right mono">
                          {e.type === "EXPENSE" ? "−" : "+"}
                          {money(e.amount)}
                        </td>
                        <td className="right">
                          <Button
                            size="sm"
                            variant="quiet"
                            aria-label="Kaydı sil"
                            onClick={() => confirm("Bu kayıt silinsin mi?") && remove.mutate(e.id)}
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
          </section>
        </>
      )}

      <EntryDialog type={adding} month={month} onClose={() => setAdding(null)} />
    </>
  );
}

function EntryDialog({
  type,
  month,
  onClose,
}: {
  type: "INCOME" | "EXPENSE" | null;
  month: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const cats = type === "INCOME" ? INCOME_CATS : EXPENSE_CATS;
  const today = ymd();
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today.startsWith(month) ? today : `${month}-01`);
  const [description, setDescription] = useState("");
  const value = Number(amount.replace(/\./g, "").replace(",", "."));

  const save = useMutation({
    mutationFn: () =>
      api.post("/business/salon/ledger", {
        type,
        category: category || cats[0],
        amount: Math.round(value * 100) / 100,
        date,
        description: description.trim() || null,
      }),
    onSuccess: () => {
      toast("Kaydedildi");
      void qc.invalidateQueries({ queryKey: ["salon", "finance"] });
      setAmount("");
      setDescription("");
      onClose();
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Kaydedilemedi", "bad"),
  });

  return (
    <Dialog
      open={!!type}
      onClose={onClose}
      title={type === "INCOME" ? "Gelir ekle" : "Gider ekle"}
      footer={
        <>
          <Button onClick={onClose}>Vazgeç</Button>
          <Button
            variant="primary"
            loading={save.isPending}
            disabled={!(value > 0) || !date}
            onClick={() => save.mutate()}
          >
            Kaydet
          </Button>
        </>
      }
    >
      <div className="form-row">
        <Select label="Kategori" value={category || cats[0]} onChange={(e) => setCategory(e.target.value)}>
          {cats.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
        <Input
          label="Tutar (TL)"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
          className="input mono"
          autoFocus
        />
      </div>
      <Input label="Tarih" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
      <Input
        label="Açıklama (isteğe bağlı)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={300}
      />
    </Dialog>
  );
}
