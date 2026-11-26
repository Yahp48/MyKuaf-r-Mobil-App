import React, { useCallback, useState } from "react";
import {
  Alert,
  Dimensions,
  FlatList,
  Image,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { FontAwesome, MaterialIcons } from "@expo/vector-icons";
import { useApp } from "../context/AppContext";
import { favoriteApi, productApi } from "../services/api";
import AppHeader from "../components/AppHeader";
import ProductCard from "../components/ProductCard";
import { Button, ErrorState, Loading } from "../components/ui";
import { useRemote } from "../components/useRemote";
import { colors, formatDate, formatTL } from "../components/theme";

const { width } = Dimensions.get("window");

export default function ProductDetailScreen({ navigation, route }) {
  const { productId } = route.params;
  const { actions } = useApp();
  const loader = useCallback(async () => {
    const [{ product }, related, reviews] = await Promise.all([
      productApi.detail(productId),
      productApi.related(productId).catch(() => ({ items: [] })),
      productApi.reviews(productId).catch(() => ({ items: [], total: 0 })),
    ]);
    return { product, related: related.items, reviews };
  }, [productId]);
  const { data, setData, error, loading, reload } = useRemote(loader, { refetchOnFocus: false });
  const [quantity, setQuantity] = useState(1);
  const [imageIndex, setImageIndex] = useState(0);
  const [adding, setAdding] = useState(false);

  if (loading && !data)
    return (
      <Wrapper>
        <Loading />
      </Wrapper>
    );
  if (error && !data)
    return (
      <Wrapper>
        <ErrorState message={error} onRetry={reload} />
      </Wrapper>
    );

  const { product: p, related, reviews } = data;
  const images = p.images.length ? p.images : [null];

  const toggleFavorite = async () => {
    const next = !p.isFavorite;
    setData((d) => ({ ...d, product: { ...d.product, isFavorite: next } }));
    try {
      await (next ? favoriteApi.addProduct(p.id) : favoriteApi.removeProduct(p.id));
    } catch (e) {
      setData((d) => ({ ...d, product: { ...d.product, isFavorite: !next } }));
      Alert.alert("Hata", e.message);
    }
  };

  const addToCart = async (goToCart) => {
    setAdding(true);
    try {
      await actions.addToCart(p.id, quantity);
      if (goToCart) navigation.navigate("ShoppingCart");
      else
        Alert.alert("Sepete eklendi", `${quantity} adet ${p.name}`, [
          { text: "Alışverişe devam", style: "cancel" },
          { text: "Sepete git", onPress: () => navigation.navigate("ShoppingCart") },
        ]);
    } catch (e) {
      Alert.alert("Sepete eklenemedi", e.message);
    } finally {
      setAdding(false);
    }
  };

  return (
    <Wrapper>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => setImageIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          >
            {images.map((uri, i) =>
              uri ? (
                <Image
                  key={uri}
                  source={{ uri }}
                  style={styles.image}
                  accessibilityLabel={`${p.name} görsel ${i + 1}`}
                />
              ) : (
                <View key="placeholder" style={[styles.image, styles.placeholder]}>
                  <MaterialIcons name="image" size={60} color="#ccc" />
                </View>
              ),
            )}
          </ScrollView>
          {images.length > 1 && (
            <View style={styles.dots}>
              {images.map((_, i) => (
                <View key={i} style={[styles.dot, i === imageIndex && styles.dotOn]} />
              ))}
            </View>
          )}
          <View style={styles.imageActions}>
            <TouchableOpacity
              style={styles.circle}
              onPress={toggleFavorite}
              accessibilityLabel={p.isFavorite ? "Favorilerden çıkar" : "Favorilere ekle"}
            >
              <MaterialIcons name={p.isFavorite ? "favorite" : "favorite-border"} size={22} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.circle}
              onPress={() => Share.share({ message: `${p.name} - ${formatTL(p.price)}` })}
              accessibilityLabel="Paylaş"
            >
              <MaterialIcons name="share" size={22} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.body}>
          {p.brand ? <Text style={styles.brand}>{p.brand}</Text> : null}
          <Text style={styles.name}>{p.name}</Text>
          <View style={styles.row}>
            <FontAwesome name="star" size={15} color="#f5a623" />
            <Text style={styles.muted}>
              {p.ratingCount ? ` ${p.rating} · ${p.ratingCount} değerlendirme` : " Henüz değerlendirme yok"}
            </Text>
          </View>

          <View style={[styles.row, { marginTop: 12 }]}>
            <Text style={styles.price}>{formatTL(p.price)}</Text>
            {p.compareAtPrice ? <Text style={styles.compare}>{formatTL(p.compareAtPrice)}</Text> : null}
            {p.discountPercent > 0 ? <Text style={styles.discount}>%{p.discountPercent} indirim</Text> : null}
          </View>
          <Text
            style={[
              styles.stock,
              { color: p.inStock ? (p.stock <= 5 ? colors.warning : colors.success) : colors.danger },
            ]}
          >
            {p.inStock ? (p.stock <= 5 ? `Son ${p.stock} ürün` : "Stokta") : "Tükendi"}
          </Text>

          {p.description ? <Text style={styles.description}>{p.description}</Text> : null}
          {p.features.length > 0 && (
            <View style={{ marginTop: 12 }}>
              {p.features.map((f) => (
                <View key={f} style={styles.row}>
                  <MaterialIcons name="check-circle" size={16} color={colors.success} />
                  <Text style={styles.feature}>{f}</Text>
                </View>
              ))}
            </View>
          )}

          {p.inStock && (
            <>
              <View style={[styles.row, { marginTop: 20 }]}>
                <Text style={styles.label}>Adet</Text>
                <TouchableOpacity
                  style={styles.qtyBtn}
                  onPress={() => setQuantity((q) => Math.max(1, q - 1))}
                  accessibilityLabel="Adedi azalt"
                >
                  <MaterialIcons name="remove" size={20} color={colors.primary} />
                </TouchableOpacity>
                <Text style={styles.qty}>{quantity}</Text>
                <TouchableOpacity
                  style={styles.qtyBtn}
                  onPress={() => setQuantity((q) => Math.min(p.stock, 20, q + 1))}
                  accessibilityLabel="Adedi artır"
                >
                  <MaterialIcons name="add" size={20} color={colors.primary} />
                </TouchableOpacity>
              </View>
              <View style={[styles.row, { marginTop: 16, gap: 10 }]}>
                <Button
                  title="Sepete Ekle"
                  variant="outline"
                  onPress={() => addToCart(false)}
                  loading={adding}
                  style={{ flex: 1 }}
                />
                <Button title="Hemen Al" onPress={() => addToCart(true)} disabled={adding} style={{ flex: 1 }} />
              </View>
            </>
          )}

          <Text style={styles.section}>Değerlendirmeler ({reviews.total})</Text>
          {reviews.items.length === 0 ? (
            <Text style={styles.muted}>Bu ürünü satın alıp teslim alan müşteriler değerlendirme yapabilir.</Text>
          ) : (
            reviews.items.slice(0, 5).map((r) => (
              <View key={r.id} style={styles.review}>
                <View style={styles.row}>
                  <Text style={styles.reviewAuthor}>{r.authorName}</Text>
                  <Text style={styles.stars}>
                    {"★".repeat(r.rating)}
                    {"☆".repeat(5 - r.rating)}
                  </Text>
                </View>
                {r.comment ? <Text style={styles.reviewText}>{r.comment}</Text> : null}
                <Text style={styles.reviewDate}>{formatDate(r.createdAt)}</Text>
              </View>
            ))
          )}

          {related.length > 0 && (
            <>
              <Text style={styles.section}>Benzer ürünler</Text>
              <FlatList
                horizontal
                data={related}
                keyExtractor={(r) => r.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 12 }}
                renderItem={({ item }) => (
                  <ProductCard
                    product={item}
                    style={{ width: 160 }}
                    onPress={() => navigation.push("ProductDetail", { productId: item.id })}
                  />
                )}
              />
            </>
          )}
        </View>
      </ScrollView>
    </Wrapper>
  );
}

const Wrapper = ({ children }) => (
  <View style={styles.container}>
    <AppHeader title="Ürün Detayı" back />
    {children}
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  image: { width, height: width, backgroundColor: colors.surface },
  placeholder: { alignItems: "center", justifyContent: "center" },
  dots: { position: "absolute", bottom: 12, alignSelf: "center", flexDirection: "row" },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "rgba(0,0,0,0.25)", marginHorizontal: 3 },
  dotOn: { backgroundColor: colors.primary },
  imageActions: { position: "absolute", top: 12, right: 12 },
  circle: {
    backgroundColor: "#fff",
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    elevation: 3,
  },
  body: { padding: 16 },
  brand: { fontSize: 12, color: colors.muted, textTransform: "uppercase" },
  name: { fontSize: 21, fontWeight: "bold", color: colors.text, marginTop: 4 },
  row: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
  muted: { color: colors.muted, fontSize: 13, marginTop: 4 },
  price: { fontSize: 24, fontWeight: "bold", color: colors.primary },
  compare: { fontSize: 15, color: colors.muted, textDecorationLine: "line-through", marginLeft: 10 },
  discount: { marginLeft: 10, color: colors.primaryDark, fontWeight: "bold" },
  stock: { marginTop: 6, fontWeight: "600" },
  description: { marginTop: 14, fontSize: 15, color: colors.text, lineHeight: 22 },
  feature: { marginLeft: 6, fontSize: 14, color: colors.text, marginVertical: 2 },
  label: { fontSize: 15, fontWeight: "600", marginRight: 16 },
  qtyBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  qty: { fontSize: 17, fontWeight: "bold", marginHorizontal: 16 },
  section: { fontSize: 17, fontWeight: "bold", color: colors.accent, marginTop: 26, marginBottom: 10 },
  review: { borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 10 },
  reviewAuthor: { fontWeight: "600", color: colors.text, marginRight: 8 },
  stars: { color: "#f5a623" },
  reviewText: { color: colors.text, marginTop: 4, lineHeight: 20 },
  reviewDate: { color: "#aaa", fontSize: 12, marginTop: 4 },
});
