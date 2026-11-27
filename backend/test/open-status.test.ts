import { describe, expect, it } from "vitest";
import { openStatus } from "../src/modules/salons/serialize.ts";

// Pzt-Cmt 09:00-19:00, Pazar kapalı
const hours = Array.from({ length: 7 }, (_, i) => ({ weekday: i + 1, openMinute: 540, closeMinute: 1140, isClosed: i === 6 }));
const at = (iso: string) => new Date(iso);

describe("açık/kapalı ve sonraki açılış", () => {
  it("çalışma saatinde açık, sonraki açılış yok", () => {
    const s = openStatus("Europe/Istanbul", hours, at("2026-11-25T10:00:00+03:00")); // Çarşamba
    expect(s).toMatchObject({ isOpenNow: true, nextOpen: null, todayHours: { opens: "09:00", closes: "19:00" } });
  });
  it("sabah açılmadan önce: bugün 09:00", () => {
    const s = openStatus("Europe/Istanbul", hours, at("2026-11-25T07:30:00+03:00"));
    expect(s.nextOpen).toEqual({ day: "bugün", time: "09:00", label: "09:00" });
  });
  it("akşam kapandıktan sonra: yarın 09:00", () => {
    const s = openStatus("Europe/Istanbul", hours, at("2026-11-25T20:00:00+03:00"));
    expect(s.nextOpen?.label).toBe("yarın 09:00");
  });
  it("cumartesi akşamı: pazar kapalı olduğu için Pazartesi 09:00", () => {
    const s = openStatus("Europe/Istanbul", hours, at("2026-11-28T20:00:00+03:00"));
    expect(s.nextOpen?.label).toBe("Pazartesi 09:00");
  });
  it("hiç açık günü olmayan salonda sonraki açılış yok", () => {
    const closed = hours.map((h) => ({ ...h, isClosed: true }));
    expect(openStatus("Europe/Istanbul", closed, at("2026-11-25T10:00:00+03:00")).nextOpen).toBeNull();
  });
});
