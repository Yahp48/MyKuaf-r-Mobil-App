import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useApp } from "../context/AppContext";
import { colors } from "./theme";

const TABS = [
  { route: "Home", label: "Keşfet", icon: "map" },
  { route: "Appointments", label: "Randevular", icon: "calendar" },
  { route: "Shop", label: "Mağaza", icon: "bag-handle", cart: true },
  { route: "Profile", label: "Profil", icon: "person" },
];

/** Beyaz alt sekme çubuğu: etkin sekme dolu ikon + vurgu rengi, diğerleri çizgi ikon. */
export default function BottomNav({ active }) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { state } = useApp();
  const cartCount = state.cartCount;

  return (
    <View style={[styles.nav, { paddingBottom: Math.max(insets.bottom, 8) }]}>
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
            <View>
              <Ionicons name={isActive ? tab.icon : `${tab.icon}-outline`} size={24} color={color} />
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
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#DCDCE0",
  },
  item: { flex: 1, alignItems: "center", gap: 3 },
  label: { fontSize: 11, fontWeight: "500" },
  activeLabel: { fontWeight: "700" },
  badge: {
    position: "absolute",
    top: -4,
    right: -10,
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
