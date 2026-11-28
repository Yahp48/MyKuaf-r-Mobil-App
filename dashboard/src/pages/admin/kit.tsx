import { useEffect, useState, type ReactNode } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { Page } from "../../lib/types";
import { Button, Empty, ErrorBox, Input, Loading, type Tone } from "../../components/ui";

/** Yönetim listeleri için ortak parçalar: sekmeli filtre, arama, sayfalama. */

export const APPOINTMENT_STATUS: Record<string, { label: string; tone: Tone }> = {
  PENDING: { label: "Onay bekliyor", tone: "warn" },
  CONFIRMED: { label: "Onaylı", tone: "accent" },
  COMPLETED: { label: "Tamamlandı", tone: "ok" },
  CANCELLED: { label: "İptal", tone: "faint" },
  NO_SHOW: { label: "Gelmedi", tone: "bad" },
};

export const ORDER_STATUS: Record<string, { label: string; tone: Tone }> = {
  PENDING_PAYMENT: { label: "Ödeme bekliyor", tone: "faint" },
  PAID: { label: "Ödendi", tone: "warn" },
  PREPARING: { label: "Hazırlanıyor", tone: "warn" },
  SHIPPED: { label: "Kargoda", tone: "accent" },
  DELIVERED: { label: "Teslim edildi", tone: "ok" },
  CANCELLED: { label: "İptal", tone: "faint" },
  REFUNDED: { label: "İade edildi", tone: "faint" },
};

export const PAYMENT_STATUS: Record<string, { label: string; tone: Tone }> = {
  PENDING: { label: "Bekliyor", tone: "faint" },
  SUCCEEDED: { label: "Başarılı", tone: "ok" },
  FAILED: { label: "Başarısız", tone: "bad" },
  REFUNDED: { label: "İade edildi", tone: "faint" },
};

export const PAYMENT_PURPOSE: Record<string, string> = {
  ORDER: "Sipariş",
  WALLET_TOPUP: "Cüzdan yükleme",
  CARD_VERIFY: "Kart doğrulama (1 TL, iade)",
};

export function FilterTabs<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: [T, string][];
}) {
  return (
    <div className="tabs" role="tablist" style={{ margin: 0 }}>
      {options.map(([k, label]) => (
        <button key={label} role="tab" aria-selected={value === k} onClick={() => onChange(k)}>
          {label}
        </button>
      ))}
    </div>
  );
}

/** Yazmayı bitirince (300 ms) arar; her tuşta istek atmaz. */
export function useDebounced(value: string, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function Toolbar({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end", marginBottom: 16 }}>{children}</div>
  );
}

export function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div style={{ minWidth: 220, flex: 1, maxWidth: 360 }}>
      <Input
        label="Ara"
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

/**
 * Sayfalı yönetim listesi. Filtre değişince ilk sayfaya döner; canlı olaylarda ["admin"] anahtarıyla tazelenir.
 */
export function useAdminList<T>(path: string, params: Record<string, string | undefined>) {
  const [page, setPage] = useState(1);
  const key = JSON.stringify(params);
  useEffect(() => setPage(1), [key]);
  const query = useQuery({
    queryKey: ["admin", path, key, page],
    queryFn: () => api.get<Page<T>>(`/admin/${path}`, { ...params, page, pageSize: 30 }),
    placeholderData: keepPreviousData,
  });
  return { query, page, setPage };
}

export function ListBody<T>({
  list,
  empty,
  children,
}: {
  list: ReturnType<typeof useAdminList<T>>;
  empty: string;
  children: (items: T[]) => ReactNode;
}) {
  const { query, page, setPage } = list;
  if (query.isLoading) return <Loading />;
  if (query.error) return <ErrorBox error={query.error} onRetry={() => query.refetch()} />;
  const data = query.data!;
  if (!data.items.length) return <Empty title={empty} />;
  const from = (page - 1) * data.pageSize + 1;
  const to = from + data.items.length - 1;
  return (
    <>
      {children(data.items)}
      <div className="pager" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14 }}>
        <span className="small muted" style={{ marginRight: "auto" }}>
          {from}–{to} / {data.total}
        </span>
        <Button size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
          Önceki
        </Button>
        <Button size="sm" disabled={!data.hasNextPage} onClick={() => setPage(page + 1)}>
          Sonraki
        </Button>
      </div>
    </>
  );
}
