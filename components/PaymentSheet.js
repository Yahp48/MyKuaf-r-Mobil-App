import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Linking, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "./theme";

/**
 * Uygulama içi güvenli ödeme penceresi.
 *
 * Ödeme kuruluşunun kendi sayfası (3D Secure dahil) uygulamadan çıkmadan, tam ekran bir pencerede açılır.
 * Kart bilgisi yine yalnızca ödeme kuruluşunun sayfasına girilir; uygulama sayfanın içeriğine
 * dokunmaz, yalnızca adres çubuğunu gösterir ve dönüş adresini (mykuafor:// / exp://) yakalar.
 * Sonuç her zaman sunucudan sorgulanır (bkz. services/checkout.js).
 *
 * App kökünde bir kez <PaymentHost /> olarak bağlanır; ekranlar `presentPayment` ile açar.
 */

let host = null;

/** @returns {Promise<"returned"|"closed">} */
export function presentPayment(url, returnPrefix) {
  if (!host) return Promise.reject(new Error("Ödeme penceresi hazır değil"));
  return host(url, returnPrefix);
}

const isWeb = (u) => /^https?:\/\//i.test(u) || u === "about:blank" || u.startsWith("about:srcdoc");

export function PaymentHost() {
  const insets = useSafeAreaInsets();
  const [req, setReq] = useState(null);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState("");
  const done = useRef(false);

  useEffect(() => {
    host = (url, returnPrefix) =>
      new Promise((resolve) => {
        done.current = false;
        setLoading(true);
        setCurrent(url);
        setReq({ url, returnPrefix, resolve });
      });
    return () => {
      host = null;
    };
  }, []);

  const finish = (result) => {
    if (!req || done.current) return;
    done.current = true;
    req.resolve(result);
    setReq(null);
  };

  /** Dönüş adresi mi? Öyleyse pencereyi kapatır ve sayfanın yüklenmesini durdurur. */
  const catchReturn = (url) => {
    if (!req || !url) return false;
    if (url.startsWith(req.returnPrefix) || url.startsWith("mykuafor://")) {
      finish("returned");
      return true;
    }
    return false;
  };

  const onShouldStart = (e) => {
    if (catchReturn(e.url)) return false;
    if (isWeb(e.url)) return true;
    // Banka uygulamasıyla onay (ör. intent://, bankaadi://) gibi web dışı bağlantılar: sistem açsın.
    Linking.openURL(e.url).catch(() => {});
    return false;
  };

  const askClose = () =>
    Alert.alert("Ödemeden çıkılsın mı?", "Ödeme tamamlanmadıysa kartınızdan çekim yapılmaz.", [
      { text: "Devam et", style: "cancel" },
      { text: "Çık", style: "destructive", onPress: () => finish("closed") },
    ]);

  let host_ = "";
  let secure = false;
  try {
    const u = new URL(current);
    host_ = u.host;
    secure = u.protocol === "https:";
  } catch {
    host_ = "";
  }

  return (
    <Modal
      visible={!!req}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={askClose}
      statusBarTranslucent={false}
    >
      <View style={[styles.wrap, { paddingTop: insets.top }]}>
        <View style={styles.bar}>
          <TouchableOpacity onPress={askClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Ödemeyi kapat">
            <Ionicons name="close" size={26} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.titleBox}>
            <Text style={styles.title}>Güvenli ödeme</Text>
            <View style={styles.hostRow}>
              <Ionicons
                name={secure ? "lock-closed" : "lock-open-outline"}
                size={11}
                color={secure ? colors.success : colors.muted}
              />
              <Text style={styles.host} numberOfLines={1}>
                {host_}
              </Text>
            </View>
          </View>
          <View style={{ width: 26 }}>{loading ? <ActivityIndicator size="small" color={colors.primary} /> : null}</View>
        </View>
        {req ? (
          <WebView
            source={{ uri: req.url }}
            style={styles.web}
            originWhitelist={["*"]}
            onShouldStartLoadWithRequest={onShouldStart}
            onLoadStart={(e) => {
              setLoading(true);
              if (!catchReturn(e.nativeEvent.url)) setCurrent(e.nativeEvent.url);
            }}
            onLoadEnd={() => setLoading(false)}
            onNavigationStateChange={(s) => catchReturn(s.url)}
            // Bazı Android sürümlerinde POST sonrası özel şemaya yönlendirme hata olarak gelir.
            onError={(e) => {
              if (!catchReturn(e.nativeEvent.url)) setLoading(false);
            }}
            incognito
            sharedCookiesEnabled={false}
            thirdPartyCookiesEnabled
            setSupportMultipleWindows={false}
            javaScriptCanOpenWindowsAutomatically={false}
            allowsBackForwardNavigationGestures={false}
            allowFileAccess={false}
            mixedContentMode="never"
            cacheEnabled={false}
            textZoom={100}
            {...(Platform.OS === "ios" ? { contentInsetAdjustmentBehavior: "never" } : null)}
          />
        ) : null}
        <View style={[styles.foot, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          <Ionicons name="shield-checkmark-outline" size={13} color={colors.muted} />
          <Text style={styles.footText}>Kart bilgileriniz ödeme kuruluşuna gider, MyKuaför'de saklanmaz.</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.background },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 12,
  },
  titleBox: { flex: 1, alignItems: "center" },
  title: { fontSize: 15, fontWeight: "600", color: colors.text },
  hostRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2, maxWidth: "90%" },
  host: { fontSize: 12, color: colors.muted },
  web: { flex: 1, backgroundColor: colors.background },
  foot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingTop: 8,
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  footText: { fontSize: 11.5, color: colors.muted, flexShrink: 1 },
});
