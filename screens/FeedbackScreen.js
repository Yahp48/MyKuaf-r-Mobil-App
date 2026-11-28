import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supportApi } from "../services/api";
import AppHeader from "../components/AppHeader";
import { BottomNavSpacer } from "../components/BottomNav";
import { Button } from "../components/ui";
import { colors } from "../components/theme";
import { toast } from "../components/Feedback";

const TOPICS = [
  { id: "design", label: "Tasarım ve kullanım" },
  { id: "performance", label: "Hız ve performans" },
  { id: "booking", label: "Randevu alma" },
  { id: "shop", label: "Mağaza ve ödeme" },
  { id: "idea", label: "Yeni özellik önerisi" },
  { id: "other", label: "Diğer" },
];
const RATING_LABEL = ["", "Çok kötü", "Kötü", "Orta", "İyi", "Mükemmel"];

export default function FeedbackScreen({ navigation }) {
  const [rating, setRating] = useState(0);
  const [topic, setTopic] = useState(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!rating) return toast.error("Puan verin", "Uygulamayı 1 ile 5 arasında puanlayın.");
    if (!topic) return toast.error("Konu seçin", "Geri bildiriminizin konusunu seçin.");
    if (message.trim().length < 10) return toast.error("Mesaj çok kısa", "Lütfen en az 10 karakter yazın.");
    setSending(true);
    try {
      await supportApi.createTicket({
        type: "FEEDBACK",
        subject: TOPICS.find((t) => t.id === topic).label,
        message: message.trim(),
        rating,
      });
      navigation.goBack();
      toast.success("Teşekkürler", "Geri bildiriminiz bize ulaştı.");
    } catch (e) {
      toast.error("Gönderilemedi", e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Geri Bildirim" back />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={[styles.card, { alignItems: "center", paddingVertical: 22 }]}>
            <Text style={styles.question}>Bakımca'yı nasıl buldunuz?</Text>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map((n) => (
                <TouchableOpacity
                  key={n}
                  onPress={() => setRating(n)}
                  accessibilityRole="button"
                  accessibilityLabel={`${n} yıldız`}
                  accessibilityState={{ selected: rating === n }}
                  hitSlop={6}
                >
                  <Ionicons
                    name={n <= rating ? "star" : "star-outline"}
                    size={36}
                    color={n <= rating ? "#F5A623" : "#C7C7CC"}
                  />
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.ratingLabel}>{rating ? RATING_LABEL[rating] : " "}</Text>
          </View>

          <Text style={styles.groupLabel}>KONU</Text>
          <View style={styles.chips}>
            {TOPICS.map((t) => {
              const on = topic === t.id;
              return (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.chip, on && styles.chipOn]}
                  onPress={() => setTopic(t.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.groupLabel}>DÜŞÜNCELERİNİZ</Text>
          <TextInput
            style={styles.input}
            value={message}
            onChangeText={setMessage}
            placeholder="Neyi beğendiniz, neyi geliştirmemizi istersiniz?"
            placeholderTextColor={colors.faint}
            multiline
            maxLength={5000}
            textAlignVertical="top"
            accessibilityLabel="Düşünceleriniz"
          />
          <Text style={styles.note}>
            Geri bildiriminiz hesabınızla birlikte iletilir; gerekirse kayıtlı e-posta adresinizden dönüş yaparız.
          </Text>
          <Button title="Gönder" onPress={send} loading={sending} style={{ marginTop: 16 }} />
        </ScrollView>
      </KeyboardAvoidingView>
      <BottomNavSpacer />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  scroll: { padding: 16, paddingBottom: 32 },
  card: { backgroundColor: colors.background, borderRadius: 14 },
  question: { fontSize: 17, fontWeight: "600", color: colors.text },
  stars: { flexDirection: "row", gap: 10, marginTop: 14 },
  ratingLabel: { marginTop: 10, fontSize: 14, color: colors.muted, fontWeight: "500" },
  groupLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.muted,
    letterSpacing: 0.8,
    marginTop: 20,
    marginBottom: 8,
    marginLeft: 4,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  chipOn: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  chipText: { fontSize: 14, color: colors.text },
  chipTextOn: { color: colors.primary, fontWeight: "600" },
  input: {
    minHeight: 140,
    backgroundColor: colors.background,
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    color: colors.text,
  },
  note: { fontSize: 13, color: colors.muted, marginTop: 10, lineHeight: 18, marginHorizontal: 4 },
});
