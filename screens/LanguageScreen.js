import React, { useState } from "react";
import { View, StyleSheet, Text, TouchableOpacity, ScrollView, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Icon from "react-native-vector-icons/AntDesign";
import FontAwesome5 from "react-native-vector-icons/FontAwesome5";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";
import { useApp } from '../context/AppContext';

export default function LanguageScreen({ navigation }) {
  const [selectedLanguage, setSelectedLanguage] = useState("tr");
   const { state } = useApp();
    const cartCount = state.cartItems.length;

  const languages = [
    {
      code: "tr",
      name: "Türkçe",
      nativeName: "Türkçe",
      flag: "🇹🇷",
      available: true
    },
    {
      code: "en",
      name: "English",
      nativeName: "English",
      flag: "🇺🇸",
      available: true
    },
    {
      code: "de",
      name: "German",
      nativeName: "Deutsch",
      flag: "🇩🇪",
      available: false
    },
    {
      code: "fr",
      name: "French",
      nativeName: "Français",
      flag: "🇫🇷",
      available: false
    },
    {
      code: "es",
      name: "Spanish",
      nativeName: "Español",
      flag: "🇪🇸",
      available: false
    },
    {
      code: "ar",
      name: "Arabic",
      nativeName: "العربية",
      flag: "🇸🇦",
      available: false
    },
    {
      code: "ru",
      name: "Russian",
      nativeName: "Русский",
      flag: "🇷🇺",
      available: false
    }
  ];

  const selectLanguage = async (languageCode, available) => {
    if (!available) {
      Alert.alert(
        "Yakında Gelecek",
        "Bu dil henüz mevcut değil. Çok yakında eklenecek!",
        [{ text: "Tamam" }]
      );
      return;
    }

    try {
      await AsyncStorage.setItem("selectedLanguage", languageCode);
      setSelectedLanguage(languageCode);
      
      Alert.alert(
        "Dil Değiştirildi",
        "Uygulama dili başarıyla değiştirildi. Değişikliklerin geçerli olması için uygulamayı yeniden başlatın.",
        [
          {
            text: "Tamam",
            onPress: () => navigation.goBack()
          }
        ]
      );
    } catch (error) {
      console.error("Dil ayarı kaydedilirken hata:", error);
      Alert.alert("Hata", "Dil ayarı kaydedilemedi. Lütfen tekrar deneyin.");
    }
  };

  const LanguageItem = ({ language }) => (
    <TouchableOpacity
      style={[
        styles.languageItem,
        selectedLanguage === language.code && styles.selectedLanguageItem,
        !language.available && styles.disabledLanguageItem
      ]}
      onPress={() => selectLanguage(language.code, language.available)}
    >
      <View style={styles.languageInfo}>
        <Text style={styles.languageFlag}>{language.flag}</Text>
        <View style={styles.languageTexts}>
          <Text style={[
            styles.languageName,
            !language.available && styles.disabledText
          ]}>
            {language.name}
          </Text>
          <Text style={[
            styles.languageNative,
            !language.available && styles.disabledText
          ]}>
            {language.nativeName}
          </Text>
        </View>
      </View>
      
      <View style={styles.languageStatus}>
        {!language.available && (
          <View style={styles.betaBadge}>
            <Text style={styles.betaText}>YAKINDA</Text>
          </View>
        )}
        {selectedLanguage === language.code && language.available && (
          <FontAwesome6 name="check-circle" size={20} color="#10b981" />
        )}
        {language.available && selectedLanguage !== language.code && (
          <View style={styles.radioButton}>
            <View style={styles.radioButtonInner} />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrowleft" size={30} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.logo}>DİL SEÇİMİ</Text>
        <TouchableOpacity onPress={() => navigation.navigate("Notifications")}>
          <FontAwesome6 name="bell" size={30} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        
        <View style={styles.infoCard}>
          <FontAwesome6 name="globe" size={40} color="#FF4896" />
          <Text style={styles.infoTitle}>Dil Seçimi (Beta)</Text>
          <Text style={styles.infoText}>
            Uygulamayı farklı dillerde kullanabilirsiniz. Şu anda Türkçe ve İngilizce mevcut, 
            diğer diller yakında eklenecek.
          </Text>
        </View>

        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🌟 Mevcut Diller</Text>
          {languages.filter(lang => lang.available).map((language) => (
            <LanguageItem key={language.code} language={language} />
          ))}
        </View>

       
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⏳ Yakında Gelecek</Text>
          {languages.filter(lang => !lang.available).map((language) => (
            <LanguageItem key={language.code} language={language} />
          ))}
        </View>

      
        <View style={styles.requestCard}>
          <FontAwesome6 name="comment-dots" size={30} color="#3b82f6" />
          <Text style={styles.requestTitle}>Dilinizi Görmüyor musunuz?</Text>
          <Text style={styles.requestText}>
            Hangi dili eklememizi istiyorsanız bize bildirin. 
            En çok talep edilen dilleri öncelikli olarak ekliyoruz.
          </Text>
          <TouchableOpacity style={styles.requestButton}>
            <FontAwesome6 name="paper-plane" size={16} color="#fff" />
            <Text style={styles.requestButtonText}>Dil Talebi Gönder</Text>
          </TouchableOpacity>
        </View>

      
        <View style={styles.betaInfoCard}>
          <FontAwesome6 name="flask" size={24} color="#f59e0b" />
          <Text style={styles.betaInfoTitle}>Beta Sürüm Bilgisi</Text>
          <Text style={styles.betaInfoText}>
            • Çeviri kalitesini sürekli iyileştiriyoruz{"\n"}
            • Hatalı çevirileri bize bildirebilirsiniz{"\n"}
            • Yeni diller düzenli olarak eklenmektedir{"\n"}
            • Geri bildirimleriniz bizim için çok değerli
          </Text>
        </View>
      </ScrollView>

      
      <View style={styles.bottomNav}>
        <TouchableOpacity 
          onPress={() => navigation.navigate("Appointments")}
          style={styles.navButton}
        >
          <FontAwesome5 name="calendar-alt" size={24} color="#fff" />
          <Text style={styles.navText}>Randevular</Text>
        </TouchableOpacity>
      
        <TouchableOpacity 
          onPress={() => navigation.navigate("Home")}
          style={styles.navButton}
        >
          <FontAwesome5 name="map-marked-alt" size={24} color="#fff" />
          <Text style={styles.navText}>Harita</Text>
        </TouchableOpacity>
      
        <TouchableOpacity 
          onPress={() => navigation.navigate("Shop")}
          style={styles.navButton}
        >
          <FontAwesome5 name="shopping-bag" size={28} color="#fff" />
          {cartCount > 0 && (
            <View style={styles.navCartBadge}>
              <Text style={styles.navCartBadgeText}>
                {cartCount > 99 ? '99+' : cartCount}
              </Text>
            </View>
          )}
          <Text style={styles.navText}>Mağaza</Text>
        </TouchableOpacity>
      
        <TouchableOpacity 
          onPress={() => navigation.navigate("Profile")}
          style={styles.navButton}
        >
          <FontAwesome6 name="user" size={24} color="#fff" />
          <Text style={styles.navText}>Profil</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FF4896",
    paddingTop: 15,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  logo: { color: "white", fontSize: 18, fontWeight: "bold" },
  content: { flex: 1, paddingBottom: 80 },
  infoCard: {
    backgroundColor: "#fff",
    margin: 15,
    borderRadius: 15,
    padding: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginTop: 10,
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 20,
  },
  section: {
    backgroundColor: "#fff",
    marginHorizontal: 15,
    marginBottom: 15,
    borderRadius: 15,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 15,
  },
  languageItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  selectedLanguageItem: {
    backgroundColor: "#f0fdf4",
    borderRadius: 10,
    marginHorizontal: -10,
    paddingHorizontal: 10,
  },
  disabledLanguageItem: {
    opacity: 0.6,
  },
  languageInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  languageFlag: {
    fontSize: 24,
    marginRight: 15,
  },
  languageTexts: {
    flex: 1,
  },
  languageName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 2,
  },
  languageNative: {
    fontSize: 14,
    color: "#666",
  },
  disabledText: {
    color: "#999",
  },
  languageStatus: {
    alignItems: "center",
  },
  betaBadge: {
    backgroundColor: "#f59e0b",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  betaText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#d1d5db",
    justifyContent: "center",
    alignItems: "center",
  },
  radioButtonInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "transparent",
  },
  requestCard: {
    backgroundColor: "#fff",
    margin: 15,
    borderRadius: 15,
    padding: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  requestTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginTop: 10,
    marginBottom: 10,
  },
  requestText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  requestButton: {
    flexDirection: "row",
    backgroundColor: "#3b82f6",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    alignItems: "center",
  },
  requestButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
    marginLeft: 8,
  },
  betaInfoCard: {
    backgroundColor: "#fff",
    margin: 15,
    borderRadius: 15,
    padding: 20,
    borderLeftWidth: 4,
    borderLeftColor: "#f59e0b",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  betaInfoTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  betaInfoText: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#FF4896',
    height: 70,
    position: 'absolute',
    bottom: 0,
    width: '100%',
    paddingHorizontal: 10,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  navButton: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: 8,
  },
  navText: {
    color: '#fff',
    fontSize: 11,
    marginTop: 4,
    fontWeight: '500',
  },
  navCartBadge: {
    position: 'absolute',
    top: -4,
    right: 8,
    backgroundColor: '#e00061',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FF4896',
  },
  navCartBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
});