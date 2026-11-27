// Tek vurgu rengi (#C9184A) + nötr tonlar. İkincil renk yok: vurgu dışındaki her şey gri/mürekkep.
export const colors = {
  primary: "#C9184A",
  primaryDark: "#A4133C",
  primarySoft: "#FDEEF2",
  // Eski "accent" kullanımları artık koyu mürekkep rengine düşer (mor kaldırıldı).
  accent: "#1C1C1E",
  text: "#1C1C1E",
  muted: "#6E6E73",
  faint: "#A1A1A6",
  border: "#ECECEF",
  background: "#FFFFFF",
  surface: "#F5F5F7",
  success: "#1E8E3E",
  danger: "#D93025",
  warning: "#B26A00",
};

export const shadow = {
  shadowColor: "#000",
  shadowOpacity: 0.08,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 4,
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
