import React, { useCallback, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { favoriteApi } from "../services/api";
import AppHeader from "../components/AppHeader";
import ProductCard from "../components/ProductCard";
import { EmptyState } from "../components/ui";
import { useRemote } from "../components/useRemote";
import { colors } from "../components/theme";
import { LoadError, GridSkeleton } from "../components/Skeleton";
import { toast } from "../components/Feedback";

export default function FavoritesScreen({ navigation }) {
  const loader = useCallback(() => favoriteApi.list(), []);
  const { data, setData, error, loading, refreshing, reload, refresh } = useRemote(loader);
  const [tab, setTab] = useState("salons");

  const removeSalon = async (id) => {
    const prev = data;
    setData((d) => ({ ...d, salons: d.salons.filter((s) => s.id !== id) }));
    try {
      await favoriteApi.removeSalon(id);
    } catch (e) {
      setData(prev);
      toast.error("Hata", e.message);
    }
  };

  const removeProduct = async (id) => {
    const prev = data;
    setData((d) => ({ ...d, products: d.products.filter((p) => p.id !== id) }));
    try {
      await favoriteApi.removeProduct(id);
    } catch (e) {
      setData(prev);
      toast.error("Hata", e.message);
    }
  };

  let content;
  if (loading && !data) content = <GridSkeleton />;
  else if (error && !data) content = <LoadError message={error} onRetry={reload} skeleton={<GridSkeleton />} />;
  else {
    const list = tab === "salons" ? data.salons : data.products;
    content = (
      <ScrollView
        contentContainerStyle={{ padding: 16, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      >
        {list.length === 0 ? (
          <EmptyState
            icon="favorite-border"
            title={tab === "salons" ? "Favori salonunuz yok" : "Favori ürününüz yok"}
            message={
              tab === "salons"
                ? "Haritada bir salonu 'Kaydet' ile ekleyebilirsiniz."
                : "Ürün sayfasındaki kalp ile ekleyebilirsiniz."
            }
          />
        ) : tab === "salons" ? (
          data.salons.map((s) => (
            <View key={s.id} style={styles.salon}>
              <View style={{ flex: 1 }}>
                <Text style={styles.salonName}>{s.name}</Text>
                <Text style={styles.meta}>{s.address}</Text>
                <Text style={[styles.meta, { color: s.isOpenNow ? colors.success : colors.danger }]}>
                  {s.isOpenNow ? "Şu an açık" : "Şu an kapalı"}
                </Text>
                <TouchableOpacity
                  style={styles.book}
                  onPress={() => navigation.navigate("CalendarScreen", { salonId: s.id, salonName: s.name })}
                >
                  <Text style={styles.bookText}>Randevu al</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={() => removeSalon(s.id)} accessibilityLabel="Favorilerden çıkar" hitSlop={10}>
                <MaterialIcons name="favorite" size={26} color={colors.primary} />
              </TouchableOpacity>
            </View>
          ))
        ) : (
          <View style={styles.grid}>
            {data.products.map((p) => (
              <View key={p.id} style={styles.gridItem}>
                <ProductCard product={p} onPress={() => navigation.navigate("ProductDetail", { productId: p.id })} />
                <TouchableOpacity
                  style={styles.heart}
                  onPress={() => removeProduct(p.id)}
                  accessibilityLabel="Favorilerden çıkar"
                >
                  <MaterialIcons name="favorite" size={22} color={colors.primary} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader title="Favorilerim" back />
      <View style={styles.tabs}>
        {[
          ["salons", "Salonlar"],
          ["products", "Ürünler"],
        ].map(([key, label]) => (
          <TouchableOpacity key={key} style={[styles.tab, tab === key && styles.tabOn]} onPress={() => setTab(key)}>
            <Text style={[styles.tabText, tab === key && { color: colors.primary }]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {content}
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
  tabOn: { backgroundColor: "#fff", elevation: 2 },
  tabText: { color: colors.muted, fontWeight: "600" },
  salon: {
    flexDirection: "row",
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  salonName: { fontSize: 16, fontWeight: "bold", color: colors.text },
  meta: { fontSize: 13, color: colors.muted, marginTop: 3 },
  book: {
    marginTop: 10,
    alignSelf: "flex-start",
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  bookText: { color: "#fff", fontWeight: "600" },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  gridItem: { width: "48.5%", marginBottom: 12 },
  heart: { position: "absolute", top: 8, right: 8, backgroundColor: "#fff", borderRadius: 16, padding: 5 },
});
