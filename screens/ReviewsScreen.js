import React, { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { FontAwesome } from "@expo/vector-icons";
import { appointmentApi, salonApi } from "../services/api";
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

  const openReview = (a) => {
    setTarget(a);
    setRating(5);
    setComment("");
  };

  const submit = async () => {
    setSaving(true);
    try {
      await salonApi.addReview(target.salon.id, {
        appointmentId: target.id,
        rating,
        ...(comment.trim() ? { comment: comment.trim() } : {}),
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
            <Button title="Gönder" onPress={submit} loading={saving} />
            <Button title="Vazgeç" variant="outline" onPress={() => setTarget(null)} style={{ marginTop: 10 }} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
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
