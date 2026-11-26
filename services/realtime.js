import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { SOCKET_URL } from "../config";
import { getAccessToken, userApi } from "./api";

/**
 * Sunucuyla canlı bağlantı. Olaylar:
 * - salons:changed   → yeni salon açıldı / salon bilgisi değişti (harita tazelenir)
 * - catalog:changed  → ürün eklendi / fiyat-stok değişti (mağaza tazelenir)
 * - appointment:updated, order:updated, notification:new → kişisel güncellemeler
 */
let socket = null;
const listeners = new Map();

function emitLocal(event, payload) {
  listeners.get(event)?.forEach((fn) => fn(payload));
}

const EVENTS = [
  "salons:changed",
  "catalog:changed",
  "appointment:updated",
  "order:updated",
  "notification:new",
  "payment:updated",
];

export function connectRealtime() {
  if (socket) return;
  socket = io(SOCKET_URL, {
    path: "/socket.io",
    transports: ["websocket"],
    auth: (cb) => cb({ token: getAccessToken() }),
    reconnectionDelayMax: 10000,
  });
  socket.on("connect_error", () => {
    // Erişim token'ı süresi dolmuş olabilir: herhangi bir yetkili istek token'ı yeniler, socket tekrar dener.
    userApi.me().catch(() => {});
  });
  socket.on("connect", () => emitLocal("realtime:connected"));
  EVENTS.forEach((e) => socket.on(e, (payload) => emitLocal(e, payload)));
}

export function disconnectRealtime() {
  socket?.disconnect();
  socket = null;
}

export function onRealtime(event, fn) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(fn);
  return () => listeners.get(event)?.delete(fn);
}

/** Bileşen içinde olay dinleme; geri çağırma her render'da güncel kalır. */
export function useRealtimeEvent(event, handler) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const events = Array.isArray(event) ? event : [event];
    const offs = events.map((e) => onRealtime(e, (p) => ref.current(p)));
    return () => offs.forEach((off) => off());
  }, [Array.isArray(event) ? event.join("|") : event]);
}
