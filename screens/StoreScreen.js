import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useApp } from "../context/AppContext";
import { storeApi } from "../services/api";
import AppHeader from "../components/AppHeader";
import BottomNav from "../components/BottomNav";
import ProductCard from "../components/ProductCard";
import ProductFilterSheet, { SORTS } from "../components/ProductFilterSheet";
import { DEFAULT_FILTERS, activeFilterCount, useProductList } from "../components/useProductList";
import { useRemote } from "../components/useRemote";
import { colors, formatTL } from "../components/theme";
import { Bone, GridSkeleton, LoadError, SkeletonGroup } from "../components/Skeleton";

const initials = (name = "") =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toLocaleUpperCase("tr-TR"))
    .join("");

/** Bir satıcının kendi mağaza sayfası: yalnızca o mağazanın ürünleri. */
export default function StoreScreen({ navigation, route }) {
  const { storeId, name } = route.params;
  const { actions } = useApp();
  const loader = useCallback(() => storeApi.detail(storeId).then((r) => r.store), [storeId]);
  const { data: store, error: storeError, reload: reloadStore } = useRemote(loader);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [sheet, setSheet] = useState(false);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [addingId, setAddingId] = useState(null);
  const list = useProductList({ filters, query, seller: storeId });

  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const addToCart = async (product) => {
    setAddingId(product.id);
    try {
      await actions.addToCart(product.id, 1);
      Alert.alert("Sepete eklendi", product.name, [
        { text: "Alışverişe devam", style: "cancel" },
        { text: "Sepete git", onPress: () => navigation.navigate("ShoppingCart") },
      ]);
    } catch (e) {
      Alert.alert("Sepete eklenemedi", e.message);
    } finally {
      setAddingId(null);
    }
  };

  const filterCount = activeFilterCount(filters);
  const title = store?.name ?? name ?? "Mağaza";

  const hero = (
    <View>
      {store ? (
        <View style={styles.hero}>
          {store.logoUrl ? (
            <Image source={{ uri: store.logoUrl }} style={styles.logo} />
          ) : (
            <View style={[styles.logo, styles.logoEmpty]}>
              <Text style={styles.logoText}>{initials(store.name)}</Text>
            </View>
          )}
          <Text style={styles.name}>{store.name}</Text>
          {store.description ? <Text style={styles.desc}>{store.description}</Text> : null}
          <View style={styles.facts}>
            <Fact icon="cube-outline" text={`${store.productCount} ürün`} />
            <Fact icon="location-outline" text={store.city} />
            <Fact
              icon="car-outline"
              text={
                store.freeShippingThreshold > 0
                  ? `${formatTL(store.freeShippingThreshold)} üzeri kargo bedava`
                  : "Kargo bedava"
              }
            />
          </View>
        </View>
      ) : storeError ? (
        <TouchableOpacity style={styles.hero} onPress={reloadStore}>
          <Text style={styles.desc}>Mağaza bilgileri yüklenemedi · Tekrar dene</Text>
        </TouchableOpacity>
      ) : (
        <SkeletonGroup style={[styles.hero, { gap: 10 }]}>
          <Bone w={84} h={84} r={42} />
          <Bone w={160} h={18} />
          <Bone w={220} h={12} />
        </SkeletonGroup>
      )}

      <View style={styles.toolbar}>
        <View style={styles.search}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Bu mağazada ara"
            placeholderTextColor={colors.faint}
            returnKeyType="search"
            accessibilityLabel="Mağazada ara"
          />
        </View>
        <TouchableOpacity style={styles.iconBtn} onPress={() => setSheet(true)} accessibilityLabel="Filtrele">
          <Ionicons name="options-outline" size={21} color={colors.text} />
          {filterCount ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{filterCount}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </View>
      <View style={styles.resultRow}>
        <Text style={styles.resultText}>{list.total !== null ? `${list.total} ürün` : " "}</Text>
        <TouchableOpacity onPress={() => setSheet(true)} style={styles.sortBtn}>
          <Ionicons name="swap-vertical" size={15} color={colors.text} />
          <Text style={styles.sortText}>{SORTS.find(([k]) => k === filters.sort)?.[1]}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <AppHeader title={title} back />
      {list.loading && list.items.length === 0 ? (
        <GridSkeleton />
      ) : list.error && list.items.length === 0 ? (
        <LoadError message={list.error} onRetry={list.reload} skeleton={<GridSkeleton />} />
      ) : (
        <FlatList
          data={list.items}
          keyExtractor={(p) => p.id}
          numColumns={2}
          ListHeaderComponent={hero}
          columnWrapperStyle={{ gap: 12, paddingHorizontal: 16 }}
          contentContainerStyle={{ gap: 12, paddingBottom: 24, flexGrow: 1 }}
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              style={{ flex: 1, maxWidth: "48.5%" }}
              adding={addingId === item.id}
              onAdd={() => addToCart(item)}
              onPress={() => navigation.navigate("ProductDetail", { productId: item.id })}
            />
          )}
          onEndReachedThreshold={0.4}
          onEndReached={list.loadMore}
          refreshControl={
            <RefreshControl
              refreshing={list.refreshing}
              onRefresh={() => {
                list.refresh();
                reloadStore();
              }}
              tintColor={colors.primary}
            />
          }
          ListFooterComponent={
            list.loadingMore ? <ActivityIndicator color={colors.primary} style={{ margin: 16 }} /> : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="search-outline" size={28} color={colors.faint} />
              <Text style={styles.emptyText}>Bu ölçütlere uyan ürün yok.</Text>
            </View>
          }
        />
      )}
      <ProductFilterSheet
        visible={sheet}
        value={filters}
        seller={storeId}
        onClose={() => setSheet(false)}
        onApply={(f) => {
          setFilters(f);
          setSheet(false);
        }}
      />
      <BottomNav active="Shop" />
    </View>
  );
}

function Fact({ icon, text }) {
  return (
    <View style={styles.fact}>
      <Ionicons name={icon} size={14} color={colors.primary} />
      <Text style={styles.factText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  hero: { alignItems: "center", paddingHorizontal: 20, paddingTop: 18, paddingBottom: 8 },
  logo: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  logoEmpty: { alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft },
  logoText: { color: colors.primary, fontWeight: "900", fontSize: 26 },
  name: { fontSize: 21, fontWeight: "800", color: colors.text, marginTop: 10, letterSpacing: -0.3 },
  desc: { fontSize: 14, color: colors.muted, textAlign: "center", marginTop: 4, lineHeight: 20 },
  facts: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 12 },
  fact: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  factText: { fontSize: 12.5, color: colors.text, fontWeight: "600" },
  toolbar: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  search: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 22,
    paddingHorizontal: 14,
    height: 42,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.text, paddingVertical: 0 },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.background,
  },
  badgeText: { color: "#fff", fontSize: 9.5, fontWeight: "800" },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 2,
  },
  resultText: { fontSize: 13, color: colors.muted },
  sortBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4 },
  sortText: { fontSize: 13, fontWeight: "700", color: colors.text },
  empty: { alignItems: "center", padding: 32, gap: 8 },
  emptyText: { fontSize: 14, color: colors.muted },
});
