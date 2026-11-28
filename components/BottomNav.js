import React, { useEffect, useRef, useState } from "react";
import { Animated, Keyboard, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { createNavigationContainerRef } from "@react-navigation/native";
import { useApp } from "../context/AppContext";
import { colors } from "./theme";

/** Uygulamanın tek gezinme referansı (App.js'teki NavigationContainer'a bağlı). */
export const navigationRef = createNavigationContainerRef();

const TABS = [
  { route: "Appointments", label: "Randevular", icon: "calendar" },
  { route: "Home", label: "Harita", icon: "map" },
  { route: "TryOn", label: "Dene", icon: "sparkles" },
  { route: "Shop", label: "Mağaza", icon: "bag-handle", cart: true },
  { route: "Profile", label: "Profil", icon: "person" },
];

/**
 * Alt menünün göründüğü ekranlar ve hangi sekmenin seçili olacağı.
 * Burada olmayan ekranlarda (ödeme, ürün detayı, randevu alma…) menü aşağı kayarak gizlenir.
 */
const ROUTE_TAB = {
  Home: "Home",
  Appointments: "Appointments",
  TryOn: "TryOn",
  Shop: "Shop",
  Store: "Shop",
  ShoppingCart: "Shop",
  Profile: "Profile",
  About: "Profile",
  Addresses: "Profile",
  Feedback: "Profile",
  Loyalty: "Profile",
  SavedCards: "Profile",
  Support: "Profile",
  WalletScreen: "Profile",
  Notifications: null,
};

const BAR_HEIGHT = 58;

/** Alt menünün toplam yüksekliği (güvenli alan dahil); harita gibi altına içerik uzanan ekranlar kullanır. */
export function useBottomNavHeight() {
  const insets = useSafeAreaInsets();
  return BAR_HEIGHT + Math.max(insets.bottom, 8);
}

/**
 * Ekranın altında menü kadar boşluk bırakır. Menünün kendisi App kökünde tek kez çizilir ve
 * sayfa geçişlerinde yerinde kalır; ekranlar yalnızca bu boşluğu ayırır.
 */
export function BottomNavSpacer() {
  return <View style={{ height: useBottomNavHeight() }} />;
}

/**
 * Kalıcı alt sekme çubuğu (beyaz, üst köşeleri kavisli). Sayfa değişince yeniden çizilmez,
 * yalnızca seçili sekme değişir. Klavye açıkken ve menüsüz ekranlarda aşağı kayar.
 */
export function PersistentBottomNav({ route }) {
  const insets = useSafeAreaInsets();
  const height = useBottomNavHeight();
  const { state } = useApp();
  const cartCount = state.cartCount;
  const [keyboard, setKeyboard] = useState(false);

  const visible = route in ROUTE_TAB && !keyboard;
  const active = ROUTE_TAB[route];

  const slide = useRef(new Animated.Value(visible ? 0 : 1)).current;
  useEffect(() => {
    Animated.timing(slide, { toValue: visible ? 0 : 1, duration: 180, useNativeDriver: true }).start();
  }, [visible, slide]);

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () =>
      setKeyboard(true),
    );
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () =>
      setKeyboard(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // Sepete ürün eklenince rozet kısa bir "zıplama" yapar (ayrı bir uyarı kutusu yerine).
  const pop = useRef(new Animated.Value(1)).current;
  const lastCount = useRef(cartCount);
  useEffect(() => {
    if (cartCount > lastCount.current) {
      pop.setValue(1.5);
      Animated.spring(pop, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }).start();
    }
    lastCount.current = cartCount;
  }, [cartCount, pop]);

  const go = (tab) => {
    if (!navigationRef.isReady() || route === tab) return;
    navigationRef.navigate(tab);
  };

  return (
    <Animated.View
      pointerEvents={visible ? "auto" : "none"}
      style={[
        styles.nav,
        { height, paddingBottom: Math.max(insets.bottom, 8) },
        { transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [0, height + 24] }) }] },
      ]}
      accessibilityRole="tablist"
    >
      {TABS.map((tab) => {
        const isActive = tab.route === active;
        const color = isActive ? colors.primary : "#8E8E93";
        return (
          <TouchableOpacity
            key={tab.route}
            style={styles.item}
            onPress={() => go(tab.route)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={tab.label}
          >
            <View style={[styles.iconWrap, isActive && styles.iconWrapActive]}>
              <Ionicons name={isActive ? tab.icon : `${tab.icon}-outline`} size={22} color={color} />
              {tab.cart && cartCount > 0 && (
                <Animated.View style={[styles.badge, { transform: [{ scale: pop }] }]}>
                  <Text style={styles.badgeText}>{cartCount > 99 ? "99+" : cartCount}</Text>
                </Animated.View>
              )}
            </View>
            <Text style={[styles.label, { color }, isActive && styles.activeLabel]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  nav: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
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
