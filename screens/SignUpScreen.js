import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

const API_BASE_URL = "http://192.168.4.116:5000";

export default function SignUpScreen({ navigation }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSignUp = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/users/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert("Başarılı", "Kayıt işlemi başarılı!", [
          { text: "Tamam", onPress: () => navigation.navigate("SignIn") }
        ]);
      } else {
        Alert.alert("Hata", data.message || "Kayıt başarısız!");
      }
    } catch (error) {
      console.error("❌ Kayıt hatası:", error);
      Alert.alert("Hata", "Sunucuya bağlanırken bir hata oluştu.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <LinearGradient colors={["#f8f4ff", "#e8dffb"]} style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.logoContainer}>
            <Ionicons name="cut-outline" size={80} color="#7b68ee" style={styles.logoIcon} />
            <Text style={styles.appName}>Güzellik Salonu</Text>
            <Text style={styles.welcomeText}>Yeni hesap oluşturun</Text>
          </View>

          <View style={styles.formContainer}>
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color="#9e8efc" style={styles.inputIcon} />
              <TextInput
                placeholder="Ad Soyad"
                placeholderTextColor="#aaa"
                value={name}
                onChangeText={setName}
                style={styles.input}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color="#9e8efc" style={styles.inputIcon} />
              <TextInput
                placeholder="E-posta adresiniz"
                placeholderTextColor="#aaa"
                value={email}
                onChangeText={setEmail}
                style={styles.input}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="#9e8efc" style={styles.inputIcon} />
              <TextInput
                placeholder="Şifreniz (min. 6 karakter)"
                placeholderTextColor="#aaa"
                value={password}
                onChangeText={setPassword}
                style={styles.input}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#9e8efc" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              onPress={handleSignUp} 
              style={styles.signUpButton}
              disabled={isLoading}
            >
              <LinearGradient 
                colors={["#9e8efc", "#7b68ee"]} 
                style={styles.gradientButton}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.signUpButtonText}>
                  {isLoading ? "Kayıt Olunuyor..." : "Kayıt Ol"}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>veya</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity 
              style={styles.loginButton}
              onPress={() => navigation.navigate("SignIn")}
            >
              <Text style={styles.loginButtonText}>Zaten hesabınız var mı? Giriş Yap</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 30,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 40,
  },
  logoIcon: {
    marginBottom: 15,
  },
  appName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#5a4fcf",
    marginBottom: 5,
  },
  welcomeText: {
    fontSize: 16,
    color: "#777",
  },
  formContainer: {
    width: "100%",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 10,
    paddingHorizontal: 15,
    marginBottom: 15,
    shadowColor: "#9e8efc",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 50,
    color: "#333",
    fontSize: 16,
  },
  eyeIcon: {
    padding: 10,
  },
  signUpButton: {
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 20,
  },
  gradientButton: {
    paddingVertical: 16,
    alignItems: "center",
  },
  signUpButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#ddd",
  },
  dividerText: {
    marginHorizontal: 10,
    color: "#999",
    fontSize: 14,
  },
  loginButton: {
    paddingVertical: 15,
    alignItems: "center",
  },
  loginButtonText: {
    color: "#9e8efc",
    fontSize: 14,
    fontWeight: "600",
  },
});