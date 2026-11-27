import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useApp } from "../context/AppContext";
import { productApi, storeApi } from "../services/api";
import AppHeader from "../components/AppHeader";
import BottomNav from "../components/BottomNav";
import ProductCard from "../components/ProductCard";
import ProductFilterSheet, { SORTS } from "../components/ProductFilterSheet";
import { DEFAULT_FILTERS, activeFilterCount, useProductList } from "../components/useProductList";
import { useRealtimeEvent } from "../services/realtime";
import { colors } from "../components/theme";
import { GridSkeleton, LoadError } from "../components/Skeleton";

const initials = (name) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toLocaleUpperCase("tr-TR"))
    .join("");

export default function ShopScreen({ navigation }) {
  const { state, actions } = useApp();
  const [categories, setCategories] = useState([]);
  const [stores, setStores] = useState([]);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [sheet, setSheet] = useState(false);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [addingId, setAddingId] = useState(null);
  const list = useProductList({ filters, query });

  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const loadMeta = () => {
    productApi
      .categories()
      .then((r) => setCategories(r.items.filter((c) => c.productCount > 0)))
      .catch(() => {});
    storeApi
      .list()
      .then((r) => setStores(r.items))
      .catch(() => {});
  };
  useEffect(loadMeta, []);
  useRealtimeEvent("catalog:changed", loadMeta);

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
  const sortLabel = SORTS.find(([k]) => k === filters.sort)?.[1];

  const header = useMemo(
    () => (
      <View>
        {stores.length ? (
          <View style={styles.storesBlock}>
            <Text style={styles.blockTitle}>Mağazalar</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stories}>
              {stores.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={styles.story}
                  onPress={() => navigation.navigate("Store", { storeId: s.id, name: s.name })}
                  accessibilityRole="button"
                  accessibilityLabel={`${s.name} mağazası, ${s.productCount} ürün`}
                >
                  <LinearGradient
                    colors={[colors.primary, "#F08AA0", "#F6B26B"]}
                    start={{ x: 0, y: 1 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.ring}
                  >
                    <View style={styles.ringInner}>
                      {s.logoUrl ? (
                        <Image source={{ uri: s.logoUrl }} style={styles.logo} />
                      ) : (
                        <View style={[styles.logo, styles.logoEmpty]}>
                          <Text style={styles.logoText}>{initials(s.name)}</Text>
                        </View>
                      )}
                    </View>
                  </LinearGradient>
                  <Text style={styles.storeName} numberOfLines={1}>
                    {s.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cats}>
          <QuickChip
            label="İndirimli"
            icon="pricetag-outline"
            on={filters.onSale}
            onPress={() => setFilters((f) => ({ ...f, onSale: !f.onSale }))}
          />
          <QuickChip
            label="Çok satanlar"
            icon="flame-outline"
            on={filters.sort === "best_selling"}
            onPress={() => setFilters((f) => ({ ...f, sort: f.sort === "best_selling" ? "newest" : "best_selling" }))}
          />
          <View style={styles.sep} />
          <Cat label="Tümü" on={!filters.category} onPress={() => setFilters((f) => ({ ...f, category: null }))} />
          {categories.map((c) => (
            <Cat
              key={c.id}
              label={c.name}
              on={filters.category === c.slug}
              onPress={() => setFilters((f) => ({ ...f, category: c.slug }))}
            />
          ))}
        </ScrollView>

        <View style={styles.resultRow}>
          <Text style={styles.resultText}>{list.total !== null ? `${list.total} ürün` : " "}</Text>
          <TouchableOpacity onPress={() => setSheet(true)} style={styles.sortBtn} accessibilityRole="button">
            <Ionicons name="swap-vertical" size={15} color={colors.text} />
            <Text style={styles.sortText}>{sortLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    ),
    [stores, categories, filters, list.total, sortLabel, navigation],
  );

  return (
    <View style={styles.container}>
      <AppHeader title="Mağaza" />

      <View style={styles.toolbar}>
        <View style={styles.search}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Ürün veya marka ara"
            placeholderTextColor={colors.faint}
            returnKeyType="search"
            accessibilityLabel="Ürün ara"
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch("")} accessibilityLabel="Aramayı temizle" hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.faint} />
            </TouchableOpacity>
          ) : null}
        </View>
        <IconBtn icon="options-outline" label="Filtrele" count={filterCount} onPress={() => setSheet(true)} />
        <IconBtn
          icon="bag-handle-outline"
          label={`Sepet, ${state.cartCount} ürün`}
          count={state.cartCount}
          onPress={() => navigation.navigate("ShoppingCart")}
        />
      </View>

      {list.loading && list.items.length === 0 ? (
        <GridSkeleton header />
      ) : list.error && list.items.length === 0 ? (
        <LoadError message={list.error} onRetry={list.reload} skeleton={<GridSkeleton header />} />
      ) : (
        <FlatList
          data={list.items}
          keyExtractor={(p) => p.id}
          numColumns={2}
          ListHeaderComponent={header}
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
                loadMeta();
              }}
              tintColor={colors.primary}
            />
          }
          ListFooterComponent={
            list.loadingMore ? <ActivityIndicator color={colors.primary} style={{ margin: 16 }} /> : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="search-outline" size={30} color={colors.faint} />
              <Text style={styles.emptyTitle}>Ürün bulunamadı</Text>
              <Text style={styles.emptyText}>
                {query ? `"${query}" için sonuç yok.` : "Seçtiğiniz filtrelere uyan ürün yok."}
              </Text>
              {filterCount || filters.category || filters.onSale ? (
                <TouchableOpacity style={styles.resetBtn} onPress={() => setFilters(DEFAULT_FILTERS)}>
                  <Text style={styles.resetText}>Filtreleri temizle</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          }
        />
      )}

      <ProductFilterSheet
        visible={sheet}
        value={filters}
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

function IconBtn({ icon, label, count, onPress }) {
  return (
    <TouchableOpacity style={styles.iconBtn} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <Ionicons name={icon} size={21} color={colors.text} />
      {count > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 99 ? "99+" : count}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

function QuickChip({ label, icon, on, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.quick, on && styles.quickOn]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
    >
      <Ionicons name={on ? "checkmark" : icon} size={14} color={on ? colors.primary : colors.text} />
      <Text style={[styles.quickText, on && { color: colors.primary }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Cat({ label, on, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.cat}
      accessibilityRole="tab"
      accessibilityState={{ selected: on }}
    >
      <Text style={[styles.catText, on && styles.catTextOn]}>{label}</Text>
      {on ? <View style={styles.catLine} /> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  toolbar: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
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
    paddingHorizontal: 4,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.background,
  },
  badgeText: { color: "#fff", fontSize: 9.5, fontWeight: "800" },
  storesBlock: { paddingTop: 4 },
  blockTitle: { fontSize: 15, fontWeight: "800", color: colors.text, marginHorizontal: 16, marginBottom: 8 },
  stories: { paddingHorizontal: 12, gap: 6 },
  story: { width: 76, alignItems: "center" },
  ring: { width: 68, height: 68, borderRadius: 34, padding: 2.5 },
  ringInner: { flex: 1, borderRadius: 32, backgroundColor: colors.background, padding: 2.5 },
  logo: { flex: 1, borderRadius: 30, backgroundColor: colors.surface },
  logoEmpty: { alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft },
  logoText: { color: colors.primary, fontWeight: "900", fontSize: 18 },
  storeName: { fontSize: 11.5, color: colors.text, marginTop: 5, fontWeight: "600", maxWidth: 74 },
  cats: { paddingHorizontal: 16, paddingTop: 14, alignItems: "center", gap: 6 },
  quick: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 32,
    paddingHorizontal: 11,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickOn: { backgroundColor: colors.primarySoft, borderColor: colors.primarySoft },
  quickText: { fontSize: 13, fontWeight: "600", color: colors.text },
  sep: { width: 1, height: 20, backgroundColor: colors.border, marginHorizontal: 6 },
  cat: { paddingHorizontal: 8, paddingVertical: 6, alignItems: "center" },
  catText: { fontSize: 14, fontWeight: "600", color: colors.muted },
  catTextOn: { color: colors.text, fontWeight: "800" },
  catLine: { height: 3, width: 18, borderRadius: 2, backgroundColor: colors.primary, marginTop: 3 },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 2,
  },
  resultText: { fontSize: 13, color: colors.muted },
  sortBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4 },
  sortText: { fontSize: 13, fontWeight: "700", color: colors.text },
  empty: { alignItems: "center", padding: 32 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: colors.text, marginTop: 10 },
  emptyText: { fontSize: 14, color: colors.muted, textAlign: "center", marginTop: 4 },
  resetBtn: {
    marginTop: 14,
    backgroundColor: colors.primarySoft,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  resetText: { color: colors.primary, fontWeight: "800" },
});
