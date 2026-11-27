import React, { createContext, useContext, useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, shadow } from "./theme";

// Yükleme iskeleti: sayfanın şeffaf taslağı gri kutularla gösterilir ve hafifçe parlayıp söner.
// Bir grup içindeki tüm kutular aynı ritimde nabız atar (tek animasyon).

const PulseContext = createContext(null);
const BONE = "#E9E9EE";

export function SkeletonGroup({ children, style }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <PulseContext.Provider value={pulse}>
      <View
        style={style}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel="Yükleniyor"
        importantForAccessibility="yes"
      >
        {children}
      </View>
    </PulseContext.Provider>
  );
}

/** Tek gri kutu. w/h sayı veya yüzde; r köşe yarıçapı. */
export function Bone({ w = "100%", h = 14, r = 8, style }) {
  const pulse = useContext(PulseContext);
  const opacity = pulse ? pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.45] }) : 1;
  return <Animated.View style={[{ width: w, height: h, borderRadius: r, backgroundColor: BONE, opacity }, style]} />;
}

const Row = ({ children, style }) => (
  <View style={[{ flexDirection: "row", alignItems: "center" }, style]}>{children}</View>
);

/** Liste: solda yuvarlak/kare görsel, sağda iki satır metin (bildirimler, yorumlar). */
export function ListSkeleton({ rows = 7, avatar = "circle" }) {
  return (
    <SkeletonGroup style={styles.pad}>
      {Array.from({ length: rows }, (_, i) => (
        <Row key={i} style={styles.listRow}>
          <Bone w={44} h={44} r={avatar === "circle" ? 22 : 10} />
          <View style={{ flex: 1, marginLeft: 12, gap: 8 }}>
            <Bone w={`${70 - (i % 3) * 12}%`} h={14} />
            <Bone w={`${45 + (i % 2) * 20}%`} h={11} />
          </View>
        </Row>
      ))}
    </SkeletonGroup>
  );
}

/** Kart listesi: randevular, siparişler. */
export function CardListSkeleton({ cards = 4 }) {
  return (
    <SkeletonGroup style={styles.pad}>
      {Array.from({ length: cards }, (_, i) => (
        <View key={i} style={styles.card}>
          <Row style={{ justifyContent: "space-between" }}>
            <Bone w="45%" h={16} />
            <Bone w={70} h={22} r={11} />
          </Row>
          <Bone w="70%" h={12} style={{ marginTop: 12 }} />
          <Bone w="55%" h={12} style={{ marginTop: 8 }} />
          <Row style={{ marginTop: 16, gap: 10 }}>
            <Bone w={90} h={32} r={16} />
            <Bone w={90} h={32} r={16} />
          </Row>
        </View>
      ))}
    </SkeletonGroup>
  );
}

/** Ürün ızgarası (2 sütun). */
export function GridSkeleton({ items = 6, header = false }) {
  return (
    <SkeletonGroup style={styles.pad}>
      {header ? (
        <Row style={{ gap: 12, marginBottom: 16 }}>
          {Array.from({ length: 5 }, (_, i) => (
            <View key={i} style={{ alignItems: "center", gap: 6 }}>
              <Bone w={62} h={62} r={31} />
              <Bone w={50} h={10} />
            </View>
          ))}
        </Row>
      ) : null}
      <View style={styles.grid}>
        {Array.from({ length: items }, (_, i) => (
          <View key={i} style={styles.gridItem}>
            <Bone w="100%" h={150} r={14} />
            <Bone w="85%" h={13} style={{ marginTop: 10 }} />
            <Bone w="55%" h={11} style={{ marginTop: 6 }} />
            <Bone w="40%" h={15} style={{ marginTop: 10 }} />
          </View>
        ))}
      </View>
    </SkeletonGroup>
  );
}

/** Ayrıntı sayfası: üstte büyük görsel, altında başlık ve paragraflar (ürün, sipariş). */
export function DetailSkeleton({ image = true }) {
  return (
    <SkeletonGroup>
      {image ? <Bone w="100%" h={300} r={0} /> : null}
      <View style={styles.pad}>
        <Bone w="75%" h={22} />
        <Bone w="40%" h={14} style={{ marginTop: 10 }} />
        <Bone w="30%" h={26} style={{ marginTop: 18 }} />
        {Array.from({ length: 5 }, (_, i) => (
          <Bone key={i} w={`${95 - (i % 3) * 10}%`} h={12} style={{ marginTop: 12 }} />
        ))}
        <Bone w="100%" h={52} r={14} style={{ marginTop: 28 }} />
      </View>
    </SkeletonGroup>
  );
}

/** Salon kartı içeriği (hizmet/yorum satırları). */
export function SheetSkeleton() {
  return (
    <SkeletonGroup style={{ paddingHorizontal: 18, paddingTop: 12 }}>
      {Array.from({ length: 4 }, (_, i) => (
        <Row key={i} style={{ paddingVertical: 12, gap: 12 }}>
          <Bone w={22} h={22} r={11} />
          <View style={{ flex: 1, gap: 7 }}>
            <Bone w={`${70 - i * 8}%`} h={13} />
            <Bone w="40%" h={10} />
          </View>
        </Row>
      ))}
    </SkeletonGroup>
  );
}

/** Cüzdan: bakiye kartı + hareket listesi. */
export function WalletSkeleton() {
  return (
    <SkeletonGroup style={styles.pad}>
      <Bone w="100%" h={190} r={22} />
      <Row style={{ gap: 10, marginTop: 16 }}>
        <Bone w="31%" h={70} r={16} />
        <Bone w="31%" h={70} r={16} />
        <Bone w="31%" h={70} r={16} />
      </Row>
      <Bone w="40%" h={16} style={{ marginTop: 24 }} />
      {Array.from({ length: 5 }, (_, i) => (
        <Row key={i} style={styles.listRow}>
          <Bone w={40} h={40} r={20} />
          <View style={{ flex: 1, marginLeft: 12, gap: 7 }}>
            <Bone w="55%" h={13} />
            <Bone w="35%" h={10} />
          </View>
          <Bone w={60} h={14} />
        </Row>
      ))}
    </SkeletonGroup>
  );
}

/** Form ekranı (randevu, ödeme). */
export function FormSkeleton() {
  return (
    <SkeletonGroup style={styles.pad}>
      {Array.from({ length: 3 }, (_, i) => (
        <View key={i} style={{ marginBottom: 22 }}>
          <Bone w="35%" h={16} />
          <Bone w="100%" h={56} r={14} style={{ marginTop: 12 }} />
          <Bone w="100%" h={56} r={14} style={{ marginTop: 10 }} />
        </View>
      ))}
      <Bone w="100%" h={52} r={14} />
    </SkeletonGroup>
  );
}

/**
 * Yükleme hatası: sayfanın iskeleti soluk görünür, altta bağlantı uyarısı ve "Tekrar dene".
 * Bağlantı geri gelince useRemote kendiliğinden yeniden dener.
 */
export function LoadError({ message, onRetry, skeleton }) {
  return (
    <View style={{ flex: 1 }}>
      <View style={{ opacity: 0.55 }} pointerEvents="none">
        {skeleton ?? <ListSkeleton />}
      </View>
      <View style={styles.errorCard} accessibilityRole="alert">
        <Ionicons name="cloud-offline-outline" size={22} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.errorTitle}>Bağlantı sorunu</Text>
          <Text style={styles.errorText} numberOfLines={2}>
            {message || "Sayfa yüklenemedi. Bağlantınız gelince kendiliğinden yenilenecek."}
          </Text>
        </View>
        {onRetry ? (
          <TouchableOpacity onPress={onRetry} style={styles.retry} accessibilityRole="button">
            <Text style={styles.retryText}>Tekrar dene</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16 },
  listRow: { paddingVertical: 12 },
  card: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    ...shadow,
    shadowOpacity: 0.04,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  gridItem: { width: "48%", marginBottom: 18 },
  errorCard: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 14,
    ...shadow,
    shadowOpacity: 0.14,
    elevation: 8,
  },
  errorTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  errorText: { fontSize: 13, color: colors.muted, marginTop: 2 },
  retry: { backgroundColor: colors.primarySoft, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  retryText: { color: colors.primary, fontWeight: "800", fontSize: 13 },
});
