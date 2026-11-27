import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useNetInfo } from "@react-native-community/netinfo";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

/** İnternet bağlantısı kesilince tüm ekranların üstünde ince bir uyarı gösterir. */
export default function OfflineBanner() {
  const net = useNetInfo();
  const insets = useSafeAreaInsets();
  // isInternetReachable null = henüz bilinmiyor; yalnızca kesin kopuklukta gösterilir.
  const offline = net.isConnected === false || net.isInternetReachable === false;
  if (!offline) return null;
  return (
    <View style={[styles.bar, { paddingTop: insets.top + 4 }]} pointerEvents="none" accessibilityRole="alert">
      <Ionicons name="cloud-offline-outline" size={15} color="#fff" />
      <Text style={styles.text}>İnternet bağlantısı yok · bağlantı gelince sayfalar yenilenecek</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    elevation: 100,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingBottom: 6,
    backgroundColor: "#1C1C1E",
  },
  text: { color: "#fff", fontSize: 12.5, fontWeight: "600" },
});
