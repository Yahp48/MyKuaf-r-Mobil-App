import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { walletApi } from "../services/api";
import { openCheckout, paymentReturnUrl } from "../services/checkout";
import { useApp } from "../context/AppContext";
import AppHeader from "../components/AppHeader";
import { Button, Field } from "../components/ui";
import { colors, formatTL } from "../components/theme";
import CardPicker from "../components/CardPicker";
import { toast } from "../components/Feedback";

const QUICK = [100, 250, 500, 1000];

export default function LoadMoneyScreen({ navigation, route }) {
  const limits = route.params?.limits ?? { minTopup: 50, maxTopup: 5000 };
  const { actions } = useApp();
  const [amount, setAmount] = useState(route.params?.amount ? String(route.params.amount) : "");
  const [loading, setLoading] = useState(false);
  const [card, setCard] = useState({});

  const value = Number(amount.replace(",", "."));
  const valid = Number.isFinite(value) && value >= limits.minTopup && value <= limits.maxTopup;

  const submit = async () => {
    setLoading(true);
    try {
      const { payment, checkoutUrl } = await walletApi.topup(Math.round(value * 100) / 100, paymentReturnUrl(), card);
      const status = await openCheckout(checkoutUrl, payment.id);
      if (status === "SUCCEEDED") {
        actions.refreshUnread().catch(() => {});
        actions.refreshUser().catch(() => {});
        navigation.goBack();
        toast.success("Bakiye yüklendi", `Cüzdanınıza ${formatTL(value)} yüklendi.`);
      } else if (status === "FAILED") {
        toast.error("Ödeme başarısız", "Kartınızdan çekim yapılmadı. Lütfen tekrar deneyin.");
      } else {
        toast.info("Ödeme tamamlanmadı", "Ödeme sayfasını kapattınız. Çekim yapılmadı.");
      }
    } catch (e) {
      toast.error("Hata", e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.container}>
      <AppHeader title="Bakiye Yükle" back />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.quick}>
          {QUICK.filter((q) => q >= limits.minTopup && q <= limits.maxTopup).map((q) => (
            <TouchableOpacity
              key={q}
              style={[styles.chip, value === q && styles.chipOn]}
              onPress={() => setAmount(String(q))}
              accessibilityState={{ selected: value === q }}
            >
              <Text style={[styles.chipText, value === q && { color: "#fff" }]}>{formatTL(q)}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Field
          label="Tutar (TL)"
          value={amount}
          onChangeText={(v) => setAmount(v.replace(/[^\d.,]/g, ""))}
          keyboardType="decimal-pad"
          placeholder={`${limits.minTopup} - ${limits.maxTopup}`}
          error={
            amount && !valid
              ? `Tutar ${formatTL(limits.minTopup)} ile ${formatTL(limits.maxTopup)} arasında olmalı`
              : null
          }
        />
        <Text style={styles.cardTitle}>Ödeme kartı</Text>
        <CardPicker onChange={setCard} />
        <View style={styles.secure}>
          <MaterialIcons name="lock" size={18} color={colors.success} />
          <Text style={styles.secureText}>
            Ödeme, lisanslı ödeme kuruluşunun 3D Secure korumalı sayfasında yapılır. Kart bilgileriniz Bakımca'ya
            iletilmez ve saklanmaz.
          </Text>
        </View>
        <Button
          title={valid ? `${formatTL(value)} Yükle` : "Yükle"}
          onPress={submit}
          loading={loading}
          disabled={!valid}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  cardTitle: { fontSize: 16, fontWeight: "700", color: colors.text, marginTop: 20 },
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 20 },
  quick: { flexDirection: "row", flexWrap: "wrap", marginBottom: 16 },
  chip: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginRight: 8,
    marginBottom: 8,
  },
  chipOn: { backgroundColor: colors.primary },
  chipText: { color: colors.primary, fontWeight: "600" },
  secure: { flexDirection: "row", backgroundColor: "#eef7ee", borderRadius: 10, padding: 12, marginBottom: 20 },
  secureText: { flex: 1, marginLeft: 8, fontSize: 13, color: colors.text, lineHeight: 18 },
});
