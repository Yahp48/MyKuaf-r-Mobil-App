import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  Linking,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { WebView } from "react-native-webview";
import { LinearGradient } from "expo-linear-gradient";
import { useIsFocused } from "@react-navigation/native";
import { useCameraPermissions } from "expo-camera";
import { Asset } from "expo-asset";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BottomNavSpacer } from "../components/BottomNav";
import { colors } from "../components/theme";
import { TRYON_PAGE } from "../components/tryon/page";
import { FACE_SHAPES, HAIR_COLORS, HAIRSTYLES, MAKEUP_LOOKS } from "../components/tryon/catalog";
import { tryonApi } from "../services/api";
import { toast } from "../components/Feedback";

const ITEM = 62;
const GAP = 14;
const CATEGORIES = [
  { key: "styles", label: "Saç modeli" },
  { key: "hair", label: "Saç rengi" },
  { key: "makeup", label: "Makyaj" },
];
const NO_STYLE = { key: "none", label: "Kendi saçım", length: null, suits: [] };

/**
 * Canlı deneme (alt menüde "Dene"): ön kamerada saç modeli, saç rengi ve makyaj denemesi; önce yüz şekli ölçülür,
 * yüz şekline uygun modeller öne alınır. Her şey cihazda işlenir, görüntü hiçbir yere gönderilmez.
 */
export default function TryOnScreen({ navigation }) {
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [permission, requestPermission] = useCameraPermissions();
  const webRef = useRef(null);
  const styleData = useRef({});
  const [status, setStatus] = useState("idle"); // camera | loading | ready | error
  const [error, setError] = useState(null);
  const [facePresent, setFacePresent] = useState(true);
  const [scan, setScan] = useState({ progress: 0, frontal: true, done: false });
  const [shape, setShape] = useState(null);
  const [shapeSheet, setShapeSheet] = useState(false);
  const [category, setCategory] = useState("styles");
  const [styleKey, setStyleKey] = useState("none");
  const [hairIndex, setHairIndex] = useState(0);
  const [makeupIndex, setMakeupIndex] = useState(0);
  const [styleLoading, setStyleLoading] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [panelHeight, setPanelHeight] = useState(220);
  const flash = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) requestPermission();
  }, [permission, requestPermission]);

  // Sekmeden çıkınca kamera kapanır (WebView kaldırılır); dönünce seçimler yeniden uygulanır.
  useEffect(() => {
    if (!isFocused) {
      setStatus("idle");
      setScan((s) => (s.done ? s : { progress: 0, frontal: true, done: false }));
    }
  }, [isFocused]);

  const send = useCallback((cmd) => {
    webRef.current?.injectJavaScript(`window.__tryon && window.__tryon.set(${JSON.stringify(cmd)}); true;`);
  }, []);

  // Yüz şekline uygun modeller önce
  // Yapay zekâ ile gerçekçi deneme: sunucuda anahtar tanımlıysa görünür
  const [ai, setAi] = useState(null);
  const [grabbing, setGrabbing] = useState(false);
  useEffect(() => {
    if (!isFocused) return;
    tryonApi
      .config()
      .then(setAi)
      .catch(() => setAi(null));
  }, [isFocused]);

  const openAi = () => {
    if (status !== "ready" || grabbing) return;
    setGrabbing(true);
    send({ captureRaw: true });
  };
  const onRawPhoto = async (base64) => {
    try {
      const file = new File(Paths.cache, `bibakim-ai-${Date.now()}.jpg`);
      await file.write(base64, { encoding: "base64" });
      navigation.navigate("AiTryOn", { photoUri: file.uri, shape });
    } catch (e) {
      toast.error("Fotoğraf alınamadı", e.message);
    } finally {
      setGrabbing(false);
    }
  };

  const styles_ = useMemo(() => {
    const list = [...HAIRSTYLES].sort((a, b) => Number(b.suits.includes(shape)) - Number(a.suits.includes(shape)));
    return [NO_STYLE, ...list];
  }, [shape]);

  const loadStyle = async (s) => {
    if (styleData.current[s.key]) return styleData.current[s.key];
    const asset = Asset.fromModule(s.image);
    await asset.downloadAsync();
    const base64 = await new File(asset.localUri ?? asset.uri).base64();
    const payload = { key: s.key, src: `data:image/webp;base64,${base64}`, anchors: s.anchors };
    styleData.current[s.key] = payload;
    return payload;
  };

  const applyStyle = async (i) => {
    const s = styles_[i];
    setStyleKey(s.key);
    if (s.key === "none") return send({ style: null });
    try {
      setStyleLoading(true);
      send({ style: await loadStyle(s) });
    } catch (e) {
      toast.error("Model yüklenemedi", e.message);
    } finally {
      setStyleLoading(false);
    }
  };

  const hairCommand = (i) => {
    const c = HAIR_COLORS[i];
    return c.color ? { color: c.color, alpha: c.alpha, lift: c.lift ?? 0, dark: c.dark ?? 0 } : null;
  };
  const makeupCommand = (i) => {
    const { key, label, swatch, ...look } = MAKEUP_LOOKS[i];
    return key === "none" ? null : look;
  };
  const applyHair = (i) => {
    setHairIndex(i);
    send({ hair: hairCommand(i) });
  };
  const applyMakeup = (i) => {
    setMakeupIndex(i);
    send({ makeup: makeupCommand(i) });
  };

  const sendViewport = useCallback(
    () => send({ viewport: { top: insets.top + 60, bottom: panelHeight } }),
    [send, insets.top, panelHeight],
  );
  useEffect(() => {
    if (status === "ready") sendViewport();
  }, [status, sendViewport]);

  /** Sayfa yeniden açıldığında (sekmeye dönüş) seçimleri geri uygular. */
  const restore = async () => {
    sendViewport();
    send({ hair: hairCommand(hairIndex), makeup: makeupCommand(makeupIndex), ...(scan.done ? {} : { scan: true }) });
    if (scan.done) send({ scanDone: true });
    const s = HAIRSTYLES.find((x) => x.key === styleKey);
    if (s) send({ style: await loadStyle(s) });
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
      const file = new File(Paths.cache, `bibakim-stil-${Date.now()}.jpg`);
      await file.write(base64, { encoding: "base64" });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: "image/jpeg", dialogTitle: "Stilini paylaş" });
      } else {
        toast.error("Paylaşım kullanılamıyor", "Bu cihazda paylaşım desteklenmiyor.");
      }
    } catch (e) {
      toast.error("Fotoğraf kaydedilemedi", e.message);
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
        if (msg.status === "ready") restore();
        break;
      case "error":
        if (msg.code === "capture") {
          setCapturing(false);
          toast.error("Fotoğraf alınamadı", "Lütfen tekrar deneyin.");
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
      case "rawPhoto":
        onRawPhoto(msg.data);
        break;
      default:
    }
  };

  const reload = () => {
    setError(null);
    setStatus("idle");
    webRef.current?.reload();
  };

  if (!permission) return <View style={styles.black} />;
  if (!permission.granted) {
    return (
      <View style={styles.black}>
        <StatusBar style="light" />
        <View style={[styles.centered, { flex: 1, padding: 32 }]}>
          <Ionicons name="camera-outline" size={44} color="#fff" />
          <Text style={styles.permTitle}>Kamera izni gerekli</Text>
          <Text style={styles.permText}>
            Saç modeli, saç rengi ve makyajı canlı denemek için ön kamerayı kullanırız. Görüntünüz yalnızca
            telefonunuzda işlenir, kaydedilmez ve hiçbir yere gönderilmez.
          </Text>
          <TouchableOpacity
            style={styles.permButton}
            onPress={() => (permission.canAskAgain ? requestPermission() : Linking.openSettings())}
          >
            <Text style={styles.permButtonText}>{permission.canAskAgain ? "İzin ver" : "Ayarları aç"}</Text>
          </TouchableOpacity>
        </View>
        <BottomNavSpacer />
      </View>
    );
  }

  const scanning = status === "ready" && !scan.done;
  const carousel =
    category === "styles"
      ? {
          items: styles_,
          selected: Math.max(
            0,
            styles_.findIndex((s) => s.key === styleKey),
          ),
          onChange: applyStyle,
        }
      : category === "hair"
        ? { items: HAIR_COLORS, selected: hairIndex, onChange: applyHair }
        : { items: MAKEUP_LOOKS, selected: makeupIndex, onChange: applyMakeup };
  const current = carousel.items[carousel.selected];
  const fits = category === "styles" && shape && current?.suits?.includes(shape);

  return (
    <View style={styles.black}>
      <StatusBar style="light" />
      <View style={{ flex: 1 }}>
        {isFocused ? (
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
        ) : null}
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.flash, { opacity: flash }]} />

        <LinearGradient
          pointerEvents="none"
          colors={["rgba(0,0,0,0.35)", "transparent"]}
          style={[styles.shadeTop, { height: insets.top + 90 }]}
        />
        {/* Üst çubuk */}
        <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
          <Text style={styles.screenTitle}>Stilini dene</Text>
          <TouchableOpacity
            style={styles.shapeChip}
            onPress={() => (shape ? setShapeSheet(true) : null)}
            disabled={!shape}
            accessibilityRole="button"
            accessibilityLabel={shape ? `Yüz şekli ${FACE_SHAPES[shape].label}. Ayrıntılar` : "Yüz şekli belirleniyor"}
          >
            <Ionicons name="happy-outline" size={16} color="#fff" />
            <Text style={styles.shapeChipText}>{shape ? FACE_SHAPES[shape].label : "Ölçülüyor"}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={rescan} style={styles.round} accessibilityLabel="Yüz şeklini yeniden ölç">
            <Ionicons name="scan-outline" size={21} color="#fff" />
          </TouchableOpacity>
        </View>

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
          <View style={[styles.scanCard, { top: insets.top + 64 }]} pointerEvents="none">
            <Text style={styles.scanTitle}>
              {!facePresent
                ? "Yüzünüzü ekrana ortalayın"
                : scan.frontal
                  ? "Yüz şekliniz ölçülüyor…"
                  : "Kameraya düz bakın"}
            </Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.round(scan.progress * 100)}%` }]} />
            </View>
          </View>
        ) : status === "ready" && !facePresent ? (
          <View style={styles.hintPill} pointerEvents="none">
            <Text style={styles.hintText}>Yüzünüz görünmüyor</Text>
          </View>
        ) : null}

        {/* Okunabilirlik için hafif gölge geçişi (görüntü tam ekran kalır) */}
        <LinearGradient
          pointerEvents="none"
          colors={["transparent", "rgba(0,0,0,0.45)"]}
          style={[styles.shadeBottom, { height: panelHeight + 40 }]}
        />
        {/* Alt panel: kaydırmalı seçenekler + kategoriler */}
        <View style={styles.bottom} onLayout={(e) => setPanelHeight(Math.round(e.nativeEvent.layout.height))}>
          {category === "styles" && ai?.enabled ? (
            <TouchableOpacity
              style={styles.aiBtn}
              onPress={openAi}
              disabled={grabbing || status !== "ready"}
              accessibilityRole="button"
            >
              {grabbing ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name="sparkles" size={15} color="#fff" />
              )}
              <Text style={styles.aiText}>Yapay zekâ ile gerçekçi dene · {ai.remaining} hak</Text>
            </TouchableOpacity>
          ) : null}
          <View style={styles.labelRow}>
            <Text style={styles.itemLabel}>{current?.label}</Text>
            {category === "styles" && current?.length ? <Text style={styles.itemMeta}>{current.length}</Text> : null}
            {fits ? (
              <View style={styles.fitBadge}>
                <Ionicons name="checkmark" size={12} color="#fff" />
                <Text style={styles.fitText}>Yüzünüze uygun</Text>
              </View>
            ) : null}
            {styleLoading ? <ActivityIndicator color="#fff" size="small" /> : null}
          </View>
          <Carousel
            key={category === "styles" ? `styles-${shape}` : category}
            items={carousel.items}
            selected={carousel.selected}
            width={width}
            shape={shape}
            onChange={carousel.onChange}
            onCapture={capture}
            capturing={capturing}
          />
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
        </View>
      </View>

      <BottomNavSpacer />

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
                    <Text style={styles.primaryText}>Modelleri dene</Text>
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
function Carousel({ items, selected, width, shape, onChange, onCapture, capturing }) {
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
        onMomentumScrollEnd={(e) => settle(e.nativeEvent.contentOffset.x)}
        scrollEventThrottle={32}
        renderItem={({ item, index }) => (
          <TouchableOpacity
            onPress={() =>
              index === selected
                ? onCapture()
                : listRef.current?.scrollToOffset({ offset: index * step, animated: true })
            }
            style={[styles.item, item.image && styles.itemImage, index === selected && styles.itemOn]}
            accessibilityRole="button"
            accessibilityLabel={index === selected ? `${item.label}. Fotoğraf çek` : item.label}
          >
            {item.image ? (
              <Image source={item.image} style={styles.hairThumb} resizeMode="contain" />
            ) : item.swatch ? (
              <View style={[styles.swatch, { backgroundColor: item.swatch }]} />
            ) : (
              <Ionicons name="ban-outline" size={24} color="#fff" />
            )}
            {shape && item.suits?.includes(shape) ? <View style={styles.fitDot} /> : null}
          </TouchableOpacity>
        )}
      />
      <View pointerEvents="none" style={[styles.ring, { left: (width - ITEM - 16) / 2 }]}>
        {capturing ? <ActivityIndicator color="#fff" /> : null}
      </View>
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
    gap: 8,
    paddingHorizontal: 16,
  },
  screenTitle: { flex: 1, color: "#fff", fontSize: 20, fontWeight: "800", letterSpacing: -0.3 },
  round: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: glass,
    alignItems: "center",
    justifyContent: "center",
  },
  shapeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: glass,
  },
  shapeChipText: { color: "#fff", fontWeight: "700", fontSize: 13.5 },
  centerOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", padding: 32 },
  errorBox: { backgroundColor: "rgba(0,0,0,0.7)" },
  overlayText: { color: "#fff", fontSize: 17, fontWeight: "700", marginTop: 14, textAlign: "center" },
  overlaySub: { color: "rgba(255,255,255,0.75)", fontSize: 14, marginTop: 6, textAlign: "center" },
  scanCard: {
    position: "absolute",
    alignSelf: "center",
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
  bottom: { position: "absolute", left: 0, right: 0, bottom: 0, paddingTop: 10, paddingBottom: 12 },
  shadeTop: { position: "absolute", top: 0, left: 0, right: 0 },
  aiBtn: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: 18,
    paddingHorizontal: 14,
    height: 36,
    marginBottom: 10,
  },
  aiText: { color: "#fff", fontWeight: "800", fontSize: 13.5 },
  shadeBottom: { position: "absolute", bottom: 0, left: 0, right: 0 },
  labelRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 6 },
  itemLabel: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 15,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowRadius: 4,
  },
  itemMeta: { color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: "600" },
  fitBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  fitText: { color: "#fff", fontSize: 11.5, fontWeight: "800" },
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
  itemImage: { backgroundColor: "#F3E9EC", overflow: "hidden" },
  itemOn: { borderColor: "transparent" },
  hairThumb: { width: ITEM - 8, height: ITEM - 8 },
  fitDot: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: "#fff",
  },
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
  cats: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 10 },
  cat: { paddingHorizontal: 14, height: 32, borderRadius: 16, justifyContent: "center", backgroundColor: glass },
  catOn: { backgroundColor: "#fff" },
  catText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  catTextOn: { color: colors.text },
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
