import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { getAccessToken, refreshSession } from "./api";
import { useToast } from "../components/Toast";
import { useSession } from "./session";

/** Yönetim panelinde bildirim gösterilen olaylar (diğerleri yalnızca sayıları tazeler). */
const ADMIN_TOASTS = new Set([
  "business.registered",
  "verification.submitted",
  "claim.submitted",
  "ticket.opened",
  "order.paid",
]);

/**
 * Panelin canlı bağlantısı. İşletme paneli: yeni randevu/sipariş/yorum, doğrulama kararı, ürün denetimi.
 * Yönetim paneli: platformdaki her önemli hareket (admin:activity). İlgili listeler anında tazelenir,
 * önemli olanlarda kısa bir bildirim çıkar. Bağlantı koparsa socket.io kendiliğinden yeniden dener.
 */
export function useRealtime(enabled: boolean) {
  const qc = useQueryClient();
  const toast = useToast();
  const { reload } = useSession();
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

      // İşletme paneli
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
      socket.on("review:new", (r: { rating?: number }) => {
        toast(`Yeni yorum${r?.rating ? `: ${r.rating} yıldız` : ""}`);
        void qc.invalidateQueries({ queryKey: ["salon"] });
        void qc.invalidateQueries({ queryKey: ["seller"] });
      });
      socket.on("product:moderated", (p: { blocked?: boolean }) => {
        toast(
          p?.blocked ? "Bir ürününüz yönetim tarafından yayından kaldırıldı" : "Ürününüz yeniden yayında",
          p?.blocked ? "bad" : undefined,
        );
        void qc.invalidateQueries({ queryKey: ["seller"] });
      });
      // Doğrulama kararı veya askıya alma: oturum bilgisi (rozet, durum) yenilenir.
      socket.on("business:updated", (b: { verificationStatus?: string }) => {
        if (b?.verificationStatus === "VERIFIED") toast("İşletmeniz doğrulandı");
        else if (b?.verificationStatus === "REJECTED")
          toast("Doğrulama başvurunuz reddedildi; Ayarlar › Doğrulama", "bad");
        void reload().catch(() => {});
        void qc.invalidateQueries();
      });

      // Yönetim paneli
      socket.on("admin:activity", (a: { kind: string; message: string }) => {
        if (ADMIN_TOASTS.has(a.kind)) toast(a.message);
        void qc.invalidateQueries({ queryKey: ["admin"] });
      });
    })();

    return () => {
      cancelled = true;
      socket?.disconnect();
    };
  }, [enabled, qc, toast, reload]);

  return connected;
}
