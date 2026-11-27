import React from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FontAwesome, Ionicons, MaterialIcons } from "@expo/vector-icons";

const BADGE_ICON = { bestseller: "flame", favorite: "heart", new: "sparkles" };
import { colors, formatTL } from "./theme";

export default function ProductCard({ product: p, onPress, onAdd, adding, style }) {
  return (
    <TouchableOpacity
      style={[styles.card, style]}
      onPress={onPress}
      accessibilityLabel={`${p.name}, ${formatTL(p.price)}`}
    >
      <View>
        {p.image ? (
          <Image source={{ uri: p.image }} style={styles.image} />
        ) : (
          <View style={[styles.image, styles.placeholder]}>
            <MaterialIcons name="image" size={36} color="#ccc" />
          </View>
        )}
        {p.discountPercent > 0 && (
          <View style={styles.discount}>
            <Text style={styles.discountText}>%{p.discountPercent}</Text>
          </View>
        )}
        {p.badges?.length ? (
          <View style={styles.badge} accessibilityLabel={p.badges[0].label}>
            <Ionicons name={BADGE_ICON[p.badges[0].key] ?? "star"} size={11} color="#fff" />
            <Text style={styles.badgeText}>{p.badges[0].label}</Text>
          </View>
        ) : null}
        {!p.inStock && (
          <View style={styles.soldOut}>
            <Text style={styles.soldOutText}>Tükendi</Text>
          </View>
        )}
      </View>
      <View style={styles.body}>
        {p.brand ? <Text style={styles.brand}>{p.brand}</Text> : null}
        <Text style={styles.name} numberOfLines={2}>
          {p.name}
        </Text>
        {p.ratingCount > 0 && (
          <View style={styles.rating}>
            <FontAwesome name="star" size={12} color="#f5a623" />
            <Text style={styles.ratingText}>
              {p.rating} ({p.ratingCount})
            </Text>
          </View>
        )}
        <View style={styles.bottom}>
          <View>
            <Text style={styles.price}>{formatTL(p.price)}</Text>
            {p.compareAtPrice ? <Text style={styles.compare}>{formatTL(p.compareAtPrice)}</Text> : null}
          </View>
          {onAdd && (
            <TouchableOpacity
              style={[styles.add, (!p.inStock || adding) && { opacity: 0.4 }]}
              onPress={onAdd}
              disabled={!p.inStock || adding}
              accessibilityLabel="Sepete ekle"
            >
              <MaterialIcons name="add-shopping-cart" size={18} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
        {p.inStock && p.stock <= 5 ? <Text style={styles.low}>Son {p.stock} ürün</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#fff", borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: colors.border },
  image: { width: "100%", aspectRatio: 1, backgroundColor: colors.surface },
  placeholder: { alignItems: "center", justifyContent: "center" },
  discount: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: colors.primaryDark,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  discountText: { color: "#fff", fontSize: 11, fontWeight: "bold" },
  badge: {
    position: "absolute",
    top: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(28,28,30,0.82)",
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  badgeText: { color: "#fff", fontSize: 10.5, fontWeight: "800" },
  soldOut: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  soldOutText: {
    backgroundColor: "#333",
    color: "#fff",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    fontWeight: "bold",
  },
  body: { padding: 10 },
  brand: { fontSize: 11, color: colors.muted, textTransform: "uppercase" },
  name: { fontSize: 14, fontWeight: "600", color: colors.text, marginTop: 2, minHeight: 36 },
  rating: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  ratingText: { fontSize: 12, color: colors.muted, marginLeft: 4 },
  bottom: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 6 },
  price: { fontSize: 15, fontWeight: "bold", color: colors.primary },
  compare: { fontSize: 12, color: colors.muted, textDecorationLine: "line-through" },
  add: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  low: { fontSize: 11, color: colors.warning, marginTop: 4, fontWeight: "600" },
});
