import React, { useCallback, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  LayoutAnimation,
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
import BottomNav from "../components/BottomNav";
import ContactList, { contactItems } from "../components/ContactList";
import { Button } from "../components/ui";
import { useRemote } from "../components/useRemote";
import { colors, formatDate } from "../components/theme";

const TOPICS = [
  { id: "appointment", label: "Randevu" },
  { id: "order", label: "Sipariş ve iade" },
  { id: "payment", label: "Ödeme" },
  { id: "account", label: "Hesap" },
  { id: "technical", label: "Uygulama hatası" },
  { id: "other", label: "Diğer" },
];

const FAQ = [
  {
    q: "Randevumu nasıl iptal ederim?",
    a: "Randevular sekmesinde randevunuzun altındaki 'İptal et' düğmesini kullanın. Her salon kendi iptal süresini belirler; bu süre geçtiyse uygulamadan iptal edilemez, salonu aramanız gerekir.",
  },
  {
    q: "Randevu ücretini nasıl öderim?",
    a: "Randevu hizmet bedeli salonda ödenir. Uygulamadan ödeme yalnızca mağaza siparişleri ve cüzdan yüklemeleri içindir.",
  },
  {
    q: "Siparişimi iptal edebilir veya iade edebilir miyim?",
    a: "Satıcı siparişi hazırlamaya başlamadan önce Siparişlerim ekranından iptal edebilirsiniz; ödediğiniz tutar kartınıza veya cüzdanınıza iade edilir. Teslim aldığınız ürünler için 14 günlük cayma hakkınız vardır; talebinizi bu sayfadan iletin.",
  },
  {
    q: "Kart bilgilerim güvende mi?",
    a: "Kart bilgileriniz uygulamaya veya sunucularımıza hiç ulaşmaz. Ödeme, lisanslı ödeme kuruluşunun 3D Secure korumalı sayfasında yapılır.",
  },
  {
    q: "Salonları nasıl değerlendirebilirim?",
    a: "Randevunuz salon tarafından 'tamamlandı' olarak işaretlendikten sonra Profil → Değerlendirmelerim bölümünden puan ve yorum bırakabilirsiniz.",
  },
];

const STATUS = { OPEN: "Açık", ANSWERED: "Yanıtlandı", CLOSED: "Kapandı" };

export default function SupportScreen() {
  const [topic, setTopic] = useState(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);
  const loader = useCallback(() => supportApi.tickets().then((r) => r.items), []);
  const { data: tickets, reload } = useRemote(loader);

  const send = async () => {
    if (!topic) return Alert.alert("Konu seçin", "Talebinizin konusunu seçin.");
    if (message.trim().length < 10) return Alert.alert("Mesaj çok kısa", "Lütfen sorunu en az 10 karakterle anlatın.");
    setSending(true);
    try {
      await supportApi.createTicket({
        type: topic === "technical" ? "BUG" : "SUPPORT",
        subject: TOPICS.find((t) => t.id === topic).label,
        message: message.trim(),
      });
      setMessage("");
      setTopic(null);
      reload();
      Alert.alert("Talebiniz alındı", "Size hesabınızdaki e-posta adresinden dönüş yapacağız.");
    } catch (e) {
      Alert.alert("Gönderilemedi", e.message);
    } finally {
      setSending(false);
    }
  };

  const toggleFaq = (i) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenFaq((cur) => (cur === i ? null : i));
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Müşteri Hizmetleri" back />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.groupLabel}>BİZE YAZIN</Text>
          <View style={[styles.card, { padding: 16 }]}>
            <Text style={styles.fieldLabel}>Konu</Text>
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
            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Mesajınız</Text>
            <TextInput
              style={styles.input}
              value={message}
              onChangeText={setMessage}
              placeholder="Sipariş numarası veya randevu kodu varsa ekleyin"
              placeholderTextColor={colors.faint}
              multiline
              maxLength={5000}
              textAlignVertical="top"
              accessibilityLabel="Mesajınız"
            />
            <Button title="Gönder" onPress={send} loading={sending} style={{ marginTop: 14 }} />
          </View>

          {tickets?.length ? (
            <>
              <Text style={styles.groupLabel}>TALEPLERİM</Text>
              <View style={styles.card}>
                {tickets.slice(0, 5).map((t, i) => (
                  <View key={t.id} style={[styles.ticket, i > 0 && styles.border]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.ticketTitle}>{t.subject}</Text>
                      <Text style={styles.ticketMeta} numberOfLines={1}>
                        {formatDate(t.createdAt, true)} · {t.message}
                      </Text>
                    </View>
                    <Text style={[styles.ticketStatus, t.status === "ANSWERED" && { color: colors.success }]}>
                      {STATUS[t.status] ?? t.status}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          {contactItems().length ? (
            <>
              <Text style={styles.groupLabel}>İLETİŞİM</Text>
              <ContactList />
            </>
          ) : null}

          <Text style={styles.groupLabel}>SIK SORULAN SORULAR</Text>
          <View style={styles.card}>
            {FAQ.map((f, i) => (
              <View key={f.q} style={i > 0 && styles.border}>
                <TouchableOpacity
                  style={styles.faqRow}
                  onPress={() => toggleFaq(i)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: openFaq === i }}
                >
                  <Text style={styles.faqQ}>{f.q}</Text>
                  <Ionicons name={openFaq === i ? "chevron-up" : "chevron-down"} size={18} color={colors.faint} />
                </TouchableOpacity>
                {openFaq === i ? <Text style={styles.faqA}>{f.a}</Text> : null}
              </View>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <BottomNav active="Profile" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  scroll: { padding: 16, paddingBottom: 32 },
  groupLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.muted,
    letterSpacing: 0.8,
    marginTop: 16,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: { backgroundColor: colors.background, borderRadius: 14, overflow: "hidden" },
  border: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#DCDCE0" },
  fieldLabel: { fontSize: 14, fontWeight: "600", color: colors.text, marginBottom: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8 },
  chipOn: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  chipText: { fontSize: 14, color: colors.text },
  chipTextOn: { color: colors.primary, fontWeight: "600" },
  input: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  ticket: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  ticketTitle: { fontSize: 15, fontWeight: "600", color: colors.text },
  ticketMeta: { fontSize: 13, color: colors.muted, marginTop: 2 },
  ticketStatus: { fontSize: 12.5, fontWeight: "700", color: colors.muted },
  faqRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 15 },
  faqQ: { flex: 1, fontSize: 15.5, fontWeight: "500", color: colors.text },
  faqA: {
    fontSize: 14.5,
    color: colors.muted,
    lineHeight: 21,
    paddingHorizontal: 16,
    paddingBottom: 16,
    marginTop: -4,
  },
});
