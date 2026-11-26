import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";

/**
 * Sunucudan veri yükleme durumu (yükleniyor / hata / yenileniyor).
 * `refetchOnFocus` ile ekrana her dönüldüğünde veri tazelenir.
 */
export function useRemote(loader, { refetchOnFocus = true } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const run = useCallback(
    async (mode = "load") => {
      if (mode === "refresh") setRefreshing(true);
      setError(null);
      try {
        setData(await loader());
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [loader],
  );

  useEffect(() => {
    if (!refetchOnFocus) run();
  }, [run, refetchOnFocus]);

  useFocusEffect(
    useCallback(() => {
      if (refetchOnFocus) run(data ? "silent" : "load");
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [run, refetchOnFocus]),
  );

  return { data, setData, error, loading, refreshing, reload: () => run("load"), refresh: () => run("refresh") };
}
