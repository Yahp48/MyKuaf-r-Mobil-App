import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { api } from "../../lib/api";
import { usePageMeta } from "../../lib/seo";
import { useBusiness } from "../../lib/session";
import { dateTime, money, moneyShort, monthKey, monthLabel, shiftMonth } from "../../lib/format";
import { BarChart } from "../../components/BarChart";
import { Empty, ErrorBox, Figure, Loading, PageHead, Stamp } from "../../components/ui";
import type { OrderStatus } from "../../lib/types";
import { ORDER_STATUS } from "./shared";

interface FinanceData {
  totals: {
    gross: number;
    refunded: number;
    net: number;
    shippingCollected: number;
    orderCount: number;
    refundCount: number;
  };
  daily: { date: string; sales: number; refunds: number }[];
  orders: { orderNumber: string; status: OrderStatus; total: number; paidAt: string }[];
}

export default function SellerFinance() {
  usePageMeta({ title: "Finans" });
  const { business } = useBusiness();
  const [month, setMonth] = useState(monthKey());
  const q = useQuery({
    queryKey: ["seller", "finance", month],
    queryFn: () => api.get<FinanceData>("/business/seller/finance", { month }),
  });
  const d = q.data;

  return (
    <>
      <PageHead
        kicker="Mağaza"
        title="Finans"
        sub={
          business.iban
            ? "Tahsilatlar ödeme kuruluşu üzerinden kayıtlı IBAN'ınıza aktarılır."
            : "Hak edişlerin aktarılması için Ayarlar'dan IBAN ekleyin."
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
            <Figure label="Brüt satış" value={moneyShort(d!.totals.gross)} note={`${d!.totals.orderCount} sipariş`} />
            <Figure label="İadeler" value={moneyShort(d!.totals.refunded)} note={`${d!.totals.refundCount} sipariş`} />
            <Figure label="Net satış" value={moneyShort(d!.totals.net)} />
            <Figure label="Tahsil edilen kargo" value={moneyShort(d!.totals.shippingCollected)} />
          </div>
          <section className="section">
            <div className="section-head">
              <h2>Günlük satış ve iade</h2>
              <span className="small faint">
                <span style={{ color: "var(--accent)" }}>■</span> satış &nbsp;{" "}
                <span style={{ color: "var(--ink-3)" }}>■</span> iade
              </span>
            </div>
            <div className="leaf leaf-pad">
              <BarChart
                caption="Aylık günlük satış ve iadeler"
                data={d!.daily.map((x) => ({
                  label: String(Number(x.date.slice(8))),
                  title: x.date,
                  value: x.sales,
                  alt: x.refunds,
                }))}
              />
            </div>
          </section>
          <section className="section">
            <h2 style={{ marginBottom: 12 }}>Ay içindeki siparişler</h2>
            {d!.orders.length === 0 ? (
              <Empty title="Bu ay satış yok" />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Sipariş</th>
                      <th>Ödeme tarihi</th>
                      <th>Durum</th>
                      <th className="right">Tutar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d!.orders.map((o) => (
                      <tr key={o.orderNumber}>
                        <td className="mono">{o.orderNumber}</td>
                        <td className="small">{dateTime(o.paidAt)}</td>
                        <td>
                          <Stamp tone={ORDER_STATUS[o.status].tone}>{ORDER_STATUS[o.status].label}</Stamp>
                        </td>
                        <td
                          className="right mono"
                          style={{ textDecoration: o.status === "REFUNDED" ? "line-through" : undefined }}
                        >
                          {money(o.total)}
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
    </>
  );
}
