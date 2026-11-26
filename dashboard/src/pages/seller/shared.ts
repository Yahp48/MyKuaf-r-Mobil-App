import type { OrderStatus } from "../../lib/types";
import type { Tone } from "../../components/ui";

export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: Tone }> = {
  PENDING_PAYMENT: { label: "Ödeme bekliyor", tone: "faint" },
  PAID: { label: "Yeni · hazırlanacak", tone: "warn" },
  PREPARING: { label: "Hazırlanıyor", tone: "accent" },
  SHIPPED: { label: "Kargoda", tone: "accent" },
  DELIVERED: { label: "Teslim edildi", tone: "ok" },
  CANCELLED: { label: "İptal", tone: "faint" },
  REFUNDED: { label: "İade edildi", tone: "bad" },
};
