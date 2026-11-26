import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AntDesign, FontAwesome6 } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useApp } from "../context/AppContext";
import { colors } from "./theme";

/** Pembe üst başlık. `back` verilirse ana sayfa yerine geri düğmesi gösterilir. */
export default function AppHeader({ title = "WOMAN HAIR DESIGN", back = false }) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { unreadNotifications, status } = useApp();
  const signedIn = status === "signedIn";

  return (
    <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
      <TouchableOpacity
        onPress={() => (back || !signedIn ? navigation.goBack() : navigation.navigate("Home"))}
        accessibilityRole="button"
        accessibilityLabel={back ? "Geri" : "Ana sayfa"}
        hitSlop={10}
      >
        <AntDesign name={back || !signedIn ? "arrow-left" : "home"} size={28} color="#fff" />
      </TouchableOpacity>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      {signedIn ? (
        <TouchableOpacity
          onPress={() => navigation.navigate("Notifications")}
          accessibilityRole="button"
          accessibilityLabel={`Bildirimler${unreadNotifications ? `, ${unreadNotifications} okunmamış` : ""}`}
          hitSlop={10}
        >
          <FontAwesome6 name="bell" size={26} color="#fff" />
          {unreadNotifications > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadNotifications > 9 ? "9+" : unreadNotifications}</Text>
            </View>
          )}
        </TouchableOpacity>
      ) : (
        <View style={{ width: 26 }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  title: { color: "#fff", fontSize: 18, fontWeight: "bold", flex: 1, textAlign: "center", marginHorizontal: 12 },
  badge: {
    position: "absolute",
    top: -6,
    right: -8,
    backgroundColor: colors.primaryDark,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "bold" },
});
