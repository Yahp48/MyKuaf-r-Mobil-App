import React, { useCallback, useState } from "react";
import { Alert, FlatList, Image, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import { useApp } from "../context/AppContext";
import AppHeader from "../components/AppHeader";
import BottomNav from "../components/BottomNav";
import { Button, EmptyState } from "../components/ui";
import { colors, formatTL } from "../components/theme";

export default function ShoppingCartScreen({ navigation }) {
  const { cart, actions } = useApp();
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null);

  // Fiyat/stok değişmiş olabilir: ekran her açıldığında sunucudan tazelenir.
  useFocusEffect(
    useCallback(() => {
      actions.refreshCart().catch(() => {});
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const refresh = async () => {
    setRefreshing(true);
    await actions.refreshCart().catch((e) => Alert.alert("Hata", e.message));
    setRefreshing(false);
  };

  const run = async (productId, fn) => {
    setBusyId(productId);
    try {
      await fn();
    } catch (e) {
      Alert.alert("Sepet güncellenemedi", e.message);
    } finally {
      setBusyId(null);
    }
  };

  const remove = (item) =>
    Alert.alert("Ürünü çıkar", `${item.product.name} sepetten çıkarılsın mı?`, [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Çıkar",
        style: "destructive",
        onPress: () => run(item.product.id, () => actions.removeFromCart(item.product.id)),
      },
    ]);

  const summary = cart.summary;
  const hasItems = cart.items.length > 0;
  const blocked = cart.warnings.length > 0;

  const renderItem = ({ item }) => {
    const p = item.product;
    const busy = busyId === p.id;
    return (
      <View style={[styles.item, !item.purchasable && { opacity: 0.6 }]}>
        <TouchableOpacity onPress={() => navigation.navigate("ProductDetail", { productId: p.id })}>
          {p.image ? <Image source={{ uri: p.image }} style={styles.image} /> : <View style={styles.image} />}
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.name} numberOfLines={2}>
            {p.name}
          </Text>
          <Text style={styles.price}>{formatTL(p.price)}</Text>
          <View style={styles.qtyRow}>
            <QtyButton
              icon="remove"
              disabled={busy || item.quantity <= 1}
              onPress={() => run(p.id, () => actions.updateCartQuantity(p.id, item.quantity - 1))}
            />
            <Text style={styles.qty}>{item.quantity}</Text>
            <QtyButton
              icon="add"
              disabled={busy || item.quantity >= p.stock}
              onPress={() => run(p.id, () => actions.updateCartQuantity(p.id, item.quantity + 1))}
            />
            <TouchableOpacity
              onPress={() => remove(item)}
              style={{ marginLeft: "auto" }}
              accessibilityLabel="Sepetten çıkar"
            >
              <MaterialIcons name="delete-outline" size={24} color={colors.danger} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Sepetim" back />
      <FlatList
        data={cart.items}
        keyExtractor={(i) => i.product.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
        ListHeaderComponent={
          blocked ? (
            <View style={styles.warning}>
              {cart.warnings.map((w) => (
                <Text key={w.productId} style={styles.warningText}>
                  • {w.message}
                </Text>
              ))}
            </View>
          ) : null
        }
        ListEmptyComponent={
          <EmptyState
            icon="shopping-cart"
            title="Sepetiniz boş"
            actionTitle="Alışverişe başla"
            onAction={() => navigation.navigate("Shop")}
          />
        }
      />

      {hasItems && summary ? (
        <View style={styles.footer}>
          <Row label={`Ara toplam (${summary.itemCount} ürün)`} value={formatTL(summary.subtotal)} />
          <Row label="Kargo" value={summary.shipping === 0 ? "Ücretsiz" : formatTL(summary.shipping)} />
          {summary.sellers?.length > 1
            ? summary.sellers.map((s) => (
                <Row
                  key={s.id}
                  label={`  ${s.name} kargosu`}
                  value={s.shipping === 0 ? "Ücretsiz" : formatTL(s.shipping)}
                />
              ))
            : null}
          {summary.remainingForFreeShipping > 0 ? (
            <Text style={styles.freeShip}>
              {formatTL(summary.remainingForFreeShipping)} daha ekleyin, kargo ücretsiz olsun.
            </Text>
          ) : null}
          <Row label="Toplam" value={formatTL(summary.total)} bold />
          <Button
            title={blocked ? "Önce sepeti düzenleyin" : "Alışverişi Tamamla"}
            disabled={blocked || summary.itemCount === 0}
            onPress={() => navigation.navigate("Checkout")}
            style={{ marginTop: 10 }}
          />
        </View>
      ) : null}
      <BottomNav active="Shop" />
    </View>
  );
}

const QtyButton = ({ icon, onPress, disabled }) => (
  <TouchableOpacity
    style={[styles.qtyBtn, disabled && { opacity: 0.35 }]}
    onPress={onPress}
    disabled={disabled}
    accessibilityLabel={icon === "add" ? "Adedi artır" : "Adedi azalt"}
  >
    <MaterialIcons name={icon} size={18} color={colors.primary} />
  </TouchableOpacity>
);

const Row = ({ label, value, bold }) => (
  <View style={styles.row}>
    <Text style={[styles.rowLabel, bold && styles.bold]}>{label}</Text>
    <Text style={[styles.rowValue, bold && styles.bold]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  item: {
    flexDirection: "row",
    marginBottom: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  image: { width: 84, height: 84, borderRadius: 10, backgroundColor: colors.surface },
  name: { fontSize: 15, fontWeight: "600", color: colors.text },
  price: { fontSize: 15, fontWeight: "bold", color: colors.primary, marginTop: 4 },
  qtyRow: { flexDirection: "row", alignItems: "center", marginTop: 8 },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  qty: { marginHorizontal: 14, fontSize: 16, fontWeight: "bold", minWidth: 20, textAlign: "center" },
  warning: { backgroundColor: "#fff4e5", borderRadius: 10, padding: 12, marginBottom: 14 },
  warningText: { color: "#8a4b00", fontSize: 13, marginVertical: 2 },
  footer: { borderTopWidth: 1, borderTopColor: colors.border, padding: 16, backgroundColor: "#fff" },
  row: { flexDirection: "row", justifyContent: "space-between", marginVertical: 2 },
  rowLabel: { color: colors.muted, fontSize: 14 },
  rowValue: { color: colors.text, fontSize: 14 },
  bold: { fontWeight: "bold", fontSize: 17, color: colors.text },
  freeShip: { fontSize: 12, color: colors.accent, marginVertical: 4 },
});
