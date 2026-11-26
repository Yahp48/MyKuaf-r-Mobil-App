import React, { useState } from "react";
import { View, StyleSheet, Text, TouchableOpacity, ScrollView, Switch, Alert } from "react-native";
import { AntDesign as Icon } from "@expo/vector-icons";
import { FontAwesome5 as FontAwesome5 } from "@expo/vector-icons";
import { FontAwesome6 as FontAwesome6 } from "@expo/vector-icons";
import { useApp } from "../context/AppContext";

export default function PrivacyScreen({ navigation }) {
  const { state } = useApp();
  const cartCount = state.cartItems.length;
  const [settings, setSettings] = useState({
    locationSharing: true,
    dataCollection: false,
    marketingEmails: true,
    pushNotifications: true,
    profileVisibility: true,
    reviewsVisible: true,
    phoneVisible: false,
    emailVisible: true,
  });

  const updateSetting = (key, value) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const showPrivacyInfo = (title, content) => {
    Alert.alert(title, content, [{ text: "Anladım" }]);
  };

  const deleteAccount = () => {
    Alert.alert("Hesabı Sil", "Bu işlem geri alınamaz! Tüm verileriniz kalıcı olarak silinecektir.", [
      { text: "İptal", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: () => {
          Alert.alert("Hesap Silindi", "Hesabınız başarıyla silindi.");
          navigation.navigate("SignIn");
        },
      },
    ]);
  };

  const SettingItem = ({ title, subtitle, value, onValueChange, infoText }) => (
    <View style={styles.settingItem}>
      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{title}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      <View style={styles.settingControls}>
        {infoText && (
          <TouchableOpacity onPress={() => showPrivacyInfo(title, infoText)} style={styles.infoButton}>
            <FontAwesome6 name="circle-info" size={16} color="#666" />
          </TouchableOpacity>
        )}
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: "#ccc", true: "#FF4896" }}
          thumbColor={value ? "#fff" : "#f4f3f4"}
        />
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={30} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.logo}>GİZLİLİK</Text>
        <TouchableOpacity onPress={() => navigation.navigate("Notifications")}>
          <FontAwesome6 name="bell" size={30} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔒 Veri Gizliliği</Text>

          <SettingItem
            title="Konum Paylaşımı"
            subtitle="Yakınınızdaki kuaförleri bulmak için"
            value={settings.locationSharing}
            onValueChange={(value) => updateSetting("locationSharing", value)}
            infoText="Konum bilginiz sadece size yakın kuaförleri göstermek için kullanılır ve üçüncü taraflarla paylaşılmaz."
          />

          <SettingItem
            title="Veri Toplama"
            subtitle="Uygulama kullanım istatistikleri"
            value={settings.dataCollection}
            onValueChange={(value) => updateSetting("dataCollection", value)}
            infoText="Anonim kullanım verileri toplayarak uygulamayı iyileştirmemize yardımcı olursunuz."
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📧 İletişim Tercihleri</Text>

          <SettingItem
            title="Pazarlama E-postaları"
            subtitle="Kampanya ve fırsat bilgileri"
            value={settings.marketingEmails}
            onValueChange={(value) => updateSetting("marketingEmails", value)}
            infoText="Özel indirimler, yeni kuaför kayıtları ve kampanyalar hakkında bilgi alın."
          />

          <SettingItem
            title="Anlık Bildirimler"
            subtitle="Randevu hatırlatmaları ve güncellemeler"
            value={settings.pushNotifications}
            onValueChange={(value) => updateSetting("pushNotifications", value)}
            infoText="Randevu hatırlatmaları, onay bildirimleri ve önemli güncellemeler için gereklidir."
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>👤 Profil Görünürlüğü</Text>

          <SettingItem
            title="Profil Görünürlüğü"
            subtitle="Diğer kullanıcılar profilinizi görebilir"
            value={settings.profileVisibility}
            onValueChange={(value) => updateSetting("profileVisibility", value)}
            infoText="Profiliniz kuaförlerin sizi tanımasına yardımcı olur ancak istediğiniz zaman gizleyebilirsiniz."
          />

          <SettingItem
            title="Değerlendirmelerim Görünsün"
            subtitle="Yazdığınız yorumlar herkese açık"
            value={settings.reviewsVisible}
            onValueChange={(value) => updateSetting("reviewsVisible", value)}
            infoText="Değerlendirmeleriniz diğer kullanıcılara kuaför seçiminde yardımcı olur."
          />

          <SettingItem
            title="Telefon Numarası Görünsün"
            subtitle="Kuaförler sizinle doğrudan iletişim kurabilir"
            value={settings.phoneVisible}
            onValueChange={(value) => updateSetting("phoneVisible", value)}
            infoText="Telefon numaranız sadece randevu aldığınız kuaförlere gösterilir."
          />

          <SettingItem
            title="E-posta Adresi Görünsün"
            subtitle="Bildirimler ve iletişim için"
            value={settings.emailVisible}
            onValueChange={(value) => updateSetting("emailVisible", value)}
            infoText="E-posta adresiniz kuaförlerle iletişim ve randevu onayları için kullanılır."
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📄 Gizlilik Belgeleri</Text>

          <TouchableOpacity style={styles.documentButton}>
            <FontAwesome6 name="file-contract" size={16} color="#FF4896" />
            <Text style={styles.documentText}>Gizlilik Politikası</Text>
            <FontAwesome6 name="chevron-right" size={12} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.documentButton}>
            <FontAwesome6 name="handshake" size={16} color="#FF4896" />
            <Text style={styles.documentText}>Kullanım Şartları</Text>
            <FontAwesome6 name="chevron-right" size={12} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.documentButton}>
            <FontAwesome6 name="cookie-bite" size={16} color="#FF4896" />
            <Text style={styles.documentText}>Çerez Politikası</Text>
            <FontAwesome6 name="chevron-right" size={12} color="#666" />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💾 Veri Yönetimi</Text>

          <TouchableOpacity style={styles.actionButton}>
            <FontAwesome6 name="download" size={16} color="#3b82f6" />
            <Text style={[styles.actionText, { color: "#3b82f6" }]}>Verilerimi İndir</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={deleteAccount}>
            <FontAwesome6 name="trash-alt" size={16} color="#ef4444" />
            <Text style={[styles.actionText, { color: "#ef4444" }]}>Hesabımı Sil</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View style={styles.bottomNav}>
        <TouchableOpacity onPress={() => navigation.navigate("Appointments")} style={styles.navButton}>
          <FontAwesome5 name="calendar-alt" size={24} color="#fff" />
          <Text style={styles.navText}>Randevular</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate("Home")} style={styles.navButton}>
          <FontAwesome5 name="map-marked-alt" size={24} color="#fff" />
          <Text style={styles.navText}>Harita</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate("Shop")} style={styles.navButton}>
          <FontAwesome5 name="shopping-bag" size={28} color="#fff" />
          {cartCount > 0 && (
            <View style={styles.navCartBadge}>
              <Text style={styles.navCartBadgeText}>{cartCount > 99 ? "99+" : cartCount}</Text>
            </View>
          )}
          <Text style={styles.navText}>Mağaza</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate("Profile")} style={styles.navButton}>
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
  section: {
    backgroundColor: "#fff",
    marginHorizontal: 15,
    marginTop: 15,
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
  settingItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  settingContent: { flex: 1 },
  settingTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 12,
    color: "#666",
  },
  settingControls: {
    flexDirection: "row",
    alignItems: "center",
  },
  infoButton: {
    padding: 5,
    marginRight: 5,
  },
  documentButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  documentText: {
    fontSize: 14,
    color: "#333",
    marginLeft: 10,
    flex: 1,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  actionText: {
    fontSize: 14,
    fontWeight: "500",
    marginLeft: 10,
  },
  bottomNav: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    backgroundColor: "#FF4896",
    height: 70,
    position: "absolute",
    bottom: 0,
    width: "100%",
    paddingHorizontal: 10,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  navButton: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    paddingVertical: 8,
  },
  navText: {
    color: "#fff",
    fontSize: 11,
    marginTop: 4,
    fontWeight: "500",
  },
  navCartBadge: {
    position: "absolute",
    top: -4,
    right: 8,
    backgroundColor: "#e00061",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FF4896",
  },
  navCartBadgeText: {
    color: "white",
    fontSize: 10,
    fontWeight: "bold",
  },
});
