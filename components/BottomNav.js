import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FontAwesome5, FontAwesome6 } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useApp } from "../context/AppContext";
import { colors } from "./theme";

const TABS = [
  { route: "Appointments", label: "Randevular", icon: (c) => <FontAwesome5 name="calendar-alt" size={22} color={c} /> },
  { route: "Home", label: "Harita", icon: (c) => <FontAwesome5 name="map-marked-alt" size={22} color={c} /> },
  { route: "Shop", label: "Mağaza", icon: (c) => <FontAwesome5 name="shopping-bag" size={22} color={c} />, cart: true },
  { route: "Profile", label: "Profil", icon: (c) => <FontAwesome6 name="user" size={22} color={c} /> },
];

export default function BottomNav({ active }) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { state } = useApp();
  const cartCount = state.cartCount;

  return (
    <View style={[styles.nav, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {TABS.map((tab) => {
        const isActive = tab.route === active;
        const color = isActive ? colors.primaryDark : "#fff";
        return (
          <TouchableOpacity
            key={tab.route}
            style={styles.item}
            onPress={() => !isActive && navigation.navigate(tab.route)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={tab.label}
          >
            <View style={[styles.iconWrap, isActive && styles.activeWrap]}>
              {tab.icon(color)}
              {tab.cart && cartCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{cartCount > 99 ? "99+" : cartCount}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.label, isActive && styles.activeLabel]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    flexDirection: "row",
    backgroundColor: colors.primary,
    paddingTop: 8,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  item: { flex: 1, alignItems: "center" },
  iconWrap: { paddingHorizontal: 14, paddingVertical: 4, borderRadius: 16 },
  activeWrap: { backgroundColor: "#fff" },
  label: { color: "#fff", fontSize: 11, marginTop: 3, fontWeight: "500" },
  activeLabel: { fontWeight: "bold" },
  badge: {
    position: "absolute",
    top: -4,
    right: 2,
    backgroundColor: colors.primaryDark,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  badgeText: { color: "#fff", fontSize: 9, fontWeight: "bold" },
});
