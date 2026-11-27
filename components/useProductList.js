import { useCallback, useEffect, useRef, useState } from "react";
import NetInfo from "@react-native-community/netinfo";
import { productApi } from "../services/api";
import { useRealtimeEvent } from "../services/realtime";

export const DEFAULT_FILTERS = {
  sort: "newest",
  category: null,
  brands: [],
  minPrice: "",
  maxPrice: "",
  inStock: false,
  onSale: false,
};

/** Filtre panelindeki etkin seçim sayısı (sıralama ve kategori hariç). */
export const activeFilterCount = (f) =>
  (f.brands.length ? 1 : 0) + (f.minPrice || f.maxPrice ? 1 : 0) + (f.inStock ? 1 : 0) + (f.onSale ? 1 : 0);

const toQuery = (f, q, seller) => ({
  sort: f.sort,
  category: f.category ?? undefined,
  brands: f.brands.length ? f.brands.join(",") : undefined,
  minPrice: f.minPrice ? Number(f.minPrice) : undefined,
  maxPrice: f.maxPrice ? Number(f.maxPrice) : undefined,
  inStock: f.inStock ? "true" : undefined,
  onSale: f.onSale ? "true" : undefined,
  q: q || undefined,
  seller,
});

/** Ürün listesi: filtre + arama + sayfalama + canlı güncelleme (Mağaza ve mağaza sayfası ortak). */
export function useProductList({ filters, query, seller }) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(null);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const requestId = useRef(0);

  const load = useCallback(
    async (nextPage, mode) => {
      const id = ++requestId.current;
      if (mode === "more") setLoadingMore(true);
      if (mode === "refresh") setRefreshing(true);
      if (mode === "initial") setLoading(true);
      setError(null);
      try {
        const res = await productApi.list({ page: nextPage, pageSize: 20, ...toQuery(filters, query, seller) });
        if (id !== requestId.current) return;
        setItems((prev) => (nextPage === 1 ? res.items : [...prev, ...res.items]));
        setPage(nextPage);
        setHasNext(res.hasNextPage);
        setTotal(res.total);
      } catch (e) {
        if (id === requestId.current) setError(e.message);
      } finally {
        if (id === requestId.current) {
          setLoading(false);
          setLoadingMore(false);
          setRefreshing(false);
        }
      }
    },
    [filters, query, seller],
  );

  useEffect(() => {
    load(1, "initial");
  }, [load]);

  // Satıcı ürün ekleyince, fiyat veya stok değiştirince liste sessizce tazelenir.
  useRealtimeEvent("catalog:changed", () => load(1, "silent"));

  // Bağlantı geri gelince hata almış liste yeniden yüklenir.
  const failed = useRef(false);
  failed.current = !!error && items.length === 0;
  useEffect(
    () =>
      NetInfo.addEventListener((s) => {
        if (s.isConnected && s.isInternetReachable !== false && failed.current) load(1, "initial");
      }),
    [load],
  );

  return {
    items,
    total,
    loading,
    loadingMore,
    refreshing,
    error,
    reload: () => load(1, "initial"),
    refresh: () => load(1, "refresh"),
    loadMore: () => hasNext && !loadingMore && load(page + 1, "more"),
  };
}
