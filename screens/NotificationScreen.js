import React, { useCallback } from "react";
import { Alert, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { notificationApi } from "../services/api";
import { useApp } from "../context/AppContext";
import AppHeader from "../components/AppHeader";
import BottomNav from "../components/BottomNav";
import { EmptyState, ErrorState, Loading } from "../components/ui";
import { useRemote } from "../components/useRemote";
import { colors, formatDate } from "../components/theme";

const ICONS = {
  appointment_confirmed: "event-available",
  appointment_cancelled: "event-busy",
  order_paid: "shopping-bag",
  order_status: "local-shipping",
  wallet_topup: "account-balance-wallet",
};

export default function NotificationScreen({ navigation }) {
  const { actions } = useApp();
  // setUnreadNotifications bir useState ayarlayıcısı: kimliği sabit, döngüye girmez.
  const setUnread = actions.setUnreadNotifications;
  const loader = useCallback(async () => {
    const res = await notificationApi.list();
    setUnread(res.unreadCount);
    return res;
  }, [setUnread]);
  const { data, setData, error, loading, refreshing, reload, refresh } = useRemote(loader);

  const markRead = (n) => {
    if (n.read) return;
    setData((d) => ({
      ...d,
      items: d.items.map((x) => (x.id === n.id ? { ...x, read: true } : x)),
      unreadCount: d.unreadCount - 1,
    }));
    actions.setUnreadNotifications((c) => Math.max(0, c - 1));
    notificationApi.markRead(n.id).catch(() => {});
  };

  const open = (n) => {
    markRead(n);
    if (n.data?.appointmentId) navigation.navigate("Appointments");
    else if (n.data?.orderId) navigation.navigate("OrderDetail", { orderId: n.data.orderId });
    else if (n.type === "wallet_topup") navigation.navigate("WalletScreen");
  };

  const markAll = async () => {
    try {
      await notificationApi.markAllRead();
      setData((d) => ({ ...d, items: d.items.map((x) => ({ ...x, read: true })), unreadCount: 0 }));
      actions.setUnreadNotifications(0);
    } catch (e) {
      Alert.alert("Hata", e.message);
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Bildirimler" back />
      {loading && !data ? (
        <Loading />
      ) : error && !data ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <FlatList
          data={data.items}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
          ListHeaderComponent={
            data.unreadCount > 0 ? (
              <TouchableOpacity style={styles.markAll} onPress={markAll}>
                <Text style={styles.markAllText}>Tümünü okundu işaretle</Text>
              </TouchableOpacity>
            ) : null
          }
          renderItem={({ item: n }) => (
            <TouchableOpacity style={[styles.item, !n.read && styles.unread]} onPress={() => open(n)}>
              <MaterialIcons name={ICONS[n.type] ?? "notifications"} size={26} color={colors.primary} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.title, !n.read && { fontWeight: "bold" }]}>{n.title}</Text>
                <Text style={styles.body}>{n.body}</Text>
                <Text style={styles.date}>{formatDate(n.createdAt, true)}</Text>
              </View>
              {!n.read && <View style={styles.dot} />}
            </TouchableOpacity>
          )}
          ListEmptyComponent={<EmptyState icon="notifications-none" title="Henüz bildiriminiz yok" />}
        />
      )}
      <BottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  markAll: { alignSelf: "flex-end", padding: 14 },
  markAllText: { color: colors.primary, fontWeight: "600" },
  item: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  unread: { backgroundColor: "#fff5fa" },
  title: { fontSize: 15, color: colors.text },
  body: { fontSize: 14, color: colors.muted, marginTop: 2, lineHeight: 19 },
  date: { fontSize: 12, color: "#aaa", marginTop: 4 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.primary, marginTop: 6 },
});
