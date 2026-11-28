import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Ionicons } from "@expo/vector-icons";
import AppHeader from "../components/AppHeader";
import { Button, Checkbox } from "../components/ui";
import { colors } from "../components/theme";
import { FACE_SHAPES } from "../components/tryon/catalog";
import { tryonApi } from "../services/api";
import { toast } from "../components/Feedback";

const MAX_WAIT_MS = 3 * 60_000;

/**
 * Yapay zekâ ile gerçekçi saç modeli denemesi: fotoğraf hizmet sağlayıcısına gönderilir, aynı kişi seçilen
 * modelle oluşturulur. Fotoğraf göndermeden önce açık rıza alınır (KVKK — yurt dışına aktarım).
 */
export default function AiTryOnScreen({ navigation, route }) {
  const { photoUri, shape } = route.params;
  const { width } = useWindowDimensions();
  const [config, setConfig] = useState(null);
  const [style, setStyle] = useState(null);
  const [color, setColor] = useState("brown");
  const [consent, setConsent] = useState(false);
  const [phase, setPhase] = useState("form"); // form | working | done
  const [images, setImages] = useState([]);
  const cancelled = useRef(false);

  useEffect(() => {
    tryonApi
      .config()
      .then((c) => {
        setConfig(c);
        setStyle(c.styles?.[0]?.key ?? null);
      })
      .catch((e) => toast.error("Kullanılamıyor", e.message));
    return () => {
      cancelled.current = true;
    };
  }, []);

  const poll = useCallback(async (token, startedAt) => {
    while (!cancelled.current && Date.now() - startedAt < MAX_WAIT_MS) {
      await new Promise((r) => setTimeout(r, 5000));
      try {
        const r = await tryonApi.poll(token);
        if (r.status === "done") return r.images;
        if (r.status === "failed")
          throw new Error("Fotoğraf işlenemedi. Yüzünüzün önden ve net göründüğü bir kare deneyin.");
      } catch (e) {
        if (e.message?.startsWith("Fotoğraf")) throw e;
      }
    }
    throw new Error("Sonuç zamanında hazırlanamadı. Lütfen tekrar deneyin.");
  }, []);

  const generate = async () => {
    if (!consent) return toast.error("Onay gerekli", "Fotoğrafınızın işlenmesine onay vermelisiniz.");
    setPhase("working");
    try {
      const { token } = await tryonApi.create(photoUri, style, color);
      const result = await poll(token, Date.now());
      setImages(result);
      setPhase("done");
      tryonApi
        .config()
        .then(setConfig)
        .catch(() => {});
    } catch (e) {
      setPhase("form");
      if (!cancelled.current) toast.error("Oluşturulamadı", e.message);
    }
  };

  const share = async (url) => {
    try {
      const dir = new Directory(Paths.cache, "ai-tryon");
      if (!dir.exists) dir.create();
      const file = await File.downloadFileAsync(url, new File(dir, `stil-${Date.now()}.jpg`), { idempotent: true });
      await Sharing.shareAsync(file.uri, { mimeType: "image/jpeg", dialogTitle: "Yeni stilini paylaş" });
    } catch (e) {
      toast.error("Paylaşılamadı", e.message);
    }
  };

  const shapeLabel = shape ? FACE_SHAPES[shape]?.label : null;

  return (
    <View style={styles.container}>
      <AppHeader title="Gerçekçi deneme" back />
      {phase === "done" ? (
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
          <FlatList
            horizontal
            pagingEnabled
            data={images}
            keyExtractor={(u) => u}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <View style={{ width }}>
                <Image source={{ uri: item }} style={{ width, height: width * 1.25 }} resizeMode="cover" />
                <TouchableOpacity style={styles.shareBtn} onPress={() => share(item)} accessibilityRole="button">
                  <Ionicons name="share-social-outline" size={18} color="#fff" />
                  <Text style={styles.shareText}>Paylaş / kaydet</Text>
                </TouchableOpacity>
              </View>
            )}
          />
          {images.length > 1 ? <Text style={styles.hint}>Kaydırarak {images.length} sonucu görün.</Text> : null}
          <View style={styles.pad}>
            <Text style={styles.note}>
              Sonuç görselleri yapay zekâ ile oluşturulmuştur ve gerçek kesimden farklı olabilir. Görseller hizmet
              sağlayıcıda 24 saat sonra silinir; kaydetmek isterseniz paylaşın.
            </Text>
            <Button title="Başka model dene" variant="outline" onPress={() => setPhase("form")} />
            <Button
              title="Salon bul ve randevu al"
              onPress={() => navigation.navigate("Home")}
              style={{ marginTop: 10 }}
            />
          </View>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.pad}>
          <View style={styles.photoRow}>
            <Image source={{ uri: photoUri }} style={styles.photo} />
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Fotoğrafınız hazır</Text>
              <Text style={styles.text}>
                Seçtiğiniz modeli yüzünüze yapay zekâ ile uygular; ışık ve saç dokusu gerçekçi görünür.
                {shapeLabel ? ` Yüz şekliniz: ${shapeLabel}.` : ""}
              </Text>
              {config?.enabled ? <Text style={styles.remaining}>Bugün kalan hak: {config.remaining}</Text> : null}
            </View>
          </View>

          <Text style={styles.section}>Saç modeli</Text>
          <View style={styles.wrap}>
            {config?.styles?.map((s) => (
              <Chip key={s.key} label={s.label} on={style === s.key} onPress={() => setStyle(s.key)} />
            ))}
          </View>
          <Text style={styles.section}>Renk</Text>
          <View style={styles.wrap}>
            {config?.colors?.map((c) => (
              <Chip key={c.key} label={c.label} on={color === c.key} onPress={() => setColor(c.key)} />
            ))}
          </View>

          <View style={styles.consent}>
            <Checkbox checked={consent} onChange={setConsent}>
              <Text style={styles.consentText}>
                Fotoğrafımın yalnızca bu deneme için yurt dışındaki hizmet sağlayıcıya (
                {config?.provider ?? "yapay zekâ"}) gönderilip işlenmesine açık rıza veriyorum. Fotoğraf saklanmaz;
                sonuçlar 24 saat sonra silinir.
              </Text>
            </Checkbox>
            <Text style={styles.link} onPress={() => navigation.navigate("Privacy")}>
              KVKK aydınlatma metni
            </Text>
          </View>

          {phase === "working" ? (
            <View style={styles.working}>
              <ActivityIndicator color={colors.primary} size="large" />
              <Text style={styles.workingText}>Yeni stiliniz hazırlanıyor… (genellikle 15–60 saniye)</Text>
            </View>
          ) : (
            <Button
              title={config?.remaining === 0 ? "Bugünkü hakkınız doldu" : "Oluştur"}
              onPress={generate}
              disabled={!config?.enabled || !style || !consent || config?.remaining === 0}
            />
          )}
        </ScrollView>
      )}
    </View>
  );
}

function Chip({ label, on, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.chip, on && styles.chipOn]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
    >
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  pad: { padding: 16 },
  photoRow: { flexDirection: "row", gap: 14, alignItems: "center" },
  photo: { width: 96, height: 128, borderRadius: 14, backgroundColor: colors.surface },
  title: { fontSize: 17, fontWeight: "800", color: colors.text },
  text: { fontSize: 13.5, color: colors.muted, marginTop: 4, lineHeight: 19 },
  remaining: { fontSize: 13, fontWeight: "700", color: colors.primary, marginTop: 6 },
  section: { fontSize: 15, fontWeight: "800", color: colors.text, marginTop: 22, marginBottom: 10 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 13,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    justifyContent: "center",
  },
  chipOn: { backgroundColor: colors.primary },
  chipText: { fontSize: 13.5, fontWeight: "600", color: colors.text },
  chipTextOn: { color: "#fff" },
  consent: { marginTop: 22, marginBottom: 16, padding: 12, borderRadius: 14, backgroundColor: colors.surface },
  consentText: { fontSize: 13, color: colors.text, lineHeight: 18 },
  link: { color: colors.primary, fontWeight: "700", fontSize: 13, marginTop: 6, marginLeft: 32 },
  working: { alignItems: "center", paddingVertical: 20, gap: 10 },
  workingText: { color: colors.muted, fontSize: 14, textAlign: "center" },
  shareBtn: {
    position: "absolute",
    right: 14,
    bottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 18,
    paddingHorizontal: 12,
    height: 36,
  },
  shareText: { color: "#fff", fontWeight: "700" },
  hint: { textAlign: "center", color: colors.muted, fontSize: 12.5, marginTop: 8 },
  note: { fontSize: 12.5, color: colors.muted, lineHeight: 18, marginBottom: 14 },
});
