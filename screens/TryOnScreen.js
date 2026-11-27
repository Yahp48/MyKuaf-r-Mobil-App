import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { WebView } from "react-native-webview";
import { useCameraPermissions } from "expo-camera";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../components/theme";
import { TRYON_PAGE } from "../components/tryon/page";
import { FACE_SHAPES, HAIR_COLORS, HAIRSTYLES, MAKEUP_LOOKS } from "../components/tryon/catalog";

const ITEM = 62;
const GAP = 14;
const CATEGORIES = [
  { key: "hair", label: "Saç rengi" },
  { key: "makeup", label: "Makyaj" },
  { key: "styles", label: "Saç modeli" },
];

/**
 * Canlı deneme: ön kamera görüntüsünde yüz şekli tespiti, saç rengi ve makyaj (cihaz üzerinde, MediaPipe).
 * Görüntü hiçbir sunucuya gönderilmez. Alttaki halkada kaydırarak seçenekler anında denenir.
 */
export default function TryOnScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [permission, requestPermission] = useCameraPermissions();
  const webRef = useRef(null);
  const [status, setStatus] = useState("idle"); // camera | loading | ready | error
  const [error, setError] = useState(null);
  const [facePresent, setFacePresent] = useState(true);
  const [scan, setScan] = useState({ progress: 0, frontal: true, done: false });
  const [shape, setShape] = useState(null);
  const [shapeSheet, setShapeSheet] = useState(false);
  const [category, setCategory] = useState("hair");
  const [hairIndex, setHairIndex] = useState(0);
  const [makeupIndex, setMakeupIndex] = useState(0);
  const [gender, setGender] = useState("women");
  const [capturing, setCapturing] = useState(false);
  const flash = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) requestPermission();
  }, [permission, requestPermission]);

  const send = useCallback((cmd) => {
    webRef.current?.injectJavaScript(`window.__tryon && window.__tryon.set(${JSON.stringify(cmd)}); true;`);
  }, []);

  const applyHair = (i) => {
    setHairIndex(i);
    const c = HAIR_COLORS[i];
    send({ hair: c.color ? { color: c.color, alpha: c.alpha, lift: c.lift ?? 0, dark: c.dark ?? 0 } : null });
  };
  const applyMakeup = (i) => {
    setMakeupIndex(i);
    const { key, label, swatch, ...look } = MAKEUP_LOOKS[i];
    send({ makeup: key === "none" ? null : look });
  };

  const rescan = () => {
    setShapeSheet(false);
    setScan({ progress: 0, frontal: true, done: false });
    send({ scan: true });
  };

  const capture = () => {
    if (status !== "ready" || capturing) return;
    setCapturing(true);
    flash.setValue(1);
    Animated.timing(flash, { toValue: 0, duration: 350, useNativeDriver: true }).start();
    send({ capture: true });
  };

  const savePhoto = async (base64) => {
    try {
      const file = new File(Paths.cache, `mykuafor-stil-${Date.now()}.jpg`);
      await file.write(base64, { encoding: "base64" });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: "image/jpeg", dialogTitle: "Stilini paylaş" });
      } else {
        Alert.alert("Paylaşım kullanılamıyor", "Bu cihazda paylaşım desteklenmiyor.");
      }
    } catch (e) {
      Alert.alert("Fotoğraf kaydedilemedi", e.message);
    } finally {
      setCapturing(false);
    }
  };

  const onMessage = (e) => {
    let msg;
    try {
      msg = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    switch (msg.type) {
      case "status":
        setStatus(msg.status);
        break;
      case "error":
        if (msg.code === "capture") {
          setCapturing(false);
          Alert.alert("Fotoğraf alınamadı", "Lütfen tekrar deneyin.");
        } else {
          setStatus("error");
          setError(msg.code);
        }
        break;
      case "face":
        setFacePresent(msg.present);
        break;
      case "scan":
        setScan((s) => (s.done ? s : { progress: msg.progress, frontal: msg.frontal, done: false }));
        break;
      case "shape":
        setScan({ progress: 1, frontal: true, done: true });
        setShape(msg.shape);
        setShapeSheet(true);
        break;
      case "photo":
        savePhoto(msg.data);
        break;
      default:
    }
  };

  const reload = () => {
    setError(null);
    setStatus("idle");
    setScan({ progress: 0, frontal: true, done: false });
    setHairIndex(0);
    setMakeupIndex(0);
    webRef.current?.reload();
  };

  if (!permission) return <View style={styles.black} />;
  if (!permission.granted) {
    return (
      <View style={[styles.black, styles.centered, { padding: 32 }]}>
        <StatusBar style="light" />
        <Ionicons name="camera-outline" size={44} color="#fff" />
        <Text style={styles.permTitle}>Kamera izni gerekli</Text>
        <Text style={styles.permText}>
          Saç rengi ve makyajı canlı denemek için ön kamerayı kullanırız. Görüntünüz yalnızca telefonunuzda işlenir,
          kaydedilmez ve hiçbir yere gönderilmez.
        </Text>
        <TouchableOpacity
          style={styles.permButton}
          onPress={() => (permission.canAskAgain ? requestPermission() : Linking.openSettings())}
        >
          <Text style={styles.permButtonText}>{permission.canAskAgain ? "İzin ver" : "Ayarları aç"}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 18 }}>
          <Text style={styles.permBack}>Vazgeç</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const items = category === "hair" ? HAIR_COLORS : MAKEUP_LOOKS;
  const selected = category === "hair" ? hairIndex : makeupIndex;
  const scanning = status === "ready" && !scan.done;

  return (
    <View style={styles.black}>
      <StatusBar style="light" />
      <WebView
        ref={webRef}
        source={{ html: TRYON_PAGE, baseUrl: "https://localhost/" }}
        style={styles.web}
        originWhitelist={["*"]}
        javaScriptEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        mediaCapturePermissionGrantType="grant"
        androidLayerType="hardware"
        onMessage={onMessage}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        setSupportMultipleWindows={false}
        onError={() => {
          setStatus("error");
          setError("load");
        }}
      />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.flash, { opacity: flash }]} />

      {/* Üst çubuk */}
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.round} accessibilityLabel="Kapat">
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.shapeChip}
          onPress={() => (shape ? setShapeSheet(true) : null)}
          disabled={!shape}
          accessibilityRole="button"
          accessibilityLabel={shape ? `Yüz şekli ${FACE_SHAPES[shape].label}. Ayrıntılar` : "Yüz şekli belirleniyor"}
        >
          <Ionicons name="happy-outline" size={16} color="#fff" />
          <Text style={styles.shapeChipText}>
            {shape ? `Yüz şekli: ${FACE_SHAPES[shape].label}` : "Yüz şekli belirleniyor"}
          </Text>
          {shape ? <Ionicons name="chevron-down" size={14} color="#fff" /> : null}
        </TouchableOpacity>
        <TouchableOpacity onPress={rescan} style={styles.round} accessibilityLabel="Yüz şeklini yeniden belirle">
          <Ionicons name="scan-outline" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Durumlar */}
      {status !== "ready" && status !== "error" ? (
        <View style={styles.centerOverlay} pointerEvents="none">
          <ActivityIndicator color="#fff" size="large" />
          <Text style={styles.overlayText}>
            {status === "loading" ? "Stil motoru hazırlanıyor…" : "Kamera açılıyor…"}
          </Text>
          {status === "loading" ? <Text style={styles.overlaySub}>İlk açılışta birkaç saniye sürebilir</Text> : null}
        </View>
      ) : null}

      {status === "error" ? (
        <View style={[styles.centerOverlay, styles.errorBox]}>
          <Ionicons name="alert-circle-outline" size={40} color="#fff" />
          <Text style={styles.overlayText}>
            {error === "camera" ? "Kameraya erişilemedi" : "Stil motoru yüklenemedi"}
          </Text>
          <Text style={styles.overlaySub}>
            {error === "camera"
              ? "Kamera başka bir uygulama tarafından kullanılıyor olabilir."
              : "İnternet bağlantınızı kontrol edip tekrar deneyin."}
          </Text>
          <TouchableOpacity style={styles.permButton} onPress={reload}>
            <Text style={styles.permButtonText}>Tekrar dene</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {scanning ? (
        <View style={styles.scanWrap} pointerEvents="none">
          <View style={[styles.oval, { width: width * 0.62, height: width * 0.62 * 1.32 }]} />
          <View style={styles.scanCard}>
            <Text style={styles.scanTitle}>
              {!facePresent
                ? "Yüzünüzü çerçeveye yerleştirin"
                : scan.frontal
                  ? "Yüz şekliniz ölçülüyor…"
                  : "Kameraya düz bakın"}
            </Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.round(scan.progress * 100)}%` }]} />
            </View>
            <Text style={styles.scanSub}>Saçınızı yüzünüzden çekin, iyi ışıkta durun</Text>
          </View>
        </View>
      ) : status === "ready" && !facePresent ? (
        <View style={styles.hintPill} pointerEvents="none">
          <Text style={styles.hintText}>Yüzünüz görünmüyor</Text>
        </View>
      ) : null}

      {/* Alt: kategori + kaydırmalı seçenekler */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 12 }]}>
        {category === "styles" ? (
          <StylesPanel
            shape={shape}
            gender={gender}
            setGender={setGender}
            onFindSalon={() => navigation.navigate("Home")}
          />
        ) : (
          <Carousel
            key={category}
            items={items}
            selected={selected}
            width={width}
            onChange={category === "hair" ? applyHair : applyMakeup}
            onCapture={capture}
            capturing={capturing}
          />
        )}
        <View style={styles.cats}>
          {CATEGORIES.map((c) => {
            const on = c.key === category;
            return (
              <TouchableOpacity
                key={c.key}
                onPress={() => setCategory(c.key)}
                style={[styles.cat, on && styles.catOn]}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
              >
                <Text style={[styles.catText, on && styles.catTextOn]}>{c.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={styles.privacy}>Görüntünüz telefonunuzda işlenir, hiçbir yere gönderilmez.</Text>
      </View>

      <Modal
        visible={shapeSheet && !!shape}
        transparent
        animationType="slide"
        onRequestClose={() => setShapeSheet(false)}
      >
        <TouchableOpacity style={styles.modalBg} activeOpacity={1} onPress={() => setShapeSheet(false)}>
          <TouchableOpacity activeOpacity={1} style={[styles.sheet, { paddingBottom: insets.bottom + 18 }]}>
            {shape ? (
              <>
                <Text style={styles.sheetKicker}>TAHMİNİ YÜZ ŞEKLİNİZ</Text>
                <Text style={styles.sheetTitle}>{FACE_SHAPES[shape].label}</Text>
                <Text style={styles.sheetText}>{FACE_SHAPES[shape].text}</Text>
                <Text style={styles.sheetLabel}>Farklı düşünüyorsanız seçin</Text>
                <View style={styles.shapeGrid}>
                  {Object.entries(FACE_SHAPES).map(([key, s]) => (
                    <TouchableOpacity
                      key={key}
                      onPress={() => setShape(key)}
                      style={[styles.shapeOption, key === shape && styles.shapeOptionOn]}
                    >
                      <Text style={[styles.shapeOptionText, key === shape && { color: colors.primary }]}>
                        {s.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.sheetActions}>
                  <TouchableOpacity style={styles.secondary} onPress={rescan}>
                    <Text style={styles.secondaryText}>Yeniden ölç</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.primary}
                    onPress={() => {
                      setShapeSheet(false);
                      setCategory("styles");
                    }}
                  >
                    <Text style={styles.primaryText}>Uygun modeller</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : null}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

/** Snapchat tarzı halka: ortadaki seçenek uygulanır, ortadaki halkaya dokununca fotoğraf çekilir. */
function Carousel({ items, selected, width, onChange, onCapture, capturing }) {
  const listRef = useRef(null);
  const side = (width - ITEM) / 2;
  const step = ITEM + GAP;
  const current = useRef(selected);

  useEffect(() => {
    listRef.current?.scrollToOffset({ offset: selected * step, animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const settle = (x) => {
    const i = Math.max(0, Math.min(items.length - 1, Math.round(x / step)));
    if (i !== current.current) {
      current.current = i;
      onChange(i);
    }
  };

  return (
    <View>
      <Text style={styles.itemLabel}>{items[selected]?.label}</Text>
      <View style={{ height: ITEM + 16, justifyContent: "center" }}>
        <FlatList
          ref={listRef}
          data={items}
          horizontal
          keyExtractor={(x) => x.key}
          showsHorizontalScrollIndicator={false}
          snapToInterval={step}
          decelerationRate="fast"
          contentContainerStyle={{ paddingHorizontal: side }}
          ItemSeparatorComponent={() => <View style={{ width: GAP }} />}
          getItemLayout={(_d, i) => ({ length: step, offset: step * i, index: i })}
          onScroll={(e) => settle(e.nativeEvent.contentOffset.x)}
          scrollEventThrottle={32}
          renderItem={({ item, index }) => (
            <TouchableOpacity
              onPress={() =>
                index === selected
                  ? onCapture()
                  : listRef.current?.scrollToOffset({ offset: index * step, animated: true })
              }
              style={[styles.item, index === selected && styles.itemOn]}
              accessibilityRole="button"
              accessibilityLabel={index === selected ? `${item.label}. Fotoğraf çek` : item.label}
            >
              {item.swatch ? (
                <View style={[styles.swatch, { backgroundColor: item.swatch }]} />
              ) : (
                <Ionicons name="ban-outline" size={24} color="#fff" />
              )}
            </TouchableOpacity>
          )}
        />
        {/* Ortadaki çekim halkası */}
        <View pointerEvents="none" style={[styles.ring, { left: (width - ITEM - 16) / 2 }]}>
          {capturing ? <ActivityIndicator color="#fff" /> : null}
        </View>
      </View>
      <Text style={styles.captureHint}>Kaydırarak dene · ortadakine dokununca fotoğraf çek</Text>
    </View>
  );
}

function StylesPanel({ shape, gender, setGender, onFindSalon }) {
  if (!shape) {
    return (
      <View style={styles.stylesEmpty}>
        <Text style={styles.stylesEmptyText}>Öneriler için önce yüz şekliniz belirlenmeli.</Text>
      </View>
    );
  }
  const list = HAIRSTYLES[shape][gender];
  return (
    <View>
      <View style={styles.genderRow}>
        <Text style={styles.stylesTitle}>{FACE_SHAPES[shape].label} yüze yakışan modeller</Text>
        <View style={styles.genderToggle}>
          {[
            ["women", "Kadın"],
            ["men", "Erkek"],
          ].map(([k, l]) => (
            <TouchableOpacity key={k} onPress={() => setGender(k)} style={[styles.gBtn, gender === k && styles.gBtnOn]}>
              <Text style={[styles.gText, gender === k && styles.gTextOn]}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 10, paddingHorizontal: 16 }}
      >
        {list.map(([name, why]) => (
          <View key={name} style={styles.styleCard}>
            <Ionicons name="cut-outline" size={18} color={colors.primary} />
            <Text style={styles.styleName}>{name}</Text>
            <Text style={styles.styleWhy}>{why}</Text>
            <TouchableOpacity onPress={onFindSalon} style={styles.styleBtn}>
              <Text style={styles.styleBtnText}>Salon bul</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
      <Text style={styles.captureHint}>
        Öneriler genel stil kurallarına dayanır; kesin karar için kuaförünüze danışın.
      </Text>
    </View>
  );
}

const glass = "rgba(0,0,0,0.38)";

const styles = StyleSheet.create({
  black: { flex: 1, backgroundColor: "#000" },
  centered: { alignItems: "center", justifyContent: "center" },
  web: { flex: 1, backgroundColor: "#000" },
  flash: { backgroundColor: "#fff" },
  top: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
  },
  round: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: glass,
    alignItems: "center",
    justifyContent: "center",
  },
  shapeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: glass,
  },
  shapeChipText: { color: "#fff", fontWeight: "700", fontSize: 13.5 },
  centerOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", padding: 32 },
  errorBox: { backgroundColor: "rgba(0,0,0,0.7)" },
  overlayText: { color: "#fff", fontSize: 17, fontWeight: "700", marginTop: 14, textAlign: "center" },
  overlaySub: { color: "rgba(255,255,255,0.75)", fontSize: 14, marginTop: 6, textAlign: "center" },
  scanWrap: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  oval: { borderRadius: 999, borderWidth: 3, borderColor: "rgba(255,255,255,0.85)", borderStyle: "dashed" },
  scanCard: {
    position: "absolute",
    top: "16%",
    alignItems: "center",
    backgroundColor: glass,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 16,
    width: "78%",
  },
  scanTitle: { color: "#fff", fontWeight: "700", fontSize: 15 },
  progressTrack: {
    height: 6,
    alignSelf: "stretch",
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.25)",
    marginTop: 10,
  },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: colors.primary },
  scanSub: { color: "rgba(255,255,255,0.75)", fontSize: 12.5, marginTop: 8 },
  hintPill: {
    position: "absolute",
    top: "40%",
    alignSelf: "center",
    backgroundColor: glass,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  hintText: { color: "#fff", fontWeight: "600" },
  bottom: { position: "absolute", left: 0, right: 0, bottom: 0, paddingTop: 12, backgroundColor: "rgba(0,0,0,0.28)" },
  itemLabel: { color: "#fff", textAlign: "center", fontWeight: "800", fontSize: 15, marginBottom: 6 },
  item: {
    width: ITEM,
    height: ITEM,
    borderRadius: ITEM / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.65)",
  },
  itemOn: { borderColor: "transparent" },
  swatch: { width: ITEM - 12, height: ITEM - 12, borderRadius: (ITEM - 12) / 2 },
  ring: {
    position: "absolute",
    top: 0,
    width: ITEM + 16,
    height: ITEM + 16,
    borderRadius: (ITEM + 16) / 2,
    borderWidth: 4,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  captureHint: { color: "rgba(255,255,255,0.7)", fontSize: 12, textAlign: "center", marginTop: 6 },
  cats: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 12 },
  cat: { paddingHorizontal: 14, height: 32, borderRadius: 16, justifyContent: "center" },
  catOn: { backgroundColor: "#fff" },
  catText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  catTextOn: { color: colors.text },
  privacy: { color: "rgba(255,255,255,0.55)", fontSize: 11, textAlign: "center", marginTop: 10 },
  stylesEmpty: { height: 120, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  stylesEmptyText: { color: "#fff", textAlign: "center", fontSize: 14 },
  genderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  stylesTitle: { color: "#fff", fontWeight: "800", fontSize: 15, flex: 1, marginRight: 8 },
  genderToggle: { flexDirection: "row", backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 14, padding: 3 },
  gBtn: { paddingHorizontal: 10, height: 26, borderRadius: 11, justifyContent: "center" },
  gBtnOn: { backgroundColor: "#fff" },
  gText: { color: "#fff", fontWeight: "700", fontSize: 12.5 },
  gTextOn: { color: colors.text },
  styleCard: { width: 170, backgroundColor: "#fff", borderRadius: 16, padding: 12 },
  styleName: { fontSize: 14.5, fontWeight: "800", color: colors.text, marginTop: 6 },
  styleWhy: { fontSize: 12.5, color: colors.muted, marginTop: 3, lineHeight: 17, minHeight: 34 },
  styleBtn: {
    marginTop: 8,
    backgroundColor: colors.primarySoft,
    borderRadius: 12,
    paddingVertical: 6,
    alignItems: "center",
  },
  styleBtnText: { color: colors.primary, fontWeight: "800", fontSize: 12.5 },
  permTitle: { color: "#fff", fontSize: 20, fontWeight: "800", marginTop: 14 },
  permText: { color: "rgba(255,255,255,0.8)", fontSize: 14.5, textAlign: "center", lineHeight: 21, marginTop: 8 },
  permButton: {
    marginTop: 22,
    backgroundColor: colors.primary,
    borderRadius: 24,
    paddingHorizontal: 26,
    height: 48,
    justifyContent: "center",
  },
  permButtonText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  permBack: { color: "rgba(255,255,255,0.8)", fontWeight: "600" },
  modalBg: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22 },
  sheetKicker: { fontSize: 11, fontWeight: "800", letterSpacing: 1.4, color: colors.primary },
  sheetTitle: { fontSize: 28, fontWeight: "800", color: colors.text, marginTop: 4, letterSpacing: -0.5 },
  sheetText: { fontSize: 15, color: colors.muted, lineHeight: 21, marginTop: 6 },
  sheetLabel: { fontSize: 13, fontWeight: "700", color: colors.text, marginTop: 18 },
  shapeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  shapeOption: {
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surface,
    justifyContent: "center",
  },
  shapeOptionOn: { backgroundColor: colors.primarySoft },
  shapeOptionText: { fontWeight: "700", color: colors.text },
  sheetActions: { flexDirection: "row", gap: 10, marginTop: 22 },
  secondary: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { fontWeight: "800", color: colors.text },
  primary: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { fontWeight: "800", color: "#fff" },
});
