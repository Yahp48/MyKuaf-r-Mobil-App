import React, { useCallback } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AppHeader from "../components/AppHeader";
import { BottomNavSpacer } from "../components/BottomNav";
import { Button } from "../components/ui";
import { useRemote } from "../components/useRemote";
import { colors } from "../components/theme";
import { ListSkeleton, LoadError } from "../components/Skeleton";
import { userApi } from "../services/api";
import { confirm, toast } from "../components/Feedback";

const ICONS = { ev: "home-outline", iş: "briefcase-outline", is: "briefcase-outline", ofis: "briefcase-outline" };
const iconFor = (title) => ICONS[title.trim().toLocaleLowerCase("tr-TR")] ?? "location-outline";

/** Teslimat adresleri: ekle, düzenle, varsayılan yap, sil. */
export default function AddressesScreen({ navigation }) {
  const loader = useCallback(() => userApi.addresses().then((r) => r.items), []);
  const { data, setData, error, loading, refreshing, reload, refresh } = useRemote(loader);

  const makeDefault = async (a) => {
    try {
      await userApi.updateAddress(a.id, { isDefault: true });
      setData((list) => list.map((x) => ({ ...x, isDefault: x.id === a.id })));
    } catch (e) {
      toast.error("Kaydedilemedi", e.message);
    }
  };

  const remove = (a) =>
    confirm({
      title: "Adres silinsin mi?",
      message: `"${a.title}" adresi silinecek.`,
      confirmText: "Sil",
      destructive: true,
    }).then(
      (ok) =>
        ok &&
        (async () => {
          try {
            await userApi.deleteAddress(a.id);
            reload();
          } catch (e) {
            toast.error("Silinemedi", e.message);
          }
        })(),
    );

  return (
    <View style={styles.container}>
      <AppHeader title="Adreslerim" back />
      {loading && !data ? (
        <ListSkeleton rows={4} avatar="square" />
      ) : error && !data ? (
        <LoadError message={error} onRetry={reload} skeleton={<ListSkeleton rows={4} avatar="square" />} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
        >
          {data.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="location-outline" size={28} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>Kayıtlı adresiniz yok</Text>
              <Text style={styles.emptyText}>Siparişleriniz için teslimat adresi ekleyin.</Text>
            </View>
          ) : (
            data.map((a) => (
              <View key={a.id} style={[styles.card, a.isDefault && styles.cardDefault]}>
                <View style={styles.head}>
                  <View style={styles.icon}>
                    <Ionicons name={iconFor(a.title)} size={18} color={colors.primary} />
                  </View>
                  <Text style={styles.title}>{a.title}</Text>
                  {a.isDefault ? (
                    <View style={styles.pill}>
                      <Text style={styles.pillText}>Varsayılan</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.name}>
                  {a.fullName} · {a.phone}
                </Text>
                <Text style={styles.line}>
                  {a.line}
                  {a.postalCode ? `, ${a.postalCode}` : ""}
                </Text>
                <Text style={styles.line}>
                  {a.district} / {a.city}
                </Text>
                <View style={styles.actions}>
                  <Action
                    icon="create-outline"
                    label="Düzenle"
                    onPress={() => navigation.navigate("AddressForm", { address: a })}
                  />
                  {!a.isDefault ? (
                    <Action icon="star-outline" label="Varsayılan yap" onPress={() => makeDefault(a)} />
                  ) : null}
                  <Action icon="trash-outline" label="Sil" danger onPress={() => remove(a)} />
                </View>
              </View>
            ))
          )}
          {data.length < 10 ? (
            <Button title="+ Yeni adres ekle" onPress={() => navigation.navigate("AddressForm")} />
          ) : (
            <Text style={styles.limit}>En fazla 10 adres kaydedebilirsiniz.</Text>
          )}
        </ScrollView>
      )}
      <BottomNavSpacer />
    </View>
  );
}

function Action({ icon, label, onPress, danger }) {
  return (
    <TouchableOpacity style={styles.action} onPress={onPress} accessibilityRole="button">
      <Ionicons name={icon} size={15} color={danger ? colors.danger : colors.text} />
      <Text style={[styles.actionText, danger && { color: colors.danger }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  scroll: { padding: 16, paddingBottom: 32 },
  card: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  cardDefault: { borderColor: colors.primarySoft },
  head: { flexDirection: "row", alignItems: "center", gap: 10 },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { flex: 1, fontSize: 16, fontWeight: "700", color: colors.text },
  pill: { backgroundColor: colors.primarySoft, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  pillText: { color: colors.primary, fontSize: 11.5, fontWeight: "800" },
  name: { fontSize: 14, color: colors.text, marginTop: 10, fontWeight: "500" },
  line: { fontSize: 13.5, color: colors.muted, marginTop: 3, lineHeight: 19 },
  actions: { flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap" },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  actionText: { fontSize: 13, fontWeight: "600", color: colors.text },
  empty: { alignItems: "center", padding: 28, backgroundColor: colors.background, borderRadius: 18, marginBottom: 16 },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: colors.text, marginTop: 12 },
  emptyText: { fontSize: 14, color: colors.muted, textAlign: "center", marginTop: 6 },
  limit: { textAlign: "center", color: colors.muted, marginTop: 8 },
});
