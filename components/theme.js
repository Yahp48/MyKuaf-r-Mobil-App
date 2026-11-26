export const colors = {
  primary: "#FF4896",
  primaryDark: "#e00061",
  accent: "#5A189A",
  text: "#222",
  muted: "#777",
  border: "#eee",
  background: "#fff",
  surface: "#f8f8fa",
  success: "#2e7d32",
  danger: "#d32f2f",
  warning: "#ed6c02",
};

const tl = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" });
export const formatTL = (amount) => tl.format(Number(amount) || 0);

export const formatDate = (iso, withTime = false) =>
  new Date(iso).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });

export const APPOINTMENT_STATUS = {
  PENDING: { label: "Onay bekliyor", color: colors.warning },
  CONFIRMED: { label: "Onaylandı", color: colors.success },
  COMPLETED: { label: "Tamamlandı", color: colors.accent },
  CANCELLED: { label: "İptal edildi", color: colors.danger },
  NO_SHOW: { label: "Gelinmedi", color: colors.muted },
};

export const ORDER_STATUS = {
  PENDING_PAYMENT: { label: "Ödeme bekleniyor", color: colors.warning },
  PAID: { label: "Ödendi", color: colors.success },
  PREPARING: { label: "Hazırlanıyor", color: colors.accent },
  SHIPPED: { label: "Kargoda", color: colors.accent },
  DELIVERED: { label: "Teslim edildi", color: colors.success },
  CANCELLED: { label: "İptal edildi", color: colors.danger },
  REFUNDED: { label: "İade edildi", color: colors.muted },
};
