import React, { useCallback, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useApp } from "../context/AppContext";
import { orderApi, userApi } from "../services/api";
import { openCheckout, paymentReturnUrl } from "../services/checkout";
import AppHeader from "../components/AppHeader";
import { Button, Checkbox } from "../components/ui";
import { useRemote } from "../components/useRemote";
import { colors, formatTL } from "../components/theme";
import { LoadError, FormSkeleton } from "../components/Skeleton";
import CardPicker from "../components/CardPicker";

export default function CheckoutScreen({ navigation }) {
  const { cart, user, actions } = useApp();
  const loader = useCallback(() => userApi.addresses().then((r) => r.items), []);
  const { data: addresses, error, loading, reload } = useRemote(loader);
  const [addressId, setAddressId] = useState(null);
  const [method, setMethod] = useState("CARD");
  const [card, setCard] = useState({});
  const [accepted, setAccepted] = useState(false);
  const [placing, setPlacing] = useState(false);

  const selectedId = addressId ?? addresses?.find((a) => a.isDefault)?.id ?? addresses?.[0]?.id;
  const summary = cart.summary;
  const walletEnough = (user?.walletBalance ?? 0) >= (summary?.total ?? 0);

  // Çok satıcılı sepet satıcı başına ayrı siparişe bölünür: tekse detaya, birden fazlaysa listeye git.
  const finish = (orders) => {
    actions.refreshCart().catch(() => {});
    actions.refreshUser().catch(() => {});
    actions.refreshUnread().catch(() => {});
    navigation.reset({
      index: 1,
      routes: [
        { name: "Shop" },
        orders.length === 1 ? { name: "OrderDetail", params: { orderId: orders[0].id } } : { name: "Order" },
      ],
    });
  };

  const placeOrder = async () => {
    if (!selectedId) return Alert.alert("Adres gerekli", "Lütfen bir teslimat adresi ekleyin.");
    if (!accepted)
      return Alert.alert("Onay gerekli", "Ön bilgilendirme formunu ve mesafeli satış sözleşmesini onaylayın.");
    setPlacing(true);
    try {
      const { orders, payment, checkoutUrl } = await orderApi.create(
        selectedId,
        method,
        paymentReturnUrl(),
        method === "CARD" ? card : {},
      );
      const label =
        orders.length > 1
          ? `${orders.length} satıcıdan siparişleriniz`
          : `${orders[0].orderNumber} numaralı siparişiniz`;
      if (method === "WALLET") {
        Alert.alert("Siparişiniz alındı 🎉", `${label} cüzdanınızdan ödendi.`);
        return finish(orders);
      }
      const status = await openCheckout(checkoutUrl, payment.id);
      if (status === "SUCCEEDED") {
        Alert.alert("Siparişiniz alındı 🎉", `${label} için ödeme alındı.`);
        finish(orders);
      } else if (status === "FAILED") {
        Alert.alert("Ödeme başarısız", "Kartınızdan çekim yapılmadı, sepetiniz korunuyor. Lütfen tekrar deneyin.");
        actions.refreshCart().catch(() => {});
      } else {
        Alert.alert(
          "Ödeme tamamlanmadı",
          "Ödeme sayfasını kapattınız. Sipariş 30 dakika içinde ödenmezse otomatik iptal edilir ve sepetiniz korunur.",
          [{ text: "Siparişi gör", onPress: () => finish(orders) }],
        );
      }
    } catch (e) {
      Alert.alert("Sipariş oluşturulamadı", e.message);
      if (e.code === "CART_CHANGED" || e.code === "INSUFFICIENT_STOCK") navigation.goBack();
    } finally {
      setPlacing(false);
    }
  };

  if (loading && !addresses)
    return (
      <Wrapper>
        <FormSkeleton />
      </Wrapper>
    );
  if (error && !addresses)
    return (
      <Wrapper>
        <LoadError message={error} onRetry={reload} skeleton={<FormSkeleton />} />
      </Wrapper>
    );

  return (
    <Wrapper>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.section}>Teslimat adresi</Text>
        {addresses.map((a) => (
          <TouchableOpacity
            key={a.id}
            style={[styles.option, selectedId === a.id && styles.optionOn]}
            onPress={() => setAddressId(a.id)}
            accessibilityRole="radio"
            accessibilityState={{ selected: selectedId === a.id }}
          >
            <MaterialIcons
              name={selectedId === a.id ? "radio-button-checked" : "radio-button-unchecked"}
              size={22}
              color={colors.primary}
            />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.optionTitle}>{a.title}</Text>
              <Text style={styles.optionText}>
                {a.fullName} · {a.phone}
              </Text>
              <Text style={styles.optionText}>
                {a.line}, {a.district}/{a.city}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
        <Button title="+ Yeni adres ekle" variant="outline" onPress={() => navigation.navigate("AddressForm")} />

        <Text style={styles.section}>Ödeme yöntemi</Text>
        <PayOption
          selected={method === "CARD"}
          onPress={() => setMethod("CARD")}
          icon="credit-card"
          title="Kredi / banka kartı"
          text="3D Secure ile güvenli ödeme sayfasında"
        />
        {method === "CARD" ? <CardPicker onChange={setCard} /> : null}
        <PayOption
          selected={method === "WALLET"}
          onPress={() => (walletEnough ? setMethod("WALLET") : null)}
          disabled={!walletEnough}
          icon="account-balance-wallet"
          title={`Cüzdan (${formatTL(user?.walletBalance ?? 0)})`}
          text={walletEnough ? "Bakiyenizden düşülür" : "Bakiyeniz bu sipariş için yetersiz"}
        />

        {summary ? (
          <View style={styles.summary}>
            <Row label="Ara toplam" value={formatTL(summary.subtotal)} />
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
            <Row label="Ödenecek tutar" value={formatTL(summary.total)} bold />
          </View>
        ) : null}

        <Checkbox checked={accepted} onChange={setAccepted}>
          <Text style={styles.consent}>
            <Text style={styles.link} onPress={() => navigation.navigate("Privacy")}>
              Ön bilgilendirme formunu ve mesafeli satış sözleşmesini
            </Text>{" "}
            okudum, onaylıyorum. 14 gün içinde cayma hakkım olduğunu biliyorum.
          </Text>
        </Checkbox>

        <Button
          title={summary ? `${formatTL(summary.total)} Öde` : "Öde"}
          onPress={placeOrder}
          loading={placing}
          disabled={!summary || summary.itemCount === 0}
          style={{ marginTop: 16 }}
        />
      </ScrollView>
    </Wrapper>
  );
}

const Wrapper = ({ children }) => (
  <View style={styles.container}>
    <AppHeader title="Ödeme" back />
    {children}
  </View>
);

function PayOption({ selected, onPress, icon, title, text, disabled }) {
  return (
    <TouchableOpacity
      style={[styles.option, selected && styles.optionOn, disabled && { opacity: 0.5 }]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
    >
      <MaterialIcons name={icon} size={24} color={colors.primary} />
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={styles.optionTitle}>{title}</Text>
        <Text style={styles.optionText}>{text}</Text>
      </View>
      <MaterialIcons
        name={selected ? "radio-button-checked" : "radio-button-unchecked"}
        size={22}
        color={colors.primary}
      />
    </TouchableOpacity>
  );
}

const Row = ({ label, value, bold }) => (
  <View style={styles.row}>
    <Text style={[styles.rowLabel, bold && styles.bold]}>{label}</Text>
    <Text style={[styles.rowValue, bold && styles.bold]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 16, paddingBottom: 40 },
  section: { fontSize: 16, fontWeight: "bold", color: colors.accent, marginTop: 16, marginBottom: 10 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  optionOn: { borderColor: colors.primary, backgroundColor: "#FDEEF2" },
  optionTitle: { fontSize: 15, fontWeight: "600", color: colors.text },
  optionText: { fontSize: 13, color: colors.muted, marginTop: 2 },
  summary: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginVertical: 16 },
  row: { flexDirection: "row", justifyContent: "space-between", marginVertical: 3 },
  rowLabel: { color: colors.muted },
  rowValue: { color: colors.text },
  bold: { fontWeight: "bold", fontSize: 17, color: colors.text },
  consent: { fontSize: 13, color: colors.text, lineHeight: 19 },
  link: { color: colors.primary, fontWeight: "600" },
});
