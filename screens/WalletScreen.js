import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, SectionList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { walletApi } from "../services/api";
import AppHeader from "../components/AppHeader";
import { BottomNavSpacer } from "../components/BottomNav";
import { useRemote } from "../components/useRemote";
import { colors, formatTL, shadow } from "../components/theme";
import { LoadError, WalletSkeleton } from "../components/Skeleton";

const TYPES = {
  TOPUP: { label: "Bakiye yükleme", icon: "arrow-down", tint: colors.primary, bg: colors.primarySoft },
  PAYMENT: { label: "Ödeme", icon: "bag-handle-outline", tint: colors.text, bg: "#EFEFF2" },
  REFUND: { label: "İade", icon: "arrow-undo", tint: colors.success, bg: "#E6F4EA" },
  LOYALTY: { label: "Puan aktarımı", icon: "star", tint: colors.warning, bg: "#FFF4E0" },
};
const FILTERS = [
  { key: null, label: "Tümü" },
  { key: "TOPUP", label: "Yüklemeler" },
  { key: "PAYMENT", label: "Ödemeler" },
  { key: "REFUND", label: "İadeler" },
];
const QUICK = [100, 250, 500];

const dayKey = (iso) => new Date(iso).toDateString();
function dayTitle(iso) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Bugün";
  if (d.toDateString() === yesterday.toDateString()) return "Dün";
  return d.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    ...(d.getFullYear() !== today.getFullYear() ? { year: "numeric" } : {}),
  });
}
const time = (iso) => new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });

export default function WalletScreen({ navigation }) {
  const [filter, setFilter] = useState(null);
  const [extra, setExtra] = useState({ items: [], page: 1, hasNext: null, loading: false });
  const loader = useCallback(() => walletApi.get(1, filter ?? undefined), [filter]);
  const { data, error, loading, refreshing, reload, refresh } = useRemote(loader);

  const items = useMemo(() => {
    if (!data) return [];
    const seen = new Set();
    return [...data.transactions.items, ...extra.items].filter((t) => !seen.has(t.id) && seen.add(t.id));
  }, [data, extra.items]);
  const hasNext = extra.hasNext ?? data?.transactions.hasNextPage;

  const sections = useMemo(() => {
    const groups = [];
    for (const t of items) {
      const key = dayKey(t.createdAt);
      const last = groups[groups.length - 1];
      if (last?.key === key) last.data.push(t);
      else groups.push({ key, title: dayTitle(t.createdAt), data: [t] });
    }
    return groups;
  }, [items]);

  const changeFilter = (key) => {
    setExtra({ items: [], page: 1, hasNext: null, loading: false });
    setFilter(key);
  };

  const loadMore = async () => {
    if (!hasNext || extra.loading) return;
    setExtra((e) => ({ ...e, loading: true }));
    try {
      const next = await walletApi.get(extra.page + 1, filter ?? undefined);
      setExtra((e) => ({
        items: [...e.items, ...next.transactions.items],
        page: e.page + 1,
        hasNext: next.transactions.hasNextPage,
        loading: false,
      }));
    } catch {
      setExtra((e) => ({ ...e, loading: false }));
    }
  };

  const topup = (amount) => navigation.navigate("LoadMoney", { limits: data?.limits, amount });

  if (loading && !data) {
    return (
      <View style={styles.container}>
        <AppHeader title="Cüzdanım" back />
        <WalletSkeleton />
        <BottomNavSpacer />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader title="Cüzdanım" back />
      {error && !data ? (
        <LoadError message={error} onRetry={reload} skeleton={<WalletSkeleton />} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(t) => t.id}
          stickySectionHeadersEnabled={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setExtra({ items: [], page: 1, hasNext: null, loading: false });
                refresh();
              }}
              tintColor={colors.primary}
            />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          contentContainerStyle={{ paddingBottom: 32 }}
          ListHeaderComponent={
            <View>
              <LinearGradient
                colors={["#2A1A20", "#1C1C1E"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.card}
              >
                <View style={styles.glowA} />
                <View style={styles.glowB} />
                <View style={styles.cardTop}>
                  <View style={styles.brandRow}>
                    <View style={styles.brandDot}>
                      <Ionicons name="wallet" size={14} color="#fff" />
                    </View>
                    <Text style={styles.brand}>BiBakım Cüzdan</Text>
                  </View>
                  <Ionicons name="shield-checkmark-outline" size={18} color="rgba(255,255,255,0.6)" />
                </View>
                <Text style={styles.cardLabel}>Kullanılabilir bakiye</Text>
                <Text style={styles.balance} accessibilityLabel={`Bakiye ${formatTL(data.balance)}`}>
                  {formatTL(data.balance)}
                </Text>
                <View style={styles.cardActions}>
                  <TouchableOpacity style={styles.topupBtn} onPress={() => topup()} accessibilityRole="button">
                    <Ionicons name="add" size={18} color={colors.text} />
                    <Text style={styles.topupText}>Bakiye yükle</Text>
                  </TouchableOpacity>
                  {QUICK.map((q) => (
                    <TouchableOpacity
                      key={q}
                      style={styles.quick}
                      onPress={() => topup(q)}
                      accessibilityRole="button"
                      accessibilityLabel={`${formatTL(q)} yükle`}
                    >
                      <Text style={styles.quickText}>+{q}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </LinearGradient>

              <View style={styles.stats}>
                <Stat icon="trending-down" label="Bu ay harcanan" value={formatTL(data.month.spent)} />
                <Stat icon="arrow-down-circle-outline" label="Bu ay yüklenen" value={formatTL(data.month.loaded)} />
                <Stat icon="arrow-undo-outline" label="Bu ay iade" value={formatTL(data.month.refunded)} />
              </View>

              <View style={styles.historyHead}>
                <Text style={styles.section}>Hesap hareketleri</Text>
              </View>
              <View style={styles.filters}>
                {FILTERS.map((f) => {
                  const on = f.key === filter;
                  return (
                    <TouchableOpacity
                      key={f.label}
                      onPress={() => changeFilter(f.key)}
                      style={[styles.filter, on && styles.filterOn]}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: on }}
                    >
                      <Text style={[styles.filterText, on && styles.filterTextOn]}>{f.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          }
          renderSectionHeader={({ section }) => <Text style={styles.dayTitle}>{section.title}</Text>}
          renderItem={({ item: t, index, section }) => {
            const type = TYPES[t.type] ?? TYPES.PAYMENT;
            const positive = t.amount >= 0;
            const first = index === 0;
            const last = index === section.data.length - 1;
            return (
              <View style={[styles.tx, first && styles.txFirst, last && styles.txLast]}>
                <View style={[styles.txIcon, { backgroundColor: type.bg }]}>
                  <Ionicons name={type.icon} size={18} color={type.tint} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.txTitle} numberOfLines={1}>
                    {t.description || type.label}
                  </Text>
                  <Text style={styles.txMeta}>
                    {type.label} · {time(t.createdAt)}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={[styles.amount, { color: positive ? colors.success : colors.text }]}>
                    {positive ? "+" : "−"}
                    {formatTL(Math.abs(t.amount))}
                  </Text>
                  <Text style={styles.after}>Bakiye {formatTL(t.balanceAfter)}</Text>
                </View>
                {!last ? <View style={styles.divider} /> : null}
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="receipt-outline" size={26} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>{filter ? "Bu türde hareket yok" : "Henüz hareket yok"}</Text>
              <Text style={styles.emptyText}>
                Bakiye yüklediğinizde veya cüzdanla ödeme yaptığınızda hareketleriniz burada görünür.
              </Text>
            </View>
          }
          ListFooterComponent={
            <View>
              {extra.loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 12 }} /> : null}
              <View style={styles.info}>
                <Ionicons name="information-circle-outline" size={18} color={colors.muted} />
                <Text style={styles.infoText}>
                  Cüzdan bakiyesi BiBakım'daki randevu ve ürün ödemelerinde kullanılır. Yüklemeler lisanslı ödeme
                  kuruluşunun 3D Secure sayfasında yapılır; kart bilgileriniz bizde saklanmaz.
                </Text>
              </View>
            </View>
          }
        />
      )}
      <BottomNavSpacer />
    </View>
  );
}

function Stat({ icon, label, value }) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  card: {
    margin: 16,
    marginBottom: 0,
    borderRadius: 24,
    padding: 20,
    overflow: "hidden",
    ...shadow,
    shadowOpacity: 0.2,
  },
  glowA: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: colors.primary,
    opacity: 0.35,
    top: -90,
    right: -70,
  },
  glowB: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.primary,
    opacity: 0.15,
    bottom: -80,
    left: -40,
  },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  brandDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  brand: { color: "#fff", fontWeight: "700", fontSize: 14, letterSpacing: 0.3 },
  cardLabel: { color: "rgba(255,255,255,0.65)", fontSize: 13, marginTop: 26 },
  balance: { color: "#fff", fontSize: 36, fontWeight: "800", letterSpacing: -1, marginTop: 4 },
  cardActions: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 22 },
  topupBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#fff",
    borderRadius: 20,
    height: 40,
    paddingHorizontal: 14,
  },
  topupText: { color: colors.text, fontWeight: "800", fontSize: 14 },
  quick: {
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
  },
  quickText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  stats: { flexDirection: "row", gap: 10, marginHorizontal: 16, marginTop: 14 },
  stat: { flex: 1, backgroundColor: colors.background, borderRadius: 16, padding: 12, gap: 4 },
  statValue: { fontSize: 15, fontWeight: "800", color: colors.text, marginTop: 4 },
  statLabel: { fontSize: 11.5, color: colors.muted },
  historyHead: { marginHorizontal: 16, marginTop: 24 },
  section: { fontSize: 18, fontWeight: "800", color: colors.text, letterSpacing: -0.3 },
  filters: { flexDirection: "row", gap: 8, marginHorizontal: 16, marginTop: 12, marginBottom: 4 },
  filter: {
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background,
    justifyContent: "center",
  },
  filterOn: { backgroundColor: colors.text },
  filterText: { fontSize: 13, fontWeight: "600", color: colors.text },
  filterTextOn: { color: "#fff" },
  dayTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.muted,
    marginHorizontal: 20,
    marginTop: 18,
    marginBottom: 8,
  },
  tx: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.background,
    marginHorizontal: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  txFirst: { borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  txLast: { borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
  txIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  txTitle: { fontSize: 15, fontWeight: "600", color: colors.text },
  txMeta: { fontSize: 12.5, color: colors.muted, marginTop: 2 },
  amount: { fontSize: 15, fontWeight: "800" },
  after: { fontSize: 11.5, color: colors.faint, marginTop: 2 },
  divider: {
    position: "absolute",
    left: 66,
    right: 14,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  empty: { alignItems: "center", margin: 16, padding: 28, backgroundColor: colors.background, borderRadius: 16 },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: colors.text, marginTop: 12 },
  emptyText: { fontSize: 13.5, color: colors.muted, textAlign: "center", marginTop: 6, lineHeight: 19 },
  info: { flexDirection: "row", gap: 8, marginHorizontal: 20, marginTop: 20 },
  infoText: { flex: 1, fontSize: 12.5, color: colors.muted, lineHeight: 18 },
});
