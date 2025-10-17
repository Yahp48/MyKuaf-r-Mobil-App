import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Image, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

const API_BASE_URL = "http://192.168.244.116:5000";

export default function SignInScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/users/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        await AsyncStorage.setItem("token", data.token);
        await AsyncStorage.setItem("user", JSON.stringify(data.user));
        
        navigation.reset({
          index: 0,
          routes: [{ name: "Home" }],
        });
      } else {
        Alert.alert("Hata", data.message || "E-posta veya şifre hatalı!");
      }
    } catch (error) {
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
            <Text style={styles.welcomeText}>Hesabınıza giriş yapın</Text>
          </View>

          <View style={styles.formContainer}>
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
                placeholder="Şifreniz"
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

            <TouchableOpacity style={styles.forgotPassword}>
              <Text style={styles.forgotPasswordText}>Şifremi Unuttum?</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={handleLogin} 
              style={styles.loginButton}
              disabled={isLoading}
            >
              <LinearGradient 
                colors={["#9e8efc", "#7b68ee"]} 
                style={styles.gradientButton}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.loginButtonText}>
                  {isLoading ? "Giriş Yapılıyor..." : "Giriş Yap"}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>veya</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity 
              style={styles.signUpButton}
              onPress={() => navigation.navigate("SignUp")}
            >
              <Text style={styles.signUpButtonText}>Yeni Hesap Oluştur</Text>
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
  forgotPassword: {
    alignSelf: "flex-end",
    marginBottom: 25,
  },
  forgotPasswordText: {
    color: "#9e8efc",
    fontSize: 14,
  },
  loginButton: {
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 20,
  },
  gradientButton: {
    paddingVertical: 16,
    alignItems: "center",
  },
  loginButtonText: {
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
  signUpButton: {
    borderWidth: 1,
    borderColor: "#9e8efc",
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: "center",
  },
  signUpButtonText: {
    color: "#9e8efc",
    fontSize: 16,
    fontWeight: "bold",
  },
});