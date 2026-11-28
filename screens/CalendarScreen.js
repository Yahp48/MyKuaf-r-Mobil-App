import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Calendar, LocaleConfig } from "react-native-calendars";
import { useApp } from "../context/AppContext";
import { appointmentApi, salonApi } from "../services/api";
import AppHeader from "../components/AppHeader";
import { Button, Field } from "../components/ui";
import { colors, formatTL } from "../components/theme";
import { discountOn, discountRange, priceOn } from "../components/pricing";
import { LoadError, FormSkeleton } from "../components/Skeleton";
import { toast } from "../components/Feedback";
import { useRealtimeEvent } from "../services/realtime";

LocaleConfig.locales.tr = {
  monthNames: [
    "Ocak",
    "Şubat",
    "Mart",
    "Nisan",
    "Mayıs",
    "Haziran",
    "Temmuz",
    "Ağustos",
    "Eylül",
    "Ekim",
    "Kasım",
    "Aralık",
  ],
  monthNamesShort: ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"],
  dayNames: ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"],
  dayNamesShort: ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"],
  today: "Bugün",
};
LocaleConfig.defaultLocale = "tr";

// Personel fotoğrafı sunucuda yoksa uygulamadaki görseller sırayla kullanılır.
const STAFF_IMAGES = [
  require("../assets/personel1.png"),
  require("../assets/personel2.png"),
  require("../assets/personel3.png"),
  require("../assets/personel4.png"),
];

const ymd = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function CalendarScreen({ navigation, route }) {
  const { salonId } = route.params;
  const { user } = useApp();

  const [salon, setSalon] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [serviceIds, setServiceIds] = useState(route.params?.serviceIds ?? []);
  // Paketle randevu: hizmetler paketten gelir, fiyat paket fiyatıdır
  const [packageId, setPackageId] = useState(route.params?.packageId ?? null);
  const [staffId, setStaffId] = useState(route.params?.staffId ?? null); // null = fark etmez
  const [date, setDate] = useState(route.params?.date ?? "");
  const [waitlisted, setWaitlisted] = useState([]);
  const [joining, setJoining] = useState(false);
  const [time, setTime] = useState("");
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [slotsVersion, setSlotsVersion] = useState(0);

  const loadSalon = useCallback(async () => {
    setLoadError(null);
    try {
      const { salon: s } = await salonApi.detail(salonId);
      setSalon(s);
    } catch (e) {
      setLoadError(e.message);
    }
  }, [salonId]);

  useEffect(() => {
    loadSalon();
  }, [loadSalon]);

  // Başka biri bu salonda randevu alır/iptal ederse boş saatler canlı tazelenir (seçim korunur).
  const liveReload = useRef(false);
  useRealtimeEvent("availability:changed", (p) => {
    if (p?.salonId !== salonId) return;
    liveReload.current = true;
    setSlotsVersion((v) => v + 1);
  });

  // Seçimler değişince boş saatleri yeniden getir.
  useEffect(() => {
    const live = liveReload.current;
    liveReload.current = false;
    if (!live) setTime("");
    if (!date || serviceIds.length === 0) return setSlots([]);
    let cancelled = false;
    if (!live) setSlotsLoading(true);
    salonApi
      .availability(salonId, { date, serviceIds, staffId: staffId ?? undefined })
      .then((res) => {
        if (cancelled) return;
        const all = new Set(res.staff.flatMap((s) => s.slots));
        setSlots([...all].sort());
        if (live) {
          setTime((t) => {
            if (t && !all.has(t)) {
              toast.info("Seçtiğiniz saat az önce doldu", "Lütfen başka bir saat seçin.");
              return "";
            }
            return t;
          });
        }
      })
      .catch((e) => !cancelled && !live && toast.error("Saatler alınamadı", e.message))
      .finally(() => !cancelled && setSlotsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [salonId, date, staffId, serviceIds, slotsVersion]);

  const selectedServices = useMemo(
    () => (salon?.services ?? []).filter((s) => serviceIds.includes(s.id)),
    [salon, serviceIds],
  );
  // İndirim randevu gününe göre uygulanır; gün seçilmediyse bugünün fiyatı gösterilir.
  const priceDay = date || undefined;
  const selectedPackage = (salon?.packages ?? []).find((p) => p.id === packageId) ?? null;
  const total = selectedPackage
    ? selectedPackage.price
    : selectedServices.reduce((sum, s) => sum + priceOn(s, priceDay), 0);
  const duration = selectedServices.reduce((sum, s) => sum + s.durationMinutes, 0);

  const toggleService = (id) => {
    setPackageId(null);
    setServiceIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  };
  const choosePackage = (p) => {
    if (packageId === p.id) {
      setPackageId(null);
      setServiceIds([]);
    } else {
      setPackageId(p.id);
      setServiceIds(p.services.map((s) => s.id));
    }
  };

  const { minDate, maxDate } = useMemo(() => {
    const now = new Date();
    const max = new Date();
    max.setDate(now.getDate() + (salon?.booking.bookingHorizonDays ?? 60));
    return { minDate: ymd(now), maxDate: ymd(max) };
  }, [salon]);

  const closedWeekdays = useMemo(
    () => new Set((salon?.workingHours ?? []).filter((h) => h.isClosed).map((h) => h.weekday % 7)),
    [salon],
  );

  // Bekleme listesi: seçilen günde bir randevu iptal olunca bildirim gelir.
  useEffect(() => {
    appointmentApi
      .waitlist()
      .then((r) => setWaitlisted(r.items.filter((w) => w.salonId === salonId && !w.notified).map((w) => w.date)))
      .catch(() => {});
  }, [salonId]);

  const joinWaitlist = async () => {
    setJoining(true);
    try {
      await salonApi.joinWaitlist(salonId, { date, serviceIds, ...(staffId ? { staffId } : {}) });
      setWaitlisted((w) => [...w, date]);
      toast.success("Listeye eklendiniz", "Bu günde bir randevu iptal olursa size hemen bildirim göndereceğiz.");
    } catch (e) {
      toast.error("Eklenemedi", e.message);
    } finally {
      setJoining(false);
    }
  };
  const leaveWaitlist = async () => {
    try {
      await salonApi.leaveWaitlist(salonId, date);
      setWaitlisted((w) => w.filter((d) => d !== date));
    } catch (e) {
      toast.error("Kaldırılamadı", e.message);
    }
  };

  const submit = async () => {
    if (!/^(\+90|0)?5\d{9}$/.test(phone.replace(/[\s()-]/g, ""))) {
      toast.error("Telefon gerekli", "Salonun size ulaşabilmesi için geçerli bir cep telefonu girin.");
      return;
    }
    setSubmitting(true);
    try {
      const { appointment } = await appointmentApi.create({
        salonId,
        ...(staffId ? { staffId } : {}),
        serviceIds,
        ...(packageId ? { packageId } : {}),
        date,
        time,
        phone,
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      // Randevu ayrıntıları (kod, tutar) Randevularım'da görünür; burada kısa bir onay yeterli.
      navigation.reset({ index: 0, routes: [{ name: "Appointments" }] });
      toast.success(
        appointment.status === "CONFIRMED" ? "Randevunuz onaylandı" : "Randevu talebiniz alındı",
        `${appointment.salon.name} · ${appointment.date} ${appointment.time}`,
      );
    } catch (e) {
      toast.error("Randevu alınamadı", e.message);
      if (e.code === "SLOT_UNAVAILABLE") setSlotsVersion((v) => v + 1); // dolan saati listeden düşür
    } finally {
      setSubmitting(false);
    }
  };

  if (loadError) {
    return (
      <View style={styles.container}>
        <AppHeader title="Randevu Al" back />
        <LoadError message={loadError} onRetry={loadSalon} skeleton={<FormSkeleton />} />
      </View>
    );
  }
  if (!salon) {
    return (
      <View style={styles.container}>
        <AppHeader title="Randevu Al" back />
        <FormSkeleton />
      </View>
    );
  }

  const canSubmit = serviceIds.length > 0 && date && time;

  return (
    <View style={styles.container}>
      <AppHeader title={salon.name} back />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.section}>1. Hizmet seçin</Text>
        {salon.packages?.length ? (
          <>
            <Text style={styles.subSection}>Paketler</Text>
            {salon.packages.map((p) => {
              const on = packageId === p.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.service, on && styles.serviceOn]}
                  onPress={() => choosePackage(p)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.serviceName, on && { color: "#fff" }]}>{p.name}</Text>
                    <Text style={[styles.serviceMeta, on && { color: "#FBD5DF" }]}>
                      {p.services.map((x) => x.name).join(" + ")} · {p.durationMinutes} dk
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    {p.saving > 0 ? (
                      <Text style={[styles.oldPrice, on && { color: "#FBD5DF" }]}>{formatTL(p.listPrice)}</Text>
                    ) : null}
                    <Text style={[styles.servicePrice, on && { color: "#fff" }]}>{formatTL(p.price)}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
            <Text style={styles.subSection}>Tek tek hizmetler</Text>
          </>
        ) : null}
        {salon.services.map((s, idx) => {
          const on = serviceIds.includes(s.id);
          const deal = discountOn(s, priceDay);
          const newGroup = s.category && s.category !== salon.services[idx - 1]?.category;
          return (
            <React.Fragment key={s.id}>
              {newGroup ? <Text style={styles.subSection}>{s.category}</Text> : null}
              <TouchableOpacity
                key={s.id}
                style={[styles.service, on && styles.serviceOn]}
                onPress={() => toggleService(s.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.serviceName, on && { color: "#fff" }]}>{s.name}</Text>
                  <Text style={[styles.serviceMeta, on && { color: "#FBD5DF" }]}>{s.durationMinutes} dk</Text>
                  {s.discount && !deal ? (
                    <Text style={[styles.dealNote, on && { color: "#FBD5DF" }]}>
                      %{s.discount.percent} indirim · {discountRange(s.discount)}
                    </Text>
                  ) : null}
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  {deal ? (
                    <>
                      <Text style={[styles.oldPrice, on && { color: "#FBD5DF" }]}>{formatTL(s.price)}</Text>
                      <Text style={[styles.servicePrice, on && { color: "#fff" }]}>{formatTL(deal.price)}</Text>
                      <Text style={[styles.dealBadge, on && styles.dealBadgeOn]}>%{deal.percent}</Text>
                    </>
                  ) : (
                    <Text style={[styles.servicePrice, on && { color: "#fff" }]}>{formatTL(s.price)}</Text>
                  )}
                </View>
              </TouchableOpacity>
            </React.Fragment>
          );
        })}

        <Text style={styles.section}>2. Personel</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <StaffChip label="Fark etmez" selected={staffId === null} onPress={() => setStaffId(null)} />
          {salon.staff.map((st, i) => (
            <StaffChip
              key={st.id}
              label={st.name}
              subtitle={st.title}
              image={st.avatarUrl ? { uri: st.avatarUrl } : STAFF_IMAGES[i % STAFF_IMAGES.length]}
              selected={staffId === st.id}
              onPress={() => setStaffId(st.id)}
            />
          ))}
        </ScrollView>

        <Text style={styles.section}>3. Tarih</Text>
        <Calendar
          minDate={minDate}
          maxDate={maxDate}
          firstDay={1}
          onDayPress={(day) => {
            const weekday = new Date(`${day.dateString}T12:00:00`).getDay();
            if (closedWeekdays.has(weekday)) {
              toast.error("Salon kapalı", "Bu gün salon kapalı, lütfen başka bir gün seçin.");
              return;
            }
            setDate(day.dateString);
          }}
          markedDates={date ? { [date]: { selected: true, selectedColor: colors.primary } } : {}}
          theme={{
            todayTextColor: colors.primary,
            arrowColor: colors.primary,
            selectedDayBackgroundColor: colors.primary,
          }}
        />

        <Text style={styles.section}>4. Saat</Text>
        {!date || serviceIds.length === 0 ? (
          <Text style={styles.hint}>Saatleri görmek için hizmet ve tarih seçin.</Text>
        ) : slotsLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} />
        ) : slots.length === 0 ? (
          <View style={styles.waitBox}>
            <Text style={styles.hint}>Bu tarihte boş saat yok.</Text>
            {waitlisted.includes(date) ? (
              <TouchableOpacity onPress={leaveWaitlist} style={styles.waitBtnOn} accessibilityRole="button">
                <Text style={styles.waitBtnOnText}>✓ Boşalırsa haber vereceğiz · Vazgeç</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={joinWaitlist}
                style={styles.waitBtn}
                disabled={joining}
                accessibilityRole="button"
              >
                <Text style={styles.waitBtnText}>{joining ? "Kaydediliyor…" : "Bu gün boşalırsa haber ver"}</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.times}>
            {slots.map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.time, time === t && styles.timeOn]}
                onPress={() => setTime(t)}
                accessibilityState={{ selected: time === t }}
              >
                <Text style={[styles.timeText, time === t && { color: "#fff" }]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={styles.section}>5. İletişim</Text>
        <Field label="Cep telefonu" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" />
        <Field
          label="Not (isteğe bağlı)"
          value={note}
          onChangeText={setNote}
          placeholder="Örn. saç boyu, alerji bilgisi"
          multiline
          maxLength={500}
        />

        <View style={styles.summary}>
          <Text style={styles.summaryRow}>
            Toplam süre: <Text style={styles.bold}>{duration} dk</Text>
          </Text>
          <Text style={styles.summaryRow}>
            Toplam tutar: <Text style={styles.bold}>{formatTL(total)}</Text>
            {selectedPackage ? " (paket)" : ""}
          </Text>
          {salon.firstVisitDiscountPercent ? (
            <Text style={[styles.hint, { color: colors.primary, fontWeight: "700" }]}>
              Bu salondaki ilk randevunuzsa %{salon.firstVisitDiscountPercent} ilk ziyaret indirimi uygulanır; kesin
              tutar onayda gösterilir.
            </Text>
          ) : null}
          <Text style={styles.hint}>
            Ödeme salonda yapılır. Randevunuzu başlangıcından {salon.booking.cancellationWindowHours} saat öncesine
            kadar uygulamadan iptal edebilirsiniz.
          </Text>
        </View>

        <Button title="Randevuyu Onayla" onPress={submit} loading={submitting} disabled={!canSubmit} />
      </ScrollView>
    </View>
  );
}

function StaffChip({ label, subtitle, image, selected, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.staff, selected && styles.staffOn]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      {image ? (
        <Image source={image} style={styles.staffImage} />
      ) : (
        <View style={[styles.staffImage, styles.anyStaff]} />
      )}
      <Text style={[styles.staffName, selected && { color: colors.primary }]}>{label}</Text>
      {subtitle ? <Text style={styles.staffTitle}>{subtitle}</Text> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  waitBox: { gap: 8 },
  waitBtn: {
    alignSelf: "flex-start",
    backgroundColor: colors.primarySoft,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  waitBtnText: { color: colors.primary, fontWeight: "800", fontSize: 14 },
  waitBtnOn: { alignSelf: "flex-start", paddingVertical: 6 },
  waitBtnOnText: { color: colors.success, fontWeight: "700", fontSize: 13.5 },
  subSection: { fontSize: 13, fontWeight: "800", color: colors.muted, marginTop: 4, marginBottom: 8 },
  oldPrice: { fontSize: 12.5, color: colors.muted, textDecorationLine: "line-through" },
  dealNote: { fontSize: 12, color: colors.primary, fontWeight: "600", marginTop: 2 },
  dealBadge: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: "800",
    color: "#fff",
    backgroundColor: colors.primary,
    borderRadius: 6,
    paddingHorizontal: 5,
    overflow: "hidden",
  },
  dealBadgeOn: { backgroundColor: "#fff", color: colors.primary },
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 16, paddingBottom: 48 },
  section: { fontSize: 17, fontWeight: "bold", color: colors.accent, marginTop: 20, marginBottom: 10 },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 4 },
  service: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#f0d0e0",
    marginBottom: 8,
  },
  serviceOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  serviceName: { fontSize: 15, fontWeight: "600", color: colors.text },
  serviceMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  servicePrice: { fontSize: 15, fontWeight: "bold", color: colors.primary },
  staff: {
    alignItems: "center",
    padding: 8,
    marginRight: 10,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "transparent",
    width: 92,
  },
  staffOn: { borderColor: colors.primary, backgroundColor: "#FDEEF2" },
  staffImage: { width: 60, height: 60, borderRadius: 30 },
  anyStaff: { backgroundColor: "#F5F5F7" },
  staffName: { marginTop: 6, fontWeight: "600", color: colors.text },
  staffTitle: { fontSize: 11, color: colors.muted },
  times: { flexDirection: "row", flexWrap: "wrap" },
  time: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary,
    marginRight: 8,
    marginBottom: 8,
  },
  timeOn: { backgroundColor: colors.primary },
  timeText: { color: colors.primary, fontWeight: "600" },
  summary: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginVertical: 16 },
  summaryRow: { fontSize: 15, color: colors.text, marginBottom: 4 },
  bold: { fontWeight: "bold" },
});
