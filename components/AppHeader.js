import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useApp } from "../context/AppContext";
import { colors } from "./theme";

/**
 * Beyaz üst başlık. Ana sekmelerde marka adı, alt sayfalarda (back) geri düğmesi + sayfa başlığı.
 * Sağda bildirim zili (yalnızca oturum açıkken).
 */
export default function AppHeader({ title, back = false, right }) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { unreadNotifications, status } = useApp();
  const signedIn = status === "signedIn";
  const showBack = back || !signedIn;

  return (
    <View style={[styles.header, { paddingTop: insets.top }]}>
      <View style={styles.bar}>
        {showBack ? (
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Geri"
            hitSlop={12}
            style={styles.back}
          >
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </TouchableOpacity>
        ) : null}

        {title ? (
          <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
            {title}
          </Text>
        ) : (
          <View style={styles.brand} accessibilityRole="header" accessibilityLabel="Bakımca">
            <Text style={styles.brandMain}>Bakımca</Text>
            <View style={styles.brandDot} />
          </View>
        )}

        <View style={styles.right}>
          {right}
          {signedIn ? (
            <TouchableOpacity
              onPress={() => navigation.navigate("Notifications")}
              accessibilityRole="button"
              accessibilityLabel={`Bildirimler${unreadNotifications ? `, ${unreadNotifications} okunmamış` : ""}`}
              hitSlop={12}
              style={styles.iconButton}
            >
              <Ionicons name="notifications-outline" size={24} color={colors.text} />
              {unreadNotifications > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadNotifications > 9 ? "9+" : unreadNotifications}</Text>
                </View>
              )}
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#DCDCE0",
  },
  bar: { height: 54, flexDirection: "row", alignItems: "center", paddingHorizontal: 16 },
  back: { marginLeft: -6, marginRight: 4, padding: 2 },
  title: { flex: 1, fontSize: 18, fontWeight: "700", color: colors.text, letterSpacing: -0.2 },
  brand: { flex: 1, flexDirection: "row", alignItems: "flex-end", paddingBottom: 2 },
  brandMain: { fontSize: 21, fontWeight: "800", color: colors.text, letterSpacing: -0.3 },
  brandDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary, marginLeft: 3, marginBottom: 6 },
  right: { flexDirection: "row", alignItems: "center" },
  iconButton: { padding: 4, marginLeft: 8 },
  badge: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: colors.primary,
    borderRadius: 9,
    minWidth: 17,
    height: 17,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: colors.background,
  },
  badgeText: { color: "#fff", fontSize: 9, fontWeight: "800" },
});
