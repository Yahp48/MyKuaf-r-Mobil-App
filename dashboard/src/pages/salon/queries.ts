import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { Appointment, AppointmentStatus, Service, Staff } from "../../lib/types";
import type { Tone } from "../../components/ui";

// Tüm salon sorguları "salon" anahtarıyla başlar: canlı olay gelince hepsi birlikte tazelenir.
export const useStaff = () =>
  useQuery({
    queryKey: ["salon", "staff"],
    queryFn: () => api.get<{ items: Staff[] }>("/business/salon/staff").then((r) => r.items),
  });

export const useServices = () =>
  useQuery({
    queryKey: ["salon", "services"],
    queryFn: () => api.get<{ items: Service[] }>("/business/salon/services").then((r) => r.items),
  });

export interface DayHours {
  weekday: number;
  isClosed: boolean;
  opens: string;
  closes: string;
}

export const useHours = () =>
  useQuery({
    queryKey: ["salon", "hours"],
    queryFn: () => api.get<{ items: DayHours[] }>("/business/salon/hours").then((r) => r.items),
  });

export const useAppointments = (from: string, to: string) =>
  useQuery({
    queryKey: ["salon", "appointments", from, to],
    queryFn: () => api.get<{ items: Appointment[] }>("/business/salon/appointments", { from, to }).then((r) => r.items),
  });

export const STATUS: Record<AppointmentStatus, { label: string; tone: Tone }> = {
  PENDING: { label: "Onay bekliyor", tone: "warn" },
  CONFIRMED: { label: "Onaylı", tone: "accent" },
  COMPLETED: { label: "Tamamlandı", tone: "ok" },
  CANCELLED: { label: "İptal", tone: "faint" },
  NO_SHOW: { label: "Gelmedi", tone: "bad" },
};

/** ISO hafta günü (1=Pzt … 7=Paz) */
export const isoWeekday = (ymd: string) => ((new Date(`${ymd}T12:00:00`).getDay() + 6) % 7) + 1;
