import React, { useCallback } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { FontAwesome6 } from "@expo/vector-icons";
import { walletApi } from "../services/api";
import AppHeader from "../components/AppHeader";
import BottomNav from "../components/BottomNav";
import { EmptyState, ErrorState, Loading } from "../components/ui";
import { useRemote } from "../components/useRemote";
import { colors, formatDate, formatTL } from "../components/theme";

const TYPE_LABEL = { TOPUP: "Bakiye yükleme", PAYMENT: "Ödeme", REFUND: "İade" };

export default function WalletScreen({ navigation }) {
  const loader = useCallback(() => walletApi.get(), []);
  const { data, error, loading, refreshing, reload, refresh } = useRemote(loader);

  if (loading && !data) {
    return (
      <View style={styles.container}>
        <AppHeader title="Cüzdanım" back />
        <Loading />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader title="Cüzdanım" back />
      {error && !data ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <FlatList
          data={data.transactions.items}
          keyExtractor={(t) => t.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
          contentContainerStyle={{ paddingBottom: 24, flexGrow: 1 }}
          ListHeaderComponent={
            <>
              <LinearGradient colors={[colors.primary, colors.accent]} style={styles.card}>
                <View>
                  <Text style={styles.cardLabel}>Bakiyem</Text>
                  <Text style={styles.balance}>{formatTL(data.balance)}</Text>
                </View>
                <TouchableOpacity
                  style={styles.topup}
                  onPress={() => navigation.navigate("LoadMoney", { limits: data.limits })}
                  accessibilityLabel="Bakiye yükle"
                >
                  <FontAwesome6 name="wallet" size={28} color="#fff" />
                  <Text style={styles.topupText}>Yükle</Text>
                </TouchableOpacity>
              </LinearGradient>
              <Text style={styles.section}>Son hareketler</Text>
            </>
          }
          renderItem={({ item: t }) => (
            <View style={styles.tx}>
              <View style={{ flex: 1 }}>
                <Text style={styles.txTitle}>{TYPE_LABEL[t.type] ?? t.type}</Text>
                <Text style={styles.txMeta}>{t.description}</Text>
                <Text style={styles.txMeta}>{formatDate(t.createdAt, true)}</Text>
              </View>
              <Text style={[styles.amount, { color: t.amount >= 0 ? colors.success : colors.danger }]}>
                {t.amount >= 0 ? "+" : ""}
                {formatTL(t.amount)}
              </Text>
            </View>
          )}
          ListEmptyComponent={<EmptyState icon="account-balance-wallet" title="Henüz işlem yapmadınız" />}
        />
      )}
      <BottomNav active="Profile" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  card: {
    margin: 16,
    borderRadius: 18,
    padding: 22,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardLabel: { color: "#ffe3ef", fontSize: 14 },
  balance: { color: "#fff", fontSize: 30, fontWeight: "bold", marginTop: 4 },
  topup: { alignItems: "center", padding: 8 },
  topupText: { color: "#fff", marginTop: 6, fontWeight: "600" },
  section: { fontSize: 16, fontWeight: "bold", color: colors.text, marginHorizontal: 16, marginBottom: 6 },
  tx: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    marginHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  txTitle: { fontSize: 15, fontWeight: "600", color: colors.text },
  txMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  amount: { fontSize: 15, fontWeight: "bold" },
});
