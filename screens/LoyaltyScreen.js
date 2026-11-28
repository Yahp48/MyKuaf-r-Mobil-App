import React, { useCallback, useState } from "react";
import { Alert, RefreshControl, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import AppHeader from "../components/AppHeader";
import BottomNav from "../components/BottomNav";
import { useRemote } from "../components/useRemote";
import { colors, formatDate, formatTL } from "../components/theme";
import { ListSkeleton, LoadError } from "../components/Skeleton";
import { useApp } from "../context/AppContext";
import { loyaltyApi } from "../services/api";

const REASON = {
  APPOINTMENT: { icon: "calendar-outline", label: "Randevu" },
  ORDER: { icon: "bag-handle-outline", label: "Sipariş" },
  REFERRAL: { icon: "people-outline", label: "Davet" },
  REDEEM: { icon: "wallet-outline", label: "Cüzdana aktarım" },
  ADJUST: { icon: "create-outline", label: "Düzeltme" },
};

/** Sadakat puanları: kazanma kuralları, cüzdana aktarma, arkadaş daveti. */
export default function LoyaltyScreen() {
  const { actions } = useApp();
  const loader = useCallback(() => loyaltyApi.get(), []);
  const { data, setData, error, loading, refreshing, reload, refresh } = useRemote(loader);
  const [redeeming, setRedeeming] = useState(false);

  const redeemable = data ? Math.floor(data.points / data.rules.pointsPerTL) * data.rules.pointsPerTL : 0;

  const redeem = () => {
    const tl = redeemable / data.rules.pointsPerTL;
    Alert.alert("Puanları aktar", `${redeemable} puan cüzdanınıza ${formatTL(tl)} olarak aktarılacak.`, [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Aktar",
        onPress: async () => {
          setRedeeming(true);
          try {
            const r = await loyaltyApi.redeem(redeemable);
            setData((d) => ({ ...d, points: r.points }));
            actions.refreshUser().catch(() => {});
            Alert.alert("Aktarıldı", `${formatTL(r.credited)} cüzdanınıza eklendi.`);
            reload();
          } catch (e) {
            Alert.alert("Aktarılamadı", e.message);
          } finally {
            setRedeeming(false);
          }
        },
      },
    ]);
  };

  const invite = () =>
    Share.share({
      message: `MyKuaför'de kuaför, tırnak ve güzellik randevunu kolayca al! Kayıt olurken davet kodumu kullan: ${data.referralCode} — ilk randevundan sonra ikimiz de ${data.rules.referralPoints} puan kazanırız.`,
    }).catch(() => {});

  return (
    <View style={styles.container}>
      <AppHeader title="Puanlarım ve davet" back />
      {loading && !data ? (
        <ListSkeleton rows={6} />
      ) : error && !data ? (
        <LoadError message={error} onRetry={reload} skeleton={<ListSkeleton rows={6} />} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
        >
          <LinearGradient
            colors={[colors.primary, "#7A0F2E"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.card}
          >
            <Text style={styles.cardLabel}>Puanınız</Text>
            <Text style={styles.points}>{data.points.toLocaleString("tr-TR")}</Text>
            <Text style={styles.cardSub}>≈ {formatTL(data.value)} cüzdan bakiyesi</Text>
            <TouchableOpacity
              style={[styles.redeem, (redeemable < data.rules.minRedeem || redeeming) && { opacity: 0.5 }]}
              onPress={redeem}
              disabled={redeemable < data.rules.minRedeem || redeeming}
              accessibilityRole="button"
            >
              <Text style={styles.redeemText}>
                {redeemable >= data.rules.minRedeem
                  ? `${redeemable} puanı cüzdana aktar`
                  : `Aktarmak için en az ${data.rules.minRedeem} puan`}
              </Text>
            </TouchableOpacity>
          </LinearGradient>

          <View style={styles.rules}>
            <Rule
              icon="calendar-outline"
              text={`Tamamlanan her randevuda her ${data.rules.tlPerPoint} TL için 1 puan`}
            />
            <Rule
              icon="bag-handle-outline"
              text={`Teslim edilen siparişlerde her ${data.rules.tlPerPoint} TL için 1 puan`}
            />
            <Rule icon="wallet-outline" text={`${data.rules.pointsPerTL} puan = 1 TL cüzdan bakiyesi`} />
          </View>

          <View style={styles.invite}>
            <View style={styles.inviteIcon}>
              <Ionicons name="gift-outline" size={22} color={colors.primary} />
            </View>
            <Text style={styles.inviteTitle}>Arkadaşını davet et, ikiniz de kazanın</Text>
            <Text style={styles.inviteText}>
              Arkadaşın kayıt olurken kodunu girsin; ilk randevusu tamamlanınca veya ilk siparişi teslim edilince
              ikinize de {data.rules.referralPoints} puan.
            </Text>
            <View style={styles.codeRow}>
              <Text style={styles.code} selectable>
                {data.referralCode}
              </Text>
              <TouchableOpacity style={styles.shareBtn} onPress={invite} accessibilityRole="button">
                <Ionicons name="share-social-outline" size={16} color="#fff" />
                <Text style={styles.shareText}>Paylaş</Text>
              </TouchableOpacity>
            </View>
            {data.invitedCount ? <Text style={styles.invited}>{data.invitedCount} arkadaşın katıldı</Text> : null}
          </View>

          <Text style={styles.section}>Puan hareketleri</Text>
          {data.history.length === 0 ? (
            <Text style={styles.empty}>Henüz puan hareketi yok. İlk randevunuz tamamlanınca puan kazanırsınız.</Text>
          ) : (
            <View style={styles.list}>
              {data.history.map((h, i) => {
                const r = REASON[h.reason] ?? REASON.ADJUST;
                return (
                  <View key={h.id} style={[styles.row, i > 0 && styles.rowBorder]}>
                    <View style={styles.rowIcon}>
                      <Ionicons name={r.icon} size={17} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>{h.description}</Text>
                      <Text style={styles.rowMeta}>
                        {r.label} · {formatDate(h.createdAt)}
                      </Text>
                    </View>
                    <Text style={[styles.rowPoints, { color: h.points > 0 ? colors.success : colors.text }]}>
                      {h.points > 0 ? "+" : ""}
                      {h.points}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
          <Text style={styles.note}>
            Puanlar MyKuaför tarafından verilir; iptal edilen veya iade edilen işlemler için puan verilmez.
          </Text>
        </ScrollView>
      )}
      <BottomNav active="Profile" />
    </View>
  );
}

function Rule({ icon, text }) {
  return (
    <View style={styles.rule}>
      <Ionicons name={icon} size={17} color={colors.primary} />
      <Text style={styles.ruleText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  scroll: { padding: 16, paddingBottom: 32 },
  card: { borderRadius: 22, padding: 20 },
  cardLabel: { color: "rgba(255,255,255,0.8)", fontSize: 13 },
  points: { color: "#fff", fontSize: 40, fontWeight: "800", letterSpacing: -1, marginTop: 2 },
  cardSub: { color: "rgba(255,255,255,0.85)", fontSize: 13.5 },
  redeem: {
    marginTop: 16,
    backgroundColor: "#fff",
    borderRadius: 20,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  redeemText: { color: colors.primary, fontWeight: "800", fontSize: 14 },
  rules: { backgroundColor: colors.background, borderRadius: 16, padding: 14, gap: 10, marginTop: 14 },
  rule: { flexDirection: "row", alignItems: "center", gap: 10 },
  ruleText: { flex: 1, fontSize: 13.5, color: colors.text },
  invite: { backgroundColor: colors.background, borderRadius: 16, padding: 18, marginTop: 14, alignItems: "center" },
  inviteIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  inviteTitle: { fontSize: 16.5, fontWeight: "800", color: colors.text, marginTop: 10, textAlign: "center" },
  inviteText: { fontSize: 13.5, color: colors.muted, textAlign: "center", marginTop: 6, lineHeight: 19 },
  codeRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14 },
  code: {
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 4,
    color: colors.text,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: "dashed",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.primary,
    borderRadius: 18,
    paddingHorizontal: 14,
    height: 38,
  },
  shareText: { color: "#fff", fontWeight: "800" },
  invited: { marginTop: 10, color: colors.success, fontWeight: "700", fontSize: 13 },
  section: { fontSize: 17, fontWeight: "800", color: colors.text, marginTop: 22, marginBottom: 10 },
  empty: { fontSize: 14, color: colors.muted },
  list: { backgroundColor: colors.background, borderRadius: 16, paddingHorizontal: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: { fontSize: 14.5, fontWeight: "600", color: colors.text },
  rowMeta: { fontSize: 12.5, color: colors.muted, marginTop: 2 },
  rowPoints: { fontSize: 15, fontWeight: "800" },
  note: { fontSize: 12, color: colors.faint, marginTop: 16, lineHeight: 17 },
});
