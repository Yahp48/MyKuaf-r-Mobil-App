import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useApp } from "../context/AppContext";
import { colors } from "./theme";

const TABS = [
  { route: "Appointments", label: "Randevular", icon: "calendar" },
  { route: "Home", label: "Harita", icon: "map" },
  { route: "TryOn", label: "Dene", icon: "sparkles" },
  { route: "Shop", label: "Mağaza", icon: "bag-handle", cart: true },
  { route: "Profile", label: "Profil", icon: "person" },
];

const BAR_HEIGHT = 58;

/** Alt menünün toplam yüksekliği (güvenli alan dahil); harita gibi altına içerik uzanan ekranlar kullanır. */
export function useBottomNavHeight() {
  const insets = useSafeAreaInsets();
  return BAR_HEIGHT + Math.max(insets.bottom, 8);
}

/**
 * Beyaz alt sekme çubuğu, üst köşeleri kavisli. `floating`: içeriğin (ör. harita) üzerinde durur,
 * böylece kavislerin arkasında içerik görünür.
 */
export default function BottomNav({ active, floating = false }) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const height = useBottomNavHeight();
  const { state } = useApp();
  const cartCount = state.cartCount;

  return (
    <View style={[styles.nav, { height, paddingBottom: Math.max(insets.bottom, 8) }, floating && styles.floating]}>
      {TABS.map((tab) => {
        const isActive = tab.route === active;
        const color = isActive ? colors.primary : "#8E8E93";
        return (
          <TouchableOpacity
            key={tab.route}
            style={styles.item}
            onPress={() => !isActive && navigation.navigate(tab.route)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={tab.label}
          >
            <View style={[styles.iconWrap, isActive && styles.iconWrapActive]}>
              <Ionicons name={isActive ? tab.icon : `${tab.icon}-outline`} size={22} color={color} />
              {tab.cart && cartCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{cartCount > 99 ? "99+" : cartCount}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.label, { color }, isActive && styles.activeLabel]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    flexDirection: "row",
    backgroundColor: colors.background,
    paddingTop: 7,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: -3 },
    elevation: 18,
  },
  floating: { position: "absolute", left: 0, right: 0, bottom: 0 },
  item: { flex: 1, alignItems: "center", gap: 2 },
  iconWrap: { paddingHorizontal: 16, paddingVertical: 4, borderRadius: 14 },
  iconWrapActive: { backgroundColor: colors.primarySoft },
  label: { fontSize: 11, fontWeight: "500" },
  activeLabel: { fontWeight: "700" },
  badge: {
    position: "absolute",
    top: -2,
    right: 6,
    backgroundColor: colors.primary,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: colors.background,
  },
  badgeText: { color: "#fff", fontSize: 9, fontWeight: "800" },
});
