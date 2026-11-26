import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FontAwesome6, MaterialIcons } from "@expo/vector-icons";
import { useApp } from "../context/AppContext";
import AppHeader from "../components/AppHeader";
import BottomNav from "../components/BottomNav";
import { colors, formatTL } from "../components/theme";

const MENU = [
  { route: "AccountSettings", icon: "sliders", label: "Hesap Ayarları" },
  { route: "Order", icon: "bag-shopping", label: "Siparişlerim" },
  { route: "Favorites", icon: "heart", label: "Favorilerim" },
  { route: "WalletScreen", icon: "wallet", label: "Cüzdanım" },
  { route: "Reviews", icon: "comment-dots", label: "Değerlendirmelerim" },
  { route: "Support", icon: "headset", label: "Müşteri Hizmetleri" },
  { route: "Feedback", icon: "star", label: "Uygulama Geri Bildirimi" },
  { route: "Privacy", icon: "lock", label: "Gizlilik ve KVKK" },
  { route: "About", icon: "circle-info", label: "Hakkında" },
];

export default function ProfileScreen({ navigation }) {
  const { user } = useApp();
  const initials = (user?.name ?? "?")
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toLocaleUpperCase("tr-TR");

  return (
    <View style={styles.container}>
      <AppHeader />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.profile}>
          <View style={styles.avatar}>
            <Text style={styles.initials}>{initials}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={styles.name}>{user?.name}</Text>
            <Text style={styles.email}>{user?.email}</Text>
          </View>
          <TouchableOpacity style={styles.wallet} onPress={() => navigation.navigate("WalletScreen")}>
            <Text style={styles.walletLabel}>Bakiye</Text>
            <Text style={styles.walletValue}>{formatTL(user?.walletBalance ?? 0)}</Text>
          </TouchableOpacity>
        </View>

        {MENU.map((item) => (
          <TouchableOpacity key={item.route} style={styles.item} onPress={() => navigation.navigate(item.route)}>
            <FontAwesome6 name={item.icon} size={20} color={colors.primary} style={{ width: 28 }} />
            <Text style={styles.itemText}>{item.label}</Text>
            <MaterialIcons name="chevron-right" size={24} color="#ccc" />
          </TouchableOpacity>
        ))}
      </ScrollView>
      <BottomNav active="Profile" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 16, paddingBottom: 32 },
  profile: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#fff5fa",
    marginBottom: 16,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  initials: { color: "#fff", fontSize: 20, fontWeight: "bold" },
  name: { fontSize: 17, fontWeight: "bold", color: colors.text },
  email: { fontSize: 13, color: colors.muted, marginTop: 2 },
  wallet: { alignItems: "flex-end" },
  walletLabel: { fontSize: 12, color: colors.muted },
  walletValue: { fontSize: 15, fontWeight: "bold", color: colors.primary },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemText: { flex: 1, fontSize: 16, color: colors.text, marginLeft: 8 },
});
