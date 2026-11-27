import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { FontAwesome, Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { appointmentApi, salonApi, userApi } from "../services/api";
import AppHeader from "../components/AppHeader";
import { Button, EmptyState } from "../components/ui";
import { useRemote } from "../components/useRemote";
import { colors, formatDate } from "../components/theme";
import { LoadError, ListSkeleton } from "../components/Skeleton";

/** Tamamlanan randevular: değerlendirilmemiş olanlar için puan ve yorum verilir. */
export default function ReviewsScreen() {
  const loader = useCallback(async () => {
    const res = await appointmentApi.list("past");
    return res.items.filter((a) => a.status === "COMPLETED");
  }, []);
  const { data, setData, error, loading, refreshing, reload, refresh } = useRemote(loader);
  const [target, setTarget] = useState(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  // { uri, url | null (yükleniyor) }
  const [photos, setPhotos] = useState([]);

  const openReview = (a) => {
    setTarget(a);
    setRating(5);
    setComment("");
    setPhotos([]);
  };

  const pickPhotos = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: 4 - photos.length,
      quality: 0.8,
    });
    if (res.canceled) return;
    const picked = res.assets.slice(0, 4 - photos.length).map((a) => ({ uri: a.uri, url: null }));
    setPhotos((p) => [...p, ...picked]);
    for (const item of picked) {
      try {
        const { url } = await userApi.uploadPhoto(item.uri);
        setPhotos((p) => p.map((x) => (x.uri === item.uri ? { ...x, url } : x)));
      } catch (e) {
        setPhotos((p) => p.filter((x) => x.uri !== item.uri));
        Alert.alert("Fotoğraf yüklenemedi", e.message);
      }
    }
  };
  const uploading = photos.some((p) => !p.url);

  const submit = async () => {
    setSaving(true);
    try {
      await salonApi.addReview(target.salon.id, {
        appointmentId: target.id,
        rating,
        ...(comment.trim() ? { comment: comment.trim() } : {}),
        photos: photos.map((p) => p.url).filter(Boolean),
      });
      setData((list) => list.map((a) => (a.id === target.id ? { ...a, canReview: false } : a)));
      setTarget(null);
      Alert.alert("Teşekkürler", "Değerlendirmeniz yayınlandı.");
    } catch (e) {
      Alert.alert("Gönderilemedi", e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Değerlendirmelerim" back />
      {loading && !data ? (
        <ListSkeleton />
      ) : error && !data ? (
        <LoadError message={error} onRetry={reload} skeleton={<ListSkeleton />} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(a) => a.id}
          contentContainerStyle={{ padding: 16, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
          renderItem={({ item: a }) => (
            <View style={styles.card}>
              <Text style={styles.salon}>{a.salon.name}</Text>
              <Text style={styles.meta}>
                {formatDate(`${a.date}T12:00:00`)} · {a.services.map((s) => s.name).join(", ")}
              </Text>
              {a.canReview ? (
                <Button title="Değerlendir" variant="outline" onPress={() => openReview(a)} style={styles.btn} />
              ) : (
                <Text style={styles.done}>✓ Değerlendirildi</Text>
              )}
            </View>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="rate-review"
              title="Değerlendirilecek randevu yok"
              message="Tamamlanan randevularınızı burada puanlayabilirsiniz."
            />
          }
        />
      )}

      <Modal visible={!!target} transparent animationType="slide" onRequestClose={() => setTarget(null)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{target?.salon.name}</Text>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map((n) => (
                <TouchableOpacity key={n} onPress={() => setRating(n)} accessibilityLabel={`${n} yıldız`} hitSlop={6}>
                  <FontAwesome name={n <= rating ? "star" : "star-o"} size={34} color="#f5a623" />
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.input}
              value={comment}
              onChangeText={setComment}
              placeholder="Deneyiminizi anlatın (isteğe bağlı)"
              placeholderTextColor="#aaa"
              multiline
              maxLength={1000}
            />
            <View style={styles.photoRow}>
              {photos.map((p) => (
                <View key={p.uri} style={styles.photoBox}>
                  <Image source={{ uri: p.uri }} style={styles.photo} />
                  {!p.url ? (
                    <View style={styles.photoBusy}>
                      <ActivityIndicator color="#fff" />
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.photoRemove}
                      onPress={() => setPhotos((list) => list.filter((x) => x.uri !== p.uri))}
                      accessibilityLabel="Fotoğrafı kaldır"
                    >
                      <Ionicons name="close" size={14} color="#fff" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              {photos.length < 4 ? (
                <TouchableOpacity
                  style={[styles.photoBox, styles.photoAdd]}
                  onPress={pickPhotos}
                  accessibilityRole="button"
                >
                  <Ionicons name="camera-outline" size={22} color={colors.primary} />
                  <Text style={styles.photoAddText}>Fotoğraf</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <Text style={styles.photoHint}>Önce/sonra fotoğrafı ekleyebilirsiniz (en fazla 4).</Text>
            <Button
              title={uploading ? "Fotoğraflar yükleniyor…" : "Gönder"}
              onPress={submit}
              loading={saving}
              disabled={uploading}
            />
            <Button title="Vazgeç" variant="outline" onPress={() => setTarget(null)} style={{ marginTop: 10 }} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  photoRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 6 },
  photoBox: { width: 68, height: 68, borderRadius: 12, overflow: "hidden" },
  photo: { width: "100%", height: "100%" },
  photoBusy: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  photoRemove: {
    position: "absolute",
    top: 3,
    right: 3,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  photoAdd: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
  },
  photoAddText: { fontSize: 11, color: colors.primary, fontWeight: "700", marginTop: 2 },
  photoHint: { fontSize: 12, color: colors.muted, marginBottom: 12 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  salon: { fontSize: 16, fontWeight: "bold", color: colors.text },
  meta: { fontSize: 13, color: colors.muted, marginTop: 4 },
  btn: { marginTop: 12, minHeight: 40, paddingVertical: 8 },
  done: { color: colors.success, marginTop: 10, fontWeight: "600" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36 },
  sheetTitle: { fontSize: 18, fontWeight: "bold", textAlign: "center", color: colors.text },
  stars: { flexDirection: "row", justifyContent: "center", gap: 10, marginVertical: 18 },
  input: {
    borderWidth: 1,
    borderColor: "#e3e3e8",
    borderRadius: 10,
    padding: 12,
    minHeight: 90,
    textAlignVertical: "top",
    marginBottom: 14,
    color: colors.text,
  },
});
