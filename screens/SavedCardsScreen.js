import React, { useCallback, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import AppHeader from "../components/AppHeader";
import { BottomNavSpacer } from "../components/BottomNav";
import { Button } from "../components/ui";
import { useRemote } from "../components/useRemote";
import { colors } from "../components/theme";
import { CardListSkeleton, LoadError } from "../components/Skeleton";
import { cardApi } from "../services/api";
import { openCheckout, paymentReturnUrl } from "../services/checkout";
import { confirm, toast } from "../components/Feedback";

export const CARD_BRANDS = { VISA: "VISA", MASTER_CARD: "Mastercard", TROY: "TROY", AMERICAN_EXPRESS: "AMEX" };
const GRADIENTS = [
  ["#3A1D2A", "#1C1C1E"],
  ["#5B1530", "#2A0F1A"],
  ["#2B2B33", "#121216"],
];

/**
 * Kayıtlı kartlar. Kart bilgileri ödeme kuruluşunda saklanır; uygulamada yalnızca son 4 hane görünür.
 * Kart eklemek için 1 TL'lik doğrulama ödemesi yapılır ve hemen iade edilir.
 */
export default function SavedCardsScreen({ navigation }) {
  const loader = useCallback(() => cardApi.list().then((r) => r.items), []);
  const { data, setData, error, loading, refreshing, reload, refresh } = useRemote(loader);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [alias, setAlias] = useState("");

  const addCard = async () => {
    setAdding(true);
    try {
      const { payment, checkoutUrl } = await cardApi.verify(paymentReturnUrl());
      const status = await openCheckout(checkoutUrl, payment.id);
      if (status === "SUCCEEDED") {
        toast.success("Kartınız kaydedildi", "Doğrulama için çekilen 1 TL kartınıza iade edildi.");
        reload();
      } else if (status === "FAILED") {
        toast.error("Kart doğrulanamadı", "Kartınızdan çekim yapılmadı. Lütfen tekrar deneyin.");
      }
    } catch (e) {
      toast.error("Kart eklenemedi", e.message);
    } finally {
      setAdding(false);
    }
  };

  const makeDefault = async (card) => {
    try {
      await cardApi.update(card.id, { isDefault: true });
      setData((list) => list.map((c) => ({ ...c, isDefault: c.id === card.id })));
    } catch (e) {
      toast.error("Kaydedilemedi", e.message);
    }
  };

  const saveAlias = async () => {
    if (!alias.trim()) return;
    try {
      const { card } = await cardApi.update(editing.id, { alias: alias.trim() });
      setData((list) => list.map((c) => (c.id === card.id ? card : c)));
      setEditing(null);
    } catch (e) {
      toast.error("Kaydedilemedi", e.message);
    }
  };

  const remove = (card) =>
    confirm({
      title: "Kart silinsin mi?",
      message: `${card.alias} kayıtlı kartlarınızdan kaldırılacak.`,
      confirmText: "Sil",
      destructive: true,
    }).then(
      (ok) =>
        ok &&
        (async () => {
          try {
            await cardApi.remove(card.id);
            reload();
          } catch (e) {
            toast.error("Silinemedi", e.message);
          }
        })(),
    );

  return (
    <View style={styles.container}>
      <AppHeader title="Kayıtlı kartlarım" back />
      {loading && !data ? (
        <CardListSkeleton cards={2} />
      ) : error && !data ? (
        <LoadError message={error} onRetry={reload} skeleton={<CardListSkeleton cards={2} />} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
        >
          {data.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="card-outline" size={28} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>Kayıtlı kartınız yok</Text>
              <Text style={styles.emptyText}>
                Kartınızı kaydederek sonraki ödemelerinizi kart bilgisi girmeden, 3D Secure onayıyla hızlıca
                yapabilirsiniz.
              </Text>
            </View>
          ) : (
            data.map((card, i) => (
              <View key={card.id} style={{ marginBottom: 18 }}>
                <LinearGradient
                  colors={GRADIENTS[i % GRADIENTS.length]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.card}
                >
                  <View style={styles.glow} />
                  <View style={styles.cardTop}>
                    <Text style={styles.bank}>{card.bankName ?? "Banka kartı"}</Text>
                    {card.isDefault ? (
                      <View style={styles.defaultPill}>
                        <Text style={styles.defaultText}>Varsayılan</Text>
                      </View>
                    ) : null}
                  </View>
                  <Ionicons
                    name="hardware-chip-outline"
                    size={30}
                    color="rgba(255,255,255,0.75)"
                    style={{ marginTop: 18 }}
                  />
                  <Text style={styles.number} accessibilityLabel={`Son dört hane ${card.last4}`}>
                    •••• •••• •••• {card.last4}
                  </Text>
                  <View style={styles.cardBottom}>
                    <Text style={styles.alias} numberOfLines={1}>
                      {card.alias}
                    </Text>
                    <Text style={styles.brand}>{CARD_BRANDS[card.association] ?? card.association ?? ""}</Text>
                  </View>
                </LinearGradient>
                <View style={styles.actions}>
                  {!card.isDefault ? (
                    <Action icon="star-outline" label="Varsayılan yap" onPress={() => makeDefault(card)} />
                  ) : null}
                  <Action
                    icon="create-outline"
                    label="Adını değiştir"
                    onPress={() => {
                      setAlias(card.alias);
                      setEditing(card);
                    }}
                  />
                  <Action icon="trash-outline" label="Sil" danger onPress={() => remove(card)} />
                </View>
                {editing?.id === card.id ? (
                  <View style={styles.editRow}>
                    <TextInput
                      value={alias}
                      onChangeText={setAlias}
                      style={styles.input}
                      maxLength={40}
                      autoFocus
                      placeholder="Örn. Maaş kartım"
                      placeholderTextColor={colors.faint}
                      accessibilityLabel="Kart adı"
                    />
                    <TouchableOpacity style={styles.saveBtn} onPress={saveAlias}>
                      <Text style={styles.saveText}>Kaydet</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            ))
          )}

          {data.length < 5 ? (
            <Button title="+ Yeni kart ekle" onPress={addCard} loading={adding} style={{ marginTop: 4 }} />
          ) : (
            <Text style={styles.limit}>En fazla 5 kart kaydedebilirsiniz.</Text>
          )}

          <View style={styles.secure}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.success} />
            <Text style={styles.secureText}>
              Kart bilgileriniz Bakımca'ya iletilmez ve saklanmaz. Kartınız lisanslı ödeme kuruluşunun güvenli
              sayfasında kaydedilir; uygulamada yalnızca son 4 hanesi görünür. Kart eklerken 1 TL doğrulama tutarı
              çekilir ve hemen iade edilir.
            </Text>
          </View>
        </ScrollView>
      )}
      <BottomNavSpacer />
    </View>
  );
}

function Action({ icon, label, onPress, danger }) {
  return (
    <TouchableOpacity style={styles.action} onPress={onPress} accessibilityRole="button">
      <Ionicons name={icon} size={16} color={danger ? colors.danger : colors.text} />
      <Text style={[styles.actionText, danger && { color: colors.danger }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  scroll: { padding: 16, paddingBottom: 32 },
  card: { borderRadius: 20, padding: 20, height: 196, overflow: "hidden" },
  glow: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.primary,
    opacity: 0.28,
    top: -80,
    right: -60,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  bank: { color: "#fff", fontWeight: "700", fontSize: 15 },
  defaultPill: {
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  defaultText: { color: "#fff", fontSize: 11.5, fontWeight: "700" },
  number: { color: "#fff", fontSize: 19, fontWeight: "600", letterSpacing: 1.5, marginTop: 14 },
  cardBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: "auto" },
  alias: { color: "rgba(255,255,255,0.8)", fontSize: 13.5, flex: 1, marginRight: 8 },
  brand: { color: "#fff", fontSize: 17, fontWeight: "900", fontStyle: "italic", letterSpacing: 0.5 },
  actions: { flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.background,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionText: { fontSize: 13, fontWeight: "600", color: colors.text },
  editRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  input: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 15,
    color: colors.text,
  },
  saveBtn: { backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 16, justifyContent: "center" },
  saveText: { color: "#fff", fontWeight: "800" },
  empty: { alignItems: "center", padding: 28, backgroundColor: colors.background, borderRadius: 18, marginBottom: 16 },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: colors.text, marginTop: 12 },
  emptyText: { fontSize: 14, color: colors.muted, textAlign: "center", marginTop: 6, lineHeight: 20 },
  limit: { textAlign: "center", color: colors.muted, marginTop: 8 },
  secure: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
    padding: 14,
    backgroundColor: colors.background,
    borderRadius: 14,
  },
  secureText: { flex: 1, fontSize: 12.5, color: colors.muted, lineHeight: 18 },
});
