import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from "react-native";
import { authApi } from "../services/api";
import AppHeader from "../components/AppHeader";
import { Button, Field } from "../components/ui";
import { colors } from "../components/theme";
import { toast } from "../components/Feedback";

/** İki adım: e-postaya 6 haneli kod gönder → kod ve yeni şifreyle sıfırla. */
export default function ForgotPasswordScreen({ navigation, route }) {
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState(route.params?.email ?? "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const sendCode = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      toast.error("Geçersiz e-posta", "Lütfen kayıtlı e-posta adresinizi girin.");
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.forgotPassword(email.trim());
      toast.success("Kod gönderildi", res.message);
      setStep("reset");
    } catch (e) {
      toast.error("Hata", e.message);
    } finally {
      setLoading(false);
    }
  };

  const reset = async () => {
    setLoading(true);
    try {
      const res = await authApi.resetPassword(email.trim(), code.trim(), password);
      navigation.navigate("SignIn");
      toast.success("Şifre güncellendi", res.message);
    } catch (e) {
      toast.error("Şifre sıfırlanamadı", e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.container}>
      <AppHeader title="Şifremi Unuttum" back />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {step === "email" ? (
          <>
            <Text style={styles.info}>
              Hesabınıza kayıtlı e-posta adresini girin. Size 6 haneli bir sıfırlama kodu göndereceğiz.
            </Text>
            <Field
              label="E-posta"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
            <Button title="Kod Gönder" onPress={sendCode} loading={loading} />
          </>
        ) : (
          <>
            <Text style={styles.info}>
              {email} adresine gönderilen kodu ve yeni şifrenizi girin. Kod 15 dakika geçerlidir.
            </Text>
            <Field
              label="Doğrulama kodu"
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              maxLength={6}
            />
            <Field
              label="Yeni şifre"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
              placeholder="En az 8 karakter, harf ve rakam"
            />
            <Button
              title="Şifreyi Sıfırla"
              onPress={reset}
              loading={loading}
              disabled={code.length !== 6 || password.length < 8}
            />
            <Button title="Kodu tekrar gönder" variant="outline" onPress={sendCode} style={{ marginTop: 12 }} />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 24 },
  info: { fontSize: 15, color: colors.muted, marginBottom: 20, lineHeight: 21 },
});
