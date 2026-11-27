import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { walletApi } from "../services/api";
import { openCheckout, paymentReturnUrl } from "../services/checkout";
import { useApp } from "../context/AppContext";
import AppHeader from "../components/AppHeader";
import { Button, Field } from "../components/ui";
import { colors, formatTL } from "../components/theme";

const QUICK = [100, 250, 500, 1000];

export default function LoadMoneyScreen({ navigation, route }) {
  const limits = route.params?.limits ?? { minTopup: 50, maxTopup: 5000 };
  const { actions } = useApp();
  const [amount, setAmount] = useState(route.params?.amount ? String(route.params.amount) : "");
  const [loading, setLoading] = useState(false);

  const value = Number(amount.replace(",", "."));
  const valid = Number.isFinite(value) && value >= limits.minTopup && value <= limits.maxTopup;

  const submit = async () => {
    setLoading(true);
    try {
      const { payment, checkoutUrl } = await walletApi.topup(Math.round(value * 100) / 100, paymentReturnUrl());
      const status = await openCheckout(checkoutUrl, payment.id);
      if (status === "SUCCEEDED") {
        actions.refreshUnread().catch(() => {});
        actions.refreshUser().catch(() => {});
        Alert.alert("Bakiye yüklendi", `Cüzdanınıza ${formatTL(value)} yüklendi.`, [
          { text: "Tamam", onPress: () => navigation.goBack() },
        ]);
      } else if (status === "FAILED") {
        Alert.alert("Ödeme başarısız", "Kartınızdan çekim yapılmadı. Lütfen tekrar deneyin.");
      } else {
        Alert.alert("Ödeme tamamlanmadı", "Ödeme sayfasını kapattınız. Çekim yapılmadı.");
      }
    } catch (e) {
      Alert.alert("Hata", e.message);
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
        <View style={styles.secure}>
          <MaterialIcons name="lock" size={18} color={colors.success} />
          <Text style={styles.secureText}>
            Ödeme, lisanslı ödeme kuruluşunun 3D Secure korumalı sayfasında yapılır. Kart bilgileriniz MyKuaför'e
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
