import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Calendar, LocaleConfig } from "react-native-calendars";
import { useApp } from "../context/AppContext";
import { appointmentApi, salonApi } from "../services/api";
import AppHeader from "../components/AppHeader";
import { Button, Field } from "../components/ui";
import { colors, formatTL } from "../components/theme";
import { discountOn, discountRange, priceOn } from "../components/pricing";
import { LoadError, FormSkeleton } from "../components/Skeleton";

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
  const [staffId, setStaffId] = useState(route.params?.staffId ?? null); // null = fark etmez
  const [date, setDate] = useState("");
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

  // Seçimler değişince boş saatleri yeniden getir.
  useEffect(() => {
    setTime("");
    if (!date || serviceIds.length === 0) return setSlots([]);
    let cancelled = false;
    setSlotsLoading(true);
    salonApi
      .availability(salonId, { date, serviceIds, staffId: staffId ?? undefined })
      .then((res) => {
        if (cancelled) return;
        const all = new Set(res.staff.flatMap((s) => s.slots));
        setSlots([...all].sort());
      })
      .catch((e) => !cancelled && Alert.alert("Saatler alınamadı", e.message))
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
  const total = selectedServices.reduce((sum, s) => sum + priceOn(s, priceDay), 0);
  const duration = selectedServices.reduce((sum, s) => sum + s.durationMinutes, 0);

  const toggleService = (id) => setServiceIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

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

  const submit = async () => {
    if (!/^(\+90|0)?5\d{9}$/.test(phone.replace(/[\s()-]/g, ""))) {
      Alert.alert("Telefon gerekli", "Salonun size ulaşabilmesi için geçerli bir cep telefonu girin.");
      return;
    }
    setSubmitting(true);
    try {
      const { appointment } = await appointmentApi.create({
        salonId,
        ...(staffId ? { staffId } : {}),
        serviceIds,
        date,
        time,
        phone,
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      Alert.alert(
        appointment.status === "CONFIRMED" ? "Randevunuz onaylandı 🎉" : "Randevu talebiniz alındı",
        `${appointment.salon.name}\n${appointment.date} · ${appointment.time}\nPersonel: ${appointment.staff.name}\nRandevu kodu: ${appointment.code}`,
        [{ text: "Randevularım", onPress: () => navigation.reset({ index: 0, routes: [{ name: "Appointments" }] }) }],
      );
    } catch (e) {
      Alert.alert("Randevu alınamadı", e.message);
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
        {salon.services.map((s) => {
          const on = serviceIds.includes(s.id);
          const deal = discountOn(s, priceDay);
          return (
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
              Alert.alert("Salon kapalı", "Bu gün salon kapalı, lütfen başka bir gün seçin.");
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
          <Text style={styles.hint}>Bu tarihte boş saat yok, lütfen başka bir gün deneyin.</Text>
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
          </Text>
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
