const tl = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" });
const tl0 = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 });
const num = new Intl.NumberFormat("tr-TR");

export const money = (v: number) => tl.format(v);
/** Büyük rakam gösterimi: kuruşsuz */
export const moneyShort = (v: number) => tl0.format(v);
export const number = (v: number) => num.format(v);

export const dateLong = (iso: string) =>
  new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
export const dateShort = (iso: string) => new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
export const weekdayLong = (ymd: string) =>
  new Date(`${ymd}T12:00:00`).toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" });

/** Yerel saatle YYYY-AA-GG */
export function ymd(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDays(day: string, n: number) {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() + n);
  return ymd(d);
}

export function monthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function shiftMonth(key: string, n: number) {
  const [y, m] = key.split("-").map(Number) as [number, number];
  const d = new Date(y, m - 1 + n, 1);
  return monthKey(d);
}

export const monthLabel = (key: string) =>
  new Date(`${key}-15T12:00:00`).toLocaleDateString("tr-TR", { month: "long", year: "numeric" });

export const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number) as [number, number];
  return h * 60 + m;
};
export const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export const formatPhone = (p: string | null) => {
  if (!p) return "—";
  const d = p
    .replace(/\D/g, "")
    .replace(/^90/, "0")
    .replace(/^(?!0)/, "0");
  return d.length === 11 ? `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7, 9)} ${d.slice(9)}` : p;
};

export const WEEKDAYS = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
