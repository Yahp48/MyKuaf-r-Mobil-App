import React, { useCallback, useState } from "react";
import { Alert, Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { orderApi } from "../services/api";
import { useApp } from "../context/AppContext";
import AppHeader from "../components/AppHeader";
import { Button, ErrorState, Loading, StatusPill } from "../components/ui";
import { useRemote } from "../components/useRemote";
import { useRealtimeEvent } from "../services/realtime";
import { ORDER_STATUS, colors, formatDate, formatTL } from "../components/theme";

export default function OrderDetailScreen({ route }) {
  const { orderId } = route.params;
  const { actions } = useApp();
  const loader = useCallback(() => orderApi.detail(orderId).then((r) => r.order), [orderId]);
  const { data: order, setData, error, loading, reload } = useRemote(loader);
  // Satıcı kargoya verince takip numarası anında görünür.
  useRealtimeEvent("order:updated", (o) => o?.id === orderId && setData(o));
  const [busy, setBusy] = useState(false);

  if (loading && !order)
    return (
      <Wrapper>
        <Loading />
      </Wrapper>
    );
  if (error && !order)
    return (
      <Wrapper>
        <ErrorState message={error} onRetry={reload} />
      </Wrapper>
    );

  const status = ORDER_STATUS[order.status] ?? { label: order.status, color: colors.muted };
  const addr = order.shippingAddress;

  const cancel = () =>
    Alert.alert(
      "Siparişi iptal et",
      order.status === "PAID"
        ? `Siparişiniz iptal edilecek ve ${formatTL(order.total)} ${order.paymentMethod === "WALLET" ? "cüzdanınıza" : "kartınıza"} iade edilecek.`
        : "Siparişiniz iptal edilecek.",
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "İptal et",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              const res = await orderApi.cancel(order.id);
              setData(res.order);
              actions.refreshUnread().catch(() => {});
            } catch (e) {
              Alert.alert("İptal edilemedi", e.message);
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );

  return (
    <Wrapper>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.row}>
          <Text style={styles.number}>{order.orderNumber}</Text>
          <StatusPill label={status.label} color={status.color} />
        </View>
        <Text style={styles.meta}>{formatDate(order.createdAt, true)}</Text>
        {order.seller ? <Text style={styles.meta}>Satıcı: {order.seller.name}</Text> : null}
        {order.trackingNumber ? (
          <Text style={styles.meta}>
            Kargo: {order.carrier} · takip no: {order.trackingNumber}
          </Text>
        ) : null}

        <Text style={styles.section}>Ürünler</Text>
        {order.items.map((i) => (
          <View key={i.productId} style={styles.item}>
            {i.image ? <Image source={{ uri: i.image }} style={styles.image} /> : <View style={styles.image} />}
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{i.name}</Text>
              <Text style={styles.meta}>
                {i.quantity} × {formatTL(i.unitPrice)}
              </Text>
            </View>
            <Text style={styles.itemTotal}>{formatTL(i.lineTotal)}</Text>
          </View>
        ))}

        <View style={styles.box}>
          <Line label="Ara toplam" value={formatTL(order.subtotal)} />
          <Line label="Kargo" value={order.shipping === 0 ? "Ücretsiz" : formatTL(order.shipping)} />
          <Line label="Toplam" value={formatTL(order.total)} bold />
          <Line label="Ödeme" value={order.paymentMethod === "WALLET" ? "Cüzdan" : "Kredi/banka kartı"} />
        </View>

        <Text style={styles.section}>Teslimat adresi</Text>
        <View style={styles.box}>
          <Text style={styles.itemName}>
            {addr.fullName} · {addr.phone}
          </Text>
          <Text style={styles.meta}>
            {addr.line}, {addr.district}/{addr.city} {addr.postalCode ?? ""}
          </Text>
        </View>

        {order.status === "PENDING_PAYMENT" && order.payment?.status === "PENDING" ? (
          <Text style={styles.notice}>
            Ödeme tamamlanmadı. 30 dakika içinde ödenmeyen siparişler otomatik iptal edilir.
          </Text>
        ) : null}
        {order.canCancel ? <Button title="Siparişi İptal Et" variant="danger" onPress={cancel} loading={busy} /> : null}
        {!order.canCancel && order.status !== "CANCELLED" && order.status !== "REFUNDED" ? (
          <Text style={styles.notice}>
            Hazırlanmaya başlanan siparişler için iade talebinizi Destek bölümünden iletebilirsiniz.
          </Text>
        ) : null}
      </ScrollView>
    </Wrapper>
  );
}

const Wrapper = ({ children }) => (
  <View style={styles.container}>
    <AppHeader title="Sipariş Detayı" back />
    {children}
  </View>
);

const Line = ({ label, value, bold }) => (
  <View style={styles.line}>
    <Text style={[styles.lineLabel, bold && styles.bold]}>{label}</Text>
    <Text style={[styles.lineValue, bold && styles.bold]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 16, paddingBottom: 40 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  number: { fontSize: 18, fontWeight: "bold", color: colors.text },
  meta: { fontSize: 13, color: colors.muted, marginTop: 4 },
  section: { fontSize: 16, fontWeight: "bold", color: colors.accent, marginTop: 20, marginBottom: 10 },
  item: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  image: { width: 54, height: 54, borderRadius: 8, backgroundColor: colors.surface, marginRight: 12 },
  itemName: { fontSize: 14, fontWeight: "600", color: colors.text },
  itemTotal: { fontSize: 14, fontWeight: "bold", color: colors.text },
  box: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginTop: 8 },
  line: { flexDirection: "row", justifyContent: "space-between", marginVertical: 3 },
  lineLabel: { color: colors.muted },
  lineValue: { color: colors.text },
  bold: { fontWeight: "bold", color: colors.text, fontSize: 16 },
  notice: { fontSize: 13, color: colors.muted, marginVertical: 14, lineHeight: 19 },
});
