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
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useApp } from "../context/AppContext";
import { Button, Checkbox, Field } from "../components/ui";
import { colors } from "../components/theme";

const PASSWORD_RULE = /^(?=.*[A-Za-zÇĞİÖŞÜçğıöşü])(?=.*\d).{8,128}$/;

export default function SignUpScreen({ navigation }) {
  const { actions } = useApp();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  const validate = () => {
    const e = {};
    if (form.name.trim().length < 2) e.name = "Adınızı ve soyadınızı girin";
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) e.email = "Geçerli bir e-posta adresi girin";
    if (form.phone && !/^(\+90|0)?5\d{9}$/.test(form.phone.replace(/[\s()-]/g, ""))) {
      e.phone = "Geçerli bir cep telefonu girin (5XX XXX XX XX)";
    }
    if (!PASSWORD_RULE.test(form.password)) e.password = "En az 8 karakter, en az bir harf ve bir rakam";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSignUp = async () => {
    if (!validate()) return;
    if (!acceptTerms) {
      Alert.alert("Onay gerekli", "Devam etmek için kullanım koşullarını ve KVKK aydınlatma metnini onaylayın.");
      return;
    }
    setLoading(true);
    try {
      await actions.signUp({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        ...(form.phone ? { phone: form.phone } : {}),
        acceptTerms: true,
        marketingOptIn,
      });
    } catch (e) {
      Alert.alert("Kayıt yapılamadı", e.message);
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={["#FDEEF2", "#F5F5F7"]} style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.logoBox}>
            <Ionicons name="cut-outline" size={60} color={colors.primary} />
            <Text style={styles.appName}>Yeni hesap oluşturun</Text>
          </View>

          <Field
            icon="person-outline"
            placeholder="Ad Soyad"
            value={form.name}
            onChangeText={set("name")}
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
            error={errors.name}
            accessibilityLabel="Ad soyad"
          />
          <Field
            icon="mail-outline"
            placeholder="E-posta adresiniz"
            value={form.email}
            onChangeText={set("email")}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            error={errors.email}
            accessibilityLabel="E-posta"
          />
          <Field
            icon="phone"
            placeholder="Cep telefonu (isteğe bağlı)"
            value={form.phone}
            onChangeText={set("phone")}
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            error={errors.phone}
            accessibilityLabel="Cep telefonu"
          />
          <Field
            icon="lock-outline"
            placeholder="Şifre (en az 8 karakter, harf ve rakam)"
            value={form.password}
            onChangeText={set("password")}
            secureTextEntry={!showPassword}
            autoComplete="new-password"
            textContentType="newPassword"
            error={errors.password}
            accessibilityLabel="Şifre"
            right={
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={10}>
                <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#A1A1A6" />
              </TouchableOpacity>
            }
          />

          <Checkbox checked={acceptTerms} onChange={setAcceptTerms}>
            <Text style={styles.consent}>
              <Text style={styles.link} onPress={() => navigation.navigate("Privacy")}>
                Kullanım koşullarını ve KVKK aydınlatma metnini
              </Text>{" "}
              okudum, kabul ediyorum.
            </Text>
          </Checkbox>
          <Checkbox checked={marketingOptIn} onChange={setMarketingOptIn}>
            <Text style={styles.consent}>
              Kampanya ve fırsatlardan e-posta/SMS ile haberdar olmak istiyorum (isteğe bağlı).
            </Text>
          </Checkbox>

          <Button title="Kayıt Ol" onPress={handleSignUp} loading={loading} style={{ marginTop: 16 }} />

          <TouchableOpacity style={styles.bottomLink} onPress={() => navigation.goBack()}>
            <Text style={styles.link}>Zaten hesabınız var mı? Giriş yapın</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: "center", padding: 28 },
  logoBox: { alignItems: "center", marginBottom: 24 },
  appName: { fontSize: 22, fontWeight: "bold", color: colors.primary, marginTop: 8 },
  consent: { fontSize: 13, color: colors.text, lineHeight: 19 },
  link: { color: colors.primary, fontWeight: "600" },
  bottomLink: { alignItems: "center", paddingVertical: 18 },
});
