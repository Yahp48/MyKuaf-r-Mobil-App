import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { AntDesign, MaterialIcons } from "@expo/vector-icons";
import { useApp } from "../context/AppContext";
import { productApi } from "../services/api";
import AppHeader from "../components/AppHeader";
import BottomNav from "../components/BottomNav";
import ProductCard from "../components/ProductCard";
import { EmptyState } from "../components/ui";
import { useRealtimeEvent } from "../services/realtime";
import { colors } from "../components/theme";
import { LoadError, GridSkeleton } from "../components/Skeleton";

const SORTS = [
  ["newest", "En yeni"],
  ["price_asc", "Fiyat ↑"],
  ["price_desc", "Fiyat ↓"],
  ["rating", "En beğenilen"],
];

export default function ShopScreen({ navigation }) {
  const { state, actions } = useApp();
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState(null);
  const [sort, setSort] = useState("newest");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [addingId, setAddingId] = useState(null);
  const requestId = useRef(0);

  // Aramayı yazarken her tuşta istek atmamak için kısa gecikme.
  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    productApi
      .categories()
      .then((r) => setCategories(r.items))
      .catch(() => {});
  }, []);

  const load = useCallback(
    async (nextPage, mode) => {
      const id = ++requestId.current;
      if (mode === "more") setLoadingMore(true);
      if (mode === "refresh") setRefreshing(true);
      if (mode === "initial") setLoading(true);
      setError(null);
      try {
        const res = await productApi.list({
          page: nextPage,
          pageSize: 20,
          category: category ?? undefined,
          sort,
          q: query || undefined,
        });
        if (id !== requestId.current) return; // eski istek
        setItems((prev) => (nextPage === 1 ? res.items : [...prev, ...res.items]));
        setPage(nextPage);
        setHasNext(res.hasNextPage);
      } catch (e) {
        if (id === requestId.current) setError(e.message);
      } finally {
        if (id === requestId.current) {
          setLoading(false);
          setLoadingMore(false);
          setRefreshing(false);
        }
      }
    },
    [category, sort, query],
  );

  // Satıcı ürün ekleyince, fiyat veya stok değiştirince liste sessizce tazelenir.
  useRealtimeEvent("catalog:changed", () => load(1, "silent"));

  useEffect(() => {
    load(1, "initial");
  }, [load]);

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

  const Chip = ({ label, active, onPress }) => (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipOn]}
      onPress={onPress}
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.chipText, active && { color: "#fff" }]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <AppHeader title="Mağaza" />

      <View style={styles.toolbar}>
        <View style={styles.search}>
          <MaterialIcons name="search" size={20} color="#999" />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Ürün veya marka ara"
            placeholderTextColor="#999"
            returnKeyType="search"
            accessibilityLabel="Ürün ara"
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch("")} accessibilityLabel="Aramayı temizle">
              <AntDesign name="close" size={16} color="#999" />
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity
          style={styles.cartBtn}
          onPress={() => navigation.navigate("ShoppingCart")}
          accessibilityLabel={`Sepet, ${state.cartCount} ürün`}
        >
          <MaterialIcons name="shopping-cart" size={24} color={colors.primary} />
          {state.cartCount > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{state.cartCount > 99 ? "99+" : state.cartCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip label="Tümü" active={!category} onPress={() => setCategory(null)} />
          {categories.map((c) => (
            <Chip key={c.id} label={c.name} active={category === c.slug} onPress={() => setCategory(c.slug)} />
          ))}
        </ScrollView>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.chips, { paddingTop: 0 }]}
        >
          {SORTS.map(([key, label]) => (
            <Chip key={key} label={label} active={sort === key} onPress={() => setSort(key)} />
          ))}
        </ScrollView>
      </View>

      {loading && items.length === 0 ? (
        <GridSkeleton header />
      ) : error && items.length === 0 ? (
        <LoadError message={error} onRetry={() => load(1, "initial")} skeleton={<GridSkeleton header />} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(p) => p.id}
          numColumns={2}
          columnWrapperStyle={{ gap: 12 }}
          contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
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
          onEndReached={() => hasNext && !loadingMore && load(page + 1, "more")}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(1, "refresh")} tintColor={colors.primary} />
          }
          ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primary} style={{ margin: 16 }} /> : null}
          ListEmptyComponent={
            <EmptyState
              icon="search-off"
              title="Ürün bulunamadı"
              message={query ? `"${query}" için sonuç yok.` : undefined}
            />
          }
        />
      )}
      <BottomNav active="Shop" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  toolbar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 12 },
  search: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 22,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: { flex: 1, marginLeft: 6, fontSize: 15, color: colors.text },
  cartBtn: { marginLeft: 12, padding: 6 },
  cartBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: colors.primaryDark,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  cartBadgeText: { color: "#fff", fontSize: 10, fontWeight: "bold" },
  chips: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  chip: { borderWidth: 1, borderColor: colors.primary, borderRadius: 18, paddingVertical: 6, paddingHorizontal: 14 },
  chipOn: { backgroundColor: colors.primary },
  chipText: { color: colors.primary, fontWeight: "600", fontSize: 13 },
});
