import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { getAccessToken, refreshSession } from "./api";
import { useToast } from "../components/Toast";

/**
 * Panelin canlı bağlantısı: uygulamadan yeni randevu/sipariş gelince ilgili listeler anında tazelenir
 * ve kısa bir bildirim gösterilir. Bağlantı koparsa socket.io kendiliğinden yeniden dener.
 */
export function useRealtime(enabled: boolean) {
  const qc = useQueryClient();
  const toast = useToast();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let socket: Socket | null = null;
    let cancelled = false;

    (async () => {
      if (!getAccessToken()) await refreshSession();
      if (cancelled) return;
      socket = io({ path: "/socket.io", auth: (cb) => cb({ token: getAccessToken() }), transports: ["websocket"] });
      socket.on("connect", () => setConnected(true));
      socket.on("disconnect", () => setConnected(false));
      socket.on("connect_error", async () => {
        // Erişim token'ı süresi dolmuş olabilir: yenile, socket.io tekrar dener.
        await refreshSession();
      });
      socket.on("appointment:new", () => {
        toast("Yeni randevu geldi");
        void qc.invalidateQueries({ queryKey: ["salon"] });
      });
      socket.on("appointment:updated", () => void qc.invalidateQueries({ queryKey: ["salon"] }));
      socket.on("order:new", (o: { orderNumber?: string }) => {
        toast(`Yeni sipariş: ${o?.orderNumber ?? ""}`);
        void qc.invalidateQueries({ queryKey: ["seller"] });
      });
      socket.on("order:updated", () => void qc.invalidateQueries({ queryKey: ["seller"] }));
    })();

    return () => {
      cancelled = true;
      socket?.disconnect();
    };
  }, [enabled, qc, toast]);

  return connected;
}
