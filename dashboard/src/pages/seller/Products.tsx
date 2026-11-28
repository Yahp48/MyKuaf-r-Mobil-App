import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MagnifyingGlass, Plus } from "@phosphor-icons/react";
import { api, ApiError } from "../../lib/api";
import { usePageMeta } from "../../lib/seo";
import { money } from "../../lib/format";
import { Button, Empty, ErrorBox, LinkButton, Loading, PageHead, Stamp } from "../../components/ui";
import { useToast } from "../../components/Toast";
import type { Page, Product } from "../../lib/types";

type Filter = "all" | "active" | "low" | "out" | "inactive";
const FILTERS: [Filter, string][] = [
  ["all", "Tümü"],
  ["active", "Satışta"],
  ["low", "Azalan stok"],
  ["out", "Tükenen"],
  ["inactive", "Satış dışı"],
];

/** Satırda stok düzenleme: Enter'a basınca ya da alandan çıkınca kaydedilir. */
function StockCell({ product }: { product: Product }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [value, setValue] = useState(String(product.stock));
  const save = useMutation({
    mutationFn: (stock: number) => api.patch(`/business/seller/products/${product.id}/stock`, { stock }),
    onSuccess: () => {
      toast(`${product.name}: stok güncellendi`);
      void qc.invalidateQueries({ queryKey: ["seller"] });
    },
    onError: (e) => {
      setValue(String(product.stock));
      toast(e instanceof ApiError ? e.message : "Kaydedilemedi", "bad");
    },
  });
  const commit = () => {
    const n = Number(value);
    if (Number.isInteger(n) && n >= 0 && n !== product.stock) save.mutate(n);
    else setValue(String(product.stock));
  };
  return (
    <input
      className="input mono"
      style={{
        width: 84,
        minHeight: 34,
        textAlign: "right",
        color: product.stock === 0 ? "var(--bad)" : product.stock <= 5 ? "var(--warn)" : undefined,
      }}
      inputMode="numeric"
      value={value}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      aria-label={`${product.name} stok adedi`}
      disabled={save.isPending}
    />
  );
}

export default function Products() {
  usePageMeta({ title: "Ürünler ve stok" });
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const list = useQuery({
    queryKey: ["seller", "products", filter, page, query],
    queryFn: () => api.get<Page<Product>>("/business/seller/products", { filter, page, q: query || undefined }),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHead
        kicker="Satış"
        title="Ürünler ve stok"
        sub="Değişiklikler BiBakım uygulamasının mağazasına anında yansır."
        actions={
          <LinkButton to="/magaza/urunler/yeni" variant="primary">
            <Plus size={16} /> Ürün ekle
          </LinkButton>
        }
      />
      <div className="tabs" role="tablist">
        {FILTERS.map(([k, label]) => (
          <button
            key={k}
            role="tab"
            aria-selected={filter === k}
            onClick={() => {
              setFilter(k);
              setPage(1);
            }}
          >
            {label}
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
            placeholder="Ürün adı, marka veya stok kodu"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Ürün ara"
          />
        </div>
        <Button type="submit">Ara</Button>
      </form>

      {list.isLoading ? (
        <Loading />
      ) : list.error ? (
        <ErrorBox error={list.error} onRetry={() => list.refetch()} />
      ) : list.data!.items.length === 0 ? (
        <Empty
          title={filter === "all" && !query ? "Henüz ürün yok" : "Eşleşen ürün yok"}
          action={
            filter === "all" && !query ? (
              <LinkButton to="/magaza/urunler/yeni" variant="primary">
                İlk ürünü ekle
              </LinkButton>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Ürün</th>
                  <th>Kategori</th>
                  <th className="right">Fiyat</th>
                  <th className="right">Stok</th>
                  <th className="right">30 gün satış</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {list.data!.items.map((p) => (
                  <tr key={p.id} data-href onClick={() => navigate(`/magaza/urunler/${p.id}`)}>
                    <td>
                      <div className="cell-media">
                        {p.images[0] ? <img className="thumb" src={p.images[0]} alt="" /> : <span className="thumb" />}
                        <span>
                          <Link
                            to={`/magaza/urunler/${p.id}`}
                            onClick={(e) => e.stopPropagation()}
                            style={{ fontWeight: 500, textDecoration: "none" }}
                          >
                            {p.name}
                          </Link>
                          <span className="small faint" style={{ display: "block" }}>
                            {[p.brand, p.sku].filter(Boolean).join(" · ") || "—"}
                          </span>
                        </span>
                      </div>
                    </td>
                    <td className="muted">{p.category.name}</td>
                    <td className="right mono">
                      {money(p.price)}
                      {p.compareAtPrice ? (
                        <div className="small faint" style={{ textDecoration: "line-through" }}>
                          {money(p.compareAtPrice)}
                        </div>
                      ) : null}
                    </td>
                    <td className="right">
                      <StockCell key={`${p.id}-${p.stock}`} product={p} />
                    </td>
                    <td className="right mono">{p.sold30d ?? 0}</td>
                    <td>
                      {p.blockedAt ? (
                        <>
                          <Stamp tone="bad">Yönetim kaldırdı</Stamp>
                          <div className="small faint">{p.blockReason}</div>
                        </>
                      ) : p.isActive ? (
                        <Stamp tone="ok">Satışta</Stamp>
                      ) : (
                        <Stamp tone="faint">Satış dışı</Stamp>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 14 }}>
            <Button size="sm" disabled={page === 1} onClick={() => setPage((x) => x - 1)}>
              Önceki
            </Button>
            <span className="small faint mono">{list.data!.total} ürün</span>
            <Button size="sm" disabled={!list.data!.hasNextPage} onClick={() => setPage((x) => x + 1)}>
              Sonraki
            </Button>
          </div>
        </>
      )}
    </>
  );
}
