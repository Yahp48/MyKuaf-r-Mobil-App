import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CommonActions } from "@react-navigation/native"; 
import Icon from "react-native-vector-icons/AntDesign";
import MaterialIcon from "react-native-vector-icons/MaterialIcons";
import FontAwesome5 from "react-native-vector-icons/FontAwesome5";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";

export default function AccountSettings({ navigation }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  
  useEffect(() => {
    const getUserInfo = async () => {
      try {
        const userData = await AsyncStorage.getItem("user");
        if (userData) {
          const user = JSON.parse(userData);
          setName(user.name);
          setEmail(user.email);
        }
      } catch (error) {
        console.error("Kullanıcı bilgileri alınamadı:", error);
      }
    };
    getUserInfo();
  }, []);

 
  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      Alert.alert("Hata", "Lütfen mevcut ve yeni şifrenizi girin!");
      return;
    }

    try {
      const token = await AsyncStorage.getItem("token");
      const response = await fetch("http://192.168.73.116:5000/api/users/change-password", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email,
          currentPassword,
          newPassword,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        Alert.alert("Başarılı", "Şifreniz başarıyla güncellendi.");
        setCurrentPassword("");
        setNewPassword("");
      } else {
        Alert.alert("Hata", data.message || "Şifre değiştirilemedi!");
      }
    } catch (error) {
      console.error("Şifre değiştirme hatası:", error);
      Alert.alert("Hata", "Sunucuya bağlanırken bir hata oluştu.");
    }
  };

  
  const handleLogout = async () => {
    await AsyncStorage.removeItem("token"); 
    await AsyncStorage.removeItem("user");  

    
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: "SignIn" }],
      })
    );
  };

  return (
    <View style={styles.container}>
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.navigate("Home")}>
          <Icon name="home" size={35} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.logo}>WOMAN HAIR DESIGN</Text>
        <TouchableOpacity onPress={() => navigation.navigate("Notifications")}>
          <MaterialIcon name="notifications-none" size={35} color="#fff" />
        </TouchableOpacity>
      </View>

      
      <View style={styles.form}>
        <Text style={styles.label}>Ad Soyad</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} editable={false} />

        <Text style={styles.label}>E-Posta</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} keyboardType="email-address" editable={false} />

       
        <Text style={styles.label}>Mevcut Şifre</Text>
        <TextInput
          style={styles.input}
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
          placeholder="Mevcut şifrenizi girin"
        />

        <Text style={styles.label}>Yeni Şifre</Text>
        <TextInput
          style={styles.input}
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          placeholder="Yeni şifrenizi girin"
        />

        <TouchableOpacity style={styles.saveButton} onPress={handleChangePassword}>
          <Text style={styles.saveButtonText}>Şifreyi Güncelle</Text>
        </TouchableOpacity>

        
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Çıkış Yap</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FF4896",
    paddingTop: 15,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  logo: { color: "white", fontSize: 20, fontWeight: "bold" },
  form: { padding: 20 },
  label: { fontSize: 16, color: "#FF4896", fontWeight: "bold", marginBottom: 5 },
  input: {
    borderWidth: 1,
    borderColor: "#FF4896",
    padding: 10,
    borderRadius: 10,
    marginBottom: 15,
  },
  saveButton: {
    backgroundColor: "#FF4896",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 10,
  },
  saveButtonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  logoutButton: {
    backgroundColor: "#d9534f",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  logoutButtonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
});

