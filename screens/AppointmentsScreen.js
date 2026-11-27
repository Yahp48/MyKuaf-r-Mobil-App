import React, { useCallback, useState } from "react";
import { Alert, FlatList, Linking, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { appointmentApi } from "../services/api";
import AppHeader from "../components/AppHeader";
import BottomNav from "../components/BottomNav";
import { Button, EmptyState, ErrorState, Loading, StatusPill } from "../components/ui";
import { useRemote } from "../components/useRemote";
import { useRealtimeEvent } from "../services/realtime";
import { APPOINTMENT_STATUS, colors, formatDate, formatTL } from "../components/theme";

export default function AppointmentsScreen({ navigation }) {
  const [scope, setScope] = useState("upcoming");
  const loader = useCallback(() => appointmentApi.list(scope), [scope]);
  const { data, setData, error, loading, refreshing, reload, refresh } = useRemote(loader);
  // Salon randevuyu onaylar/iptal eder/taşırsa liste anında güncellenir.
  useRealtimeEvent("appointment:updated", () => reload());
  const [cancellingId, setCancellingId] = useState(null);

  const cancel = (a) =>
    Alert.alert("Randevuyu iptal et", `${a.salon.name} · ${a.date} ${a.time} randevunuz iptal edilsin mi?`, [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "İptal et",
        style: "destructive",
        onPress: async () => {
          setCancellingId(a.id);
          try {
            const { appointment } = await appointmentApi.cancel(a.id);
            setData((d) => ({
              ...d,
              items:
                scope === "upcoming"
                  ? d.items.filter((x) => x.id !== a.id)
                  : d.items.map((x) => (x.id === a.id ? appointment : x)),
            }));
          } catch (e) {
            Alert.alert("İptal edilemedi", e.message);
          } finally {
            setCancellingId(null);
          }
        },
      },
    ]);

  const renderItem = ({ item: a }) => {
    const status = APPOINTMENT_STATUS[a.status] ?? { label: a.status, color: colors.muted };
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <Text style={styles.salon}>{a.salon.name}</Text>
          <StatusPill label={status.label} color={status.color} />
        </View>
        <Text style={styles.when}>
          {formatDate(`${a.date}T12:00:00`)} · {a.time}
        </Text>
        <Text style={styles.meta}>Personel: {a.staff.name}</Text>
        <Text style={styles.meta}>{a.services.map((s) => s.name).join(", ")}</Text>
        <Text style={styles.meta}>
          Tutar: <Text style={styles.bold}>{formatTL(a.total)}</Text> (salonda ödenir) · Kod: {a.code}
        </Text>
        <View style={styles.actions}>
          {a.salon.phone ? (
            <TouchableOpacity style={styles.link} onPress={() => Linking.openURL(`tel:${a.salon.phone}`)}>
              <MaterialIcons name="call" size={18} color={colors.primary} />
              <Text style={styles.linkText}>Salonu ara</Text>
            </TouchableOpacity>
          ) : null}
          {a.canCancel ? (
            <Button
              title="İptal et"
              variant="outline"
              onPress={() => cancel(a)}
              loading={cancellingId === a.id}
              style={styles.cancelBtn}
            />
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Randevularım" />
      <View style={styles.tabs}>
        {[
          ["upcoming", "Yaklaşan"],
          ["past", "Geçmiş"],
        ].map(([key, label]) => (
          <TouchableOpacity
            key={key}
            style={[styles.tab, scope === key && styles.tabOn]}
            onPress={() => setScope(key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: scope === key }}
          >
            <Text style={[styles.tabText, scope === key && styles.tabTextOn]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && !data ? (
        <Loading />
      ) : error && !data ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <FlatList
          data={data?.items ?? []}
          keyExtractor={(a) => a.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <EmptyState
              icon="event-available"
              title={scope === "upcoming" ? "Yaklaşan randevunuz yok" : "Geçmiş randevunuz yok"}
              message="Haritadan bir salon seçip hemen randevu alabilirsiniz."
              actionTitle="Salon bul"
              onAction={() => navigation.navigate("Home")}
            />
          }
        />
      )}
      <BottomNav active="Appointments" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  tabs: {
    flexDirection: "row",
    margin: 16,
    marginBottom: 0,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 4,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10 },
  tabOn: { backgroundColor: "#fff", elevation: 2, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 4 },
  tabText: { color: colors.muted, fontWeight: "600" },
  tabTextOn: { color: colors.primary },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  salon: { fontSize: 16, fontWeight: "bold", color: colors.text, flex: 1, marginRight: 8 },
  when: { fontSize: 15, color: colors.primary, fontWeight: "600", marginBottom: 6 },
  meta: { fontSize: 13, color: colors.muted, marginBottom: 3 },
  bold: { fontWeight: "bold", color: colors.text },
  actions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 },
  link: { flexDirection: "row", alignItems: "center" },
  linkText: { color: colors.primary, marginLeft: 4, fontWeight: "600" },
  cancelBtn: { paddingVertical: 8, minHeight: 38, paddingHorizontal: 18 },
});
