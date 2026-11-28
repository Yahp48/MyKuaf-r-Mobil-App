import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useApp } from "../context/AppContext";
import { Button, Field } from "../components/ui";
import { colors } from "../components/theme";
import { toast } from "../components/Feedback";

export default function SignInScreen({ navigation }) {
  const { actions } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      toast.error("Eksik bilgi", "E-posta ve şifrenizi girin.");
      return;
    }
    setLoading(true);
    try {
      await actions.signIn(email.trim(), password);
      // Oturum açılınca App.js uygulama ekranlarına geçer.
    } catch (e) {
      toast.error("Giriş yapılamadı", e.message);
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={["#FDEEF2", "#F5F5F7"]} style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.logoBox}>
            <Ionicons name="cut-outline" size={72} color={colors.primary} />
            <Text style={styles.appName}>MyKuaför</Text>
            <Text style={styles.subtitle}>Hesabınıza giriş yapın</Text>
          </View>

          <Field
            icon="mail-outline"
            placeholder="E-posta adresiniz"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            accessibilityLabel="E-posta"
          />
          <Field
            icon="lock-outline"
            placeholder="Şifreniz"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoComplete="current-password"
            textContentType="password"
            accessibilityLabel="Şifre"
            onSubmitEditing={handleLogin}
            right={
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                accessibilityLabel={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                hitSlop={10}
              >
                <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#A1A1A6" />
              </TouchableOpacity>
            }
          />

          <TouchableOpacity style={styles.forgot} onPress={() => navigation.navigate("ForgotPassword", { email })}>
            <Text style={styles.link}>Şifremi unuttum</Text>
          </TouchableOpacity>

          <Button title="Giriş Yap" onPress={handleLogin} loading={loading} />

          <View style={styles.divider}>
            <View style={styles.line} />
            <Text style={styles.dividerText}>veya</Text>
            <View style={styles.line} />
          </View>

          <Button title="Yeni Hesap Oluştur" variant="outline" onPress={() => navigation.navigate("SignUp")} />
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: "center", padding: 28 },
  logoBox: { alignItems: "center", marginBottom: 36 },
  appName: { fontSize: 26, fontWeight: "bold", color: colors.primary, marginTop: 8 },
  subtitle: { fontSize: 15, color: colors.muted, marginTop: 4 },
  forgot: { alignSelf: "flex-end", marginBottom: 20, marginTop: -4 },
  link: { color: colors.primary, fontSize: 14, fontWeight: "600" },
  divider: { flexDirection: "row", alignItems: "center", marginVertical: 22 },
  line: { flex: 1, height: 1, backgroundColor: "#ddd" },
  dividerText: { marginHorizontal: 10, color: "#999" },
});
