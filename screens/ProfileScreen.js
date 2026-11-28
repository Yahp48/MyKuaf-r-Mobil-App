import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useApp } from "../context/AppContext";
import { cardApi } from "../services/api";
import AppHeader from "../components/AppHeader";
import { BottomNavSpacer } from "../components/BottomNav";
import { colors, formatTL } from "../components/theme";

const GROUPS = [
  {
    title: "HESABIM",
    items: [
      { route: "Order", icon: "receipt-outline", label: "Siparişlerim" },
      { route: "Favorites", icon: "heart-outline", label: "Favorilerim" },
      { route: "Loyalty", icon: "star-outline", label: "Puanlarım ve davet" },
      { route: "SavedCards", icon: "card-outline", label: "Kayıtlı kartlarım" },
      { route: "Addresses", icon: "location-outline", label: "Adreslerim" },
      { route: "Reviews", icon: "star-outline", label: "Değerlendirmelerim" },
      { route: "AccountSettings", icon: "person-circle-outline", label: "Hesap ayarları" },
    ],
  },
  {
    title: "YARDIM",
    items: [
      { route: "Support", icon: "chatbubble-ellipses-outline", label: "Müşteri hizmetleri" },
      { route: "Feedback", icon: "megaphone-outline", label: "Uygulama geri bildirimi" },
    ],
  },
  {
    title: "DİĞER",
    items: [
      { route: "Privacy", icon: "shield-checkmark-outline", label: "Gizlilik ve KVKK" },
      { route: "About", icon: "information-circle-outline", label: "Hakkında" },
    ],
  },
];

export default function ProfileScreen({ navigation }) {
  const { user } = useApp();
  // Ödeme kuruluşu kart saklamıyorsa "Kayıtlı kartlarım" gösterilmez (çalışmayan özellik menüde olmaz).
  const [cardsSupported, setCardsSupported] = useState(false);
  useEffect(() => {
    cardApi
      .list()
      .then((r) => setCardsSupported(r.supported !== false))
      .catch(() => {});
  }, []);
  const initials = (user?.name ?? "?")
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toLocaleUpperCase("tr-TR");

  return (
    <View style={styles.container}>
      <AppHeader title="Profil" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.profile}>
          <View style={styles.avatar}>
            <Text style={styles.initials}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{user?.name}</Text>
            <Text style={styles.email}>{user?.email}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.wallet}
          onPress={() => navigation.navigate("WalletScreen")}
          accessibilityRole="button"
          accessibilityLabel={`Cüzdan, bakiye ${formatTL(user?.walletBalance ?? 0)}`}
        >
          <View style={styles.walletIcon}>
            <Ionicons name="wallet-outline" size={22} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.walletLabel}>Cüzdan bakiyesi</Text>
            <Text style={styles.walletValue}>{formatTL(user?.walletBalance ?? 0)}</Text>
          </View>
          <Text style={styles.walletAction}>Yükle</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.faint} />
        </TouchableOpacity>

        {GROUPS.map((g) => (
          <View key={g.title}>
            <Text style={styles.groupLabel}>{g.title}</Text>
            <View style={styles.card}>
              {g.items
                .filter((item) => item.route !== "SavedCards" || cardsSupported)
                .map((item, i) => (
                  <TouchableOpacity
                    key={item.route}
                    style={[styles.item, i > 0 && styles.border]}
                    onPress={() => navigation.navigate(item.route)}
                    accessibilityRole="button"
                  >
                    <Ionicons name={item.icon} size={22} color={colors.text} />
                    <Text style={styles.itemText}>{item.label}</Text>
                    <Ionicons name="chevron-forward" size={18} color={colors.faint} />
                  </TouchableOpacity>
                ))}
            </View>
          </View>
        ))}
      </ScrollView>
      <BottomNavSpacer />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  scroll: { padding: 16, paddingBottom: 32 },
  profile: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 8 },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  initials: { color: "#fff", fontSize: 21, fontWeight: "700" },
  name: { fontSize: 20, fontWeight: "700", color: colors.text, letterSpacing: -0.3 },
  email: { fontSize: 14, color: colors.muted, marginTop: 2 },
  wallet: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.background,
    borderRadius: 14,
    padding: 14,
    marginTop: 16,
  },
  walletIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  walletLabel: { fontSize: 13, color: colors.muted },
  walletValue: { fontSize: 18, fontWeight: "700", color: colors.text, marginTop: 1 },
  walletAction: { fontSize: 14, fontWeight: "600", color: colors.primary },
  groupLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.muted,
    letterSpacing: 0.8,
    marginTop: 22,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: { backgroundColor: colors.background, borderRadius: 14, overflow: "hidden" },
  item: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 15 },
  border: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#DCDCE0" },
  itemText: { flex: 1, fontSize: 16, color: colors.text },
});
