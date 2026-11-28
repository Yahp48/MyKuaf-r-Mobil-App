import React from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

/**
 * Çökme koruması: yakalanmayan JavaScript hatasında uygulama kapanmak yerine hata ekranı gösterir ve
 * hatayı sunucuya bildirir (POST /api/meta/client-errors; kişisel veri gönderilmez).
 * Bu dosya bilerek bağımsızdır (tema, API istemcisi vb. içe aktarmaz): onlarda hata olsa bile çalışır.
 */

const API = (process.env.EXPO_PUBLIC_API_URL || "").replace(/\/+$/, "");
const APP_VERSION = "1.0.0";

export function reportError(error, meta = {}) {
  if (!API) return;
  try {
    fetch(`${API}/meta/client-errors`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: String(error?.message ?? error).slice(0, 1000),
        stack: String(error?.stack ?? "").slice(0, 6000),
        fatal: !!meta.fatal,
        where: meta.where,
        platform: `${Platform.OS} ${Platform.Version}`,
        appVersion: APP_VERSION,
      }),
    }).catch(() => {});
  } catch {
    // bildirilemedi; hata ekranı yine de gösterilir
  }
}

let crash = null;
const listeners = new Set();
const setCrash = (e) => {
  crash = e;
  listeners.forEach((fn) => fn(e));
};

/** Global hata yakalayıcı. Geliştirmede Expo'nun kırmızı hata ekranı aynen çalışır. */
export function installCrashGuard() {
  const ErrorUtils = global.ErrorUtils;
  if (!ErrorUtils?.setGlobalHandler) return;
  const previous = ErrorUtils.getGlobalHandler?.();
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    reportError(error, { fatal: isFatal, where: "global" });
    if (__DEV__ && previous) return previous(error, isFatal);
    if (isFatal) setCrash(error);
  });
}

class Boundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    reportError(error, { fatal: true, where: "render" });
  }

  render() {
    if (this.state.error) {
      return <CrashScreen error={this.state.error} onRetry={() => this.setState({ error: null })} />;
    }
    return this.props.children;
  }
}

/** Uygulamanın kökü: açılışta (modül yüklenirken) veya sonradan oluşan hatada hata ekranı. */
export function CrashRoot({ App, bootError }) {
  const [error, setError] = React.useState(bootError ?? crash);
  React.useEffect(() => {
    listeners.add(setError);
    return () => listeners.delete(setError);
  }, []);
  if (error || !App) return <CrashScreen error={error} />;
  return (
    <Boundary>
      <App />
    </Boundary>
  );
}

function CrashScreen({ error, onRetry }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Bir sorun oluştu</Text>
      <Text style={styles.text}>
        Hata bize iletildi. Uygulamayı kapatıp yeniden açmayı deneyin; sorun sürerse müşteri hizmetlerimize yazın.
      </Text>
      {onRetry ? (
        <TouchableOpacity style={styles.btn} onPress={onRetry} accessibilityRole="button">
          <Text style={styles.btnText}>Tekrar dene</Text>
        </TouchableOpacity>
      ) : null}
      <ScrollView style={styles.detailBox}>
        <Text style={styles.detail} selectable>
          {String(error?.message ?? error ?? "Bilinmeyen hata")}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#FFFFFF", padding: 24, paddingTop: 96 },
  title: { fontSize: 22, fontWeight: "700", color: "#1C1C1E" },
  text: { fontSize: 15, color: "#6E6E73", marginTop: 10, lineHeight: 21 },
  btn: { backgroundColor: "#C9184A", borderRadius: 14, paddingVertical: 14, alignItems: "center", marginTop: 24 },
  btnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  detailBox: { marginTop: 24, maxHeight: 220, backgroundColor: "#F5F5F7", borderRadius: 12, padding: 12 },
  detail: { fontSize: 12, color: "#6E6E73", fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
});
