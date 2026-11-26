import React, { useCallback } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { orderApi } from "../services/api";
import AppHeader from "../components/AppHeader";
import { EmptyState, ErrorState, Loading, StatusPill } from "../components/ui";
import { useRemote } from "../components/useRemote";
import { useRealtimeEvent } from "../services/realtime";
import { ORDER_STATUS, colors, formatDate, formatTL } from "../components/theme";

export default function OrderScreen({ navigation }) {
  const loader = useCallback(() => orderApi.list(), []);
  const { data, error, loading, refreshing, reload, refresh } = useRemote(loader);
  useRealtimeEvent("order:updated", () => reload());

  const renderItem = ({ item: o }) => {
    const status = ORDER_STATUS[o.status] ?? { label: o.status, color: colors.muted };
    return (
      <TouchableOpacity style={styles.card} onPress={() => navigation.navigate("OrderDetail", { orderId: o.id })}>
        <View style={styles.row}>
          <Text style={styles.number}>{o.orderNumber}</Text>
          <StatusPill label={status.label} color={status.color} />
        </View>
        <Text style={styles.meta}>{formatDate(o.createdAt, true)}</Text>
        <Text style={styles.meta} numberOfLines={1}>
          {o.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}
        </Text>
        <View style={styles.row}>
          <Text style={styles.total}>{formatTL(o.total)}</Text>
          <MaterialIcons name="chevron-right" size={24} color={colors.muted} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Siparişlerim" back />
      {loading && !data ? (
        <Loading />
      ) : error && !data ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <FlatList
          data={data?.items ?? []}
          keyExtractor={(o) => o.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <EmptyState
              icon="shopping-bag"
              title="Henüz siparişiniz yok"
              actionTitle="Mağazaya git"
              onAction={() => navigation.navigate("Shop")}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  number: { fontSize: 15, fontWeight: "bold", color: colors.text },
  meta: { fontSize: 13, color: colors.muted, marginTop: 4 },
  total: { fontSize: 17, fontWeight: "bold", color: colors.primary, marginTop: 8 },
});
