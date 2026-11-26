import React, { useState } from "react";
import { View, StyleSheet, Text, TouchableOpacity, ScrollView, TextInput, Alert, Linking } from "react-native";
import { AntDesign as Icon } from "@expo/vector-icons";
import { FontAwesome5 as FontAwesome5 } from "@expo/vector-icons";
import { FontAwesome6 as FontAwesome6 } from "@expo/vector-icons";
import { useApp } from "../context/AppContext";
import { supportApi } from "../services/api";

export default function SupportScreen({ navigation }) {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [message, setMessage] = useState("");
  const { state } = useApp();
  const cartCount = state.cartItems.length;

  const supportCategories = [
    {
      id: "appointment",
      title: "Randevu Sorunları",
      icon: "calendar-alt",
      description: "Randevu alma, iptal etme, değiştirme",
      color: "#3b82f6",
    },
    {
      id: "payment",
      title: "Ödeme Sorunları",
      icon: "credit-card",
      description: "Ödeme, fatura, iade işlemleri",
      color: "#10b981",
    },
    {
      id: "account",
      title: "Hesap Sorunları",
      icon: "user-circle",
      description: "Giriş, şifre, profil ayarları",
      color: "#f59e0b",
    },
    {
      id: "technical",
      title: "Teknik Sorunlar",
      icon: "cog",
      description: "Uygulama hataları, performans",
      color: "#ef4444",
    },
    {
      id: "salon",
      title: "Kuaför Hakkında",
      icon: "store",
      description: "Kuaför kalitesi, şikayet",
      color: "#8b5cf6",
    },
    {
      id: "other",
      title: "Diğer",
      icon: "question-circle",
      description: "Diğer sorular ve öneriler",
      color: "#6b7280",
    },
  ];

  const quickActions = [
    {
      title: "Canlı Destek",
      subtitle: "7/24 anlık yardım",
      icon: "comment-dots",
      color: "#10b981",
      action: () => Alert.alert("Canlı Destek", "Canlı destek yakında aktif olacak!"),
    },
    {
      title: "Telefon",
      subtitle: "0850 123 45 67",
      icon: "phone",
      color: "#3b82f6",
      action: () => Linking.openURL("tel:08501234567"),
    },
    {
      title: "WhatsApp",
      subtitle: "Hızlı iletişim",
      icon: "whatsapp",
      color: "#25d366",
      action: () => Linking.openURL("https://wa.me/908501234567"),
    },
    {
      title: "E-posta",
      subtitle: "destek@womanhair.com",
      icon: "envelope",
      color: "#f59e0b",
      action: () => Linking.openURL("mailto:destek@womanhair.com"),
    },
  ];

  const faqItems = [
    {
      question: "Randevumu nasıl iptal edebilirim?",
      answer:
        "Randevularım sayfasından randevunuzu seçip 'İptal Et' butonuna tıklayabilirsiniz. Randevu saatinden en az 2 saat önce iptal etmeniz gerekir.",
    },
    {
      question: "Ödeme yaparken sorun yaşıyorum",
      answer:
        "Ödeme sorunları için kartınızın limit durumunu kontrol edin. Sorun devam ederse müşteri hizmetleri ile iletişime geçin.",
    },
    {
      question: "Kuaför puanları nasıl hesaplanıyor?",
      answer:
        "Kuaför puanları, müşteri değerlendirmeleri, randevu iptal oranları ve genel hizmet kalitesi kriterlerine göre hesaplanır.",
    },
    {
      question: "Favori kuaförlerimi nasıl görebilirim?",
      answer: "Profil menüsünden 'Favorilerim' seçeneğine tıklayarak favori kuaförlerinizi görüntüleyebilirsiniz.",
    },
  ];

  const sendSupportMessage = async () => {
    if (!selectedCategory) {
      Alert.alert("Uyarı", "Lütfen bir kategori seçin.");
      return;
    }
    if (!message.trim()) {
      Alert.alert("Uyarı", "Lütfen mesajınızı yazın.");
      return;
    }

    try {
      const subject = supportCategories.find((c) => c.id === selectedCategory)?.title ?? "Genel";
      await supportApi.createTicket({
        type: selectedCategory === "technical" ? "BUG" : "SUPPORT",
        subject,
        message: message.trim(),
      });
    } catch (e) {
      Alert.alert("Gönderilemedi", e.message);
      return;
    }
    Alert.alert("Mesaj Gönderildi", "Destek talebiniz alındı. Size hesabınızdaki e-posta adresinden dönüş yapacağız.", [
      {
        text: "Tamam",
        onPress: () => {
          setMessage("");
          setSelectedCategory(null);
          navigation.goBack();
        },
      },
    ]);
  };

  const CategoryCard = ({ category }) => (
    <TouchableOpacity
      style={[styles.categoryCard, selectedCategory === category.id && styles.selectedCategoryCard]}
      onPress={() => setSelectedCategory(category.id)}
    >
      <View style={[styles.categoryIcon, { backgroundColor: category.color }]}>
        <FontAwesome5 name={category.icon} size={20} color="#fff" />
      </View>
      <View style={styles.categoryInfo}>
        <Text style={styles.categoryTitle}>{category.title}</Text>
        <Text style={styles.categoryDescription}>{category.description}</Text>
      </View>
      {selectedCategory === category.id && <FontAwesome6 name="check-circle" size={20} color={category.color} />}
    </TouchableOpacity>
  );

  const QuickActionCard = ({ action }) => (
    <TouchableOpacity style={styles.quickActionCard} onPress={action.action}>
      <View style={[styles.quickActionIcon, { backgroundColor: action.color }]}>
        <FontAwesome5 name={action.icon} size={16} color="#fff" />
      </View>
      <View style={styles.quickActionInfo}>
        <Text style={styles.quickActionTitle}>{action.title}</Text>
        <Text style={styles.quickActionSubtitle}>{action.subtitle}</Text>
      </View>
      <FontAwesome6 name="chevron-right" size={12} color="#666" />
    </TouchableOpacity>
  );

  const FAQItem = ({ item, index }) => {
    const [expanded, setExpanded] = useState(false);

    return (
      <View style={styles.faqItem}>
        <TouchableOpacity style={styles.faqQuestion} onPress={() => setExpanded(!expanded)}>
          <Text style={styles.faqQuestionText}>{item.question}</Text>
          <FontAwesome6 name={expanded ? "chevron-up" : "chevron-down"} size={12} color="#666" />
        </TouchableOpacity>
        {expanded && (
          <View style={styles.faqAnswer}>
            <Text style={styles.faqAnswerText}>{item.answer}</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={30} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.logo}>MÜŞTERİ HİZMETLERİ</Text>
        <TouchableOpacity onPress={() => navigation.navigate("Notifications")}>
          <FontAwesome6 name="bell" size={30} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🚀 Hızlı İletişim</Text>
          <View style={styles.quickActionsGrid}>
            {quickActions.map((action, index) => (
              <QuickActionCard key={index} action={action} />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📝 Destek Talebi Oluştur</Text>

          <Text style={styles.formLabel}>Konu Kategorisi</Text>
          <View style={styles.categoriesContainer}>
            {supportCategories.map((category) => (
              <CategoryCard key={category.id} category={category} />
            ))}
          </View>

          <Text style={styles.formLabel}>Mesajınız</Text>
          <TextInput
            style={[styles.textInput, styles.messageInput]}
            value={message}
            onChangeText={setMessage}
            placeholder="Sorununuzu detaylı olarak açıklayın..."
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />

          <TouchableOpacity style={styles.sendButton} onPress={sendSupportMessage}>
            <FontAwesome6 name="paper-plane" size={16} color="#fff" />
            <Text style={styles.sendButtonText}>Mesaj Gönder</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>❓ Sıkça Sorulan Sorular</Text>
          {faqItems.map((item, index) => (
            <FAQItem key={index} item={item} index={index} />
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📞 İletişim Bilgileri</Text>

          <View style={styles.contactInfo}>
            <View style={styles.contactItem}>
              <FontAwesome6 name="clock" size={16} color="#FF4896" />
              <View style={styles.contactText}>
                <Text style={styles.contactTitle}>Çalışma Saatleri</Text>
                <Text style={styles.contactValue}>Pazartesi - Pazar: 08:00 - 22:00</Text>
              </View>
            </View>

            <View style={styles.contactItem}>
              <FontAwesome6 name="phone" size={16} color="#FF4896" />
              <View style={styles.contactText}>
                <Text style={styles.contactTitle}>Telefon</Text>
                <Text style={styles.contactValue}>0850 123 45 67</Text>
              </View>
            </View>

            <View style={styles.contactItem}>
              <FontAwesome6 name="envelope" size={16} color="#FF4896" />
              <View style={styles.contactText}>
                <Text style={styles.contactTitle}>E-posta</Text>
                <Text style={styles.contactValue}>destek@womanhair.com</Text>
              </View>
            </View>

            <View style={styles.contactItem}>
              <FontAwesome6 name="map-marker-alt" size={16} color="#FF4896" />
              <View style={styles.contactText}>
                <Text style={styles.contactTitle}>Adres</Text>
                <Text style={styles.contactValue}>İstanbul, Türkiye</Text>
              </View>
            </View>
          </View>
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
  logo: { color: "white", fontSize: 14, fontWeight: "bold" },
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
  quickActionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  quickActionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    width: "48%",
  },
  quickActionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  quickActionInfo: { flex: 1 },
  quickActionTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#333",
  },
  quickActionSubtitle: {
    fontSize: 10,
    color: "#666",
  },
  formLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 10,
    marginTop: 15,
  },
  categoriesContainer: {},
  categoryCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  selectedCategoryCard: {
    borderColor: "#FF4896",
    backgroundColor: "#fef2f7",
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  categoryInfo: { flex: 1 },
  categoryTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 2,
  },
  categoryDescription: {
    fontSize: 12,
    color: "#666",
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    backgroundColor: "#fff",
  },
  messageInput: {
    height: 100,
    textAlignVertical: "top",
  },
  sendButton: {
    flexDirection: "row",
    backgroundColor: "#FF4896",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 15,
  },
  sendButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 8,
  },
  faqItem: {
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingBottom: 10,
    marginBottom: 10,
  },
  faqQuestion: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  faqQuestionText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    flex: 1,
    marginRight: 10,
  },
  faqAnswer: {
    paddingTop: 5,
    paddingLeft: 10,
  },
  faqAnswerText: {
    fontSize: 13,
    color: "#666",
    lineHeight: 18,
  },
  contactInfo: {},
  contactItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  contactText: {
    marginLeft: 12,
    flex: 1,
  },
  contactTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 2,
  },
  contactValue: {
    fontSize: 13,
    color: "#666",
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
