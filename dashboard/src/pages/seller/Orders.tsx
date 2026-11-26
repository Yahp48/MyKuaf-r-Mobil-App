import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { api } from "../../lib/api";
import { usePageMeta } from "../../lib/seo";
import { dateTime, money } from "../../lib/format";
import { Button, Empty, ErrorBox, Loading, PageHead, Stamp } from "../../components/ui";
import type { Order, Page } from "../../lib/types";
import { ORDER_STATUS } from "./shared";

type Tab = "action" | "shipped" | "closed" | "all";
const TABS: [Tab, string][] = [
  ["action", "Hazırlanacak"],
  ["shipped", "Kargoda"],
  ["closed", "Kapanan"],
  ["all", "Tümü"],
];

export default function Orders() {
  usePageMeta({ title: "Siparişler" });
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = (params.get("sekme") as Tab) ?? "action";
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");

  const list = useQuery({
    queryKey: ["seller", "orders", tab, page, query],
    queryFn: () =>
      api.get<Page<Order> & { tabCounts: Record<string, number> }>("/business/seller/orders", {
        tab,
        page,
        q: query || undefined,
      }),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHead
        kicker="Satış"
        title="Siparişler"
        sub="Ödemesi alınmış siparişler 'Hazırlanacak' sekmesine düşer. Kargoya verdiğinizde müşteri takip numarasıyla bilgilendirilir."
      />
      <div className="tabs" role="tablist">
        {TABS.map(([k, label]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => {
              setPage(1);
              setParams({ sekme: k }, { replace: true });
            }}
          >
            {label}
            {k !== "all" && list.data ? <span className="n">{list.data.tabCounts[k] ?? 0}</span> : null}
          </button>
        ))}
      </div>
      <form
        className="toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setQuery(q.trim());
        }}
      >
        <div className="search">
          <MagnifyingGlass size={16} />
          <input
            className="input"
            placeholder="Sipariş no, e-posta veya ürün"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Sipariş ara"
          />
        </div>
        <Button type="submit">Ara</Button>
      </form>

      {list.isLoading ? (
        <Loading />
      ) : list.error ? (
        <ErrorBox error={list.error} onRetry={() => list.refetch()} />
      ) : list.data!.items.length === 0 ? (
        <Empty title={tab === "action" ? "Hazırlanacak sipariş yok" : "Bu sekmede sipariş yok"}>
          {tab === "action" ? "Yeni sipariş geldiğinde burada ve sol menüde anında görünür." : null}
        </Empty>
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Sipariş</th>
                  <th>Tarih</th>
                  <th>Alıcı</th>
                  <th>Ürünler</th>
                  <th className="right">Tutar</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {list.data!.items.map((o) => (
                  <tr key={o.id} data-href onClick={() => navigate(`/magaza/siparisler/${o.id}`)}>
                    <td className="mono">
                      <a href={`/magaza/siparisler/${o.id}`} onClick={(e) => e.preventDefault()}>
                        {o.orderNumber}
                      </a>
                    </td>
                    <td className="small">{dateTime(o.paidAt ?? o.createdAt)}</td>
                    <td>
                      {o.shippingAddress.fullName}
                      <div className="small faint">
                        {o.shippingAddress.district}/{o.shippingAddress.city}
                      </div>
                    </td>
                    <td className="small">
                      {o.items
                        .slice(0, 2)
                        .map((i) => `${i.quantity}× ${i.name}`)
                        .join(", ")}
                      {o.items.length > 2 ? ` +${o.items.length - 2}` : ""}
                    </td>
                    <td className="right mono">{money(o.total)}</td>
                    <td>
                      <Stamp tone={ORDER_STATUS[o.status].tone}>{ORDER_STATUS[o.status].label}</Stamp>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 14 }}>
            <Button size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              Önceki
            </Button>
            <span className="small faint mono">
              {page} / {Math.max(1, Math.ceil(list.data!.total / list.data!.pageSize))}
            </span>
            <Button size="sm" disabled={!list.data!.hasNextPage} onClick={() => setPage((p) => p + 1)}>
              Sonraki
            </Button>
          </div>
        </>
      )}
    </>
  );
}
