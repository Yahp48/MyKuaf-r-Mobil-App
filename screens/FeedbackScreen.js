import React, { useState } from "react";
import { View, StyleSheet, Text, TouchableOpacity, ScrollView, TextInput, Alert } from "react-native";
import { AntDesign as Icon } from '@expo/vector-icons';
import { FontAwesome5 as FontAwesome5 } from '@expo/vector-icons';
import { FontAwesome6 as FontAwesome6 } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';

export default function FeedbackScreen({ navigation }) {
  const [selectedRating, setSelectedRating] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [email, setEmail] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const { state } = useApp();
  const cartCount = state.cartItems.length;

  const feedbackCategories = [
    {
      id: "ui",
      title: "Tasarım & Arayüz",
      icon: "palette",
      color: "#8b5cf6"
    },
    {
      id: "performance",
      title: "Performans",
      icon: "tachometer-alt",
      color: "#ef4444"
    },
    {
      id: "features",
      title: "Özellikler",
      icon: "star",
      color: "#f59e0b"
    },
    {
      id: "booking",
      title: "Randevu Sistemi",
      icon: "calendar-check",
      color: "#3b82f6"
    },
    {
      id: "search",
      title: "Arama & Filtreleme",
      icon: "search",
      color: "#10b981"
    },
    {
      id: "other",
      title: "Diğer",
      icon: "comment-dots",
      color: "#6b7280"
    }
  ];

  const ratingLabels = {
    1: "Çok Kötü",
    2: "Kötü", 
    3: "Orta",
    4: "İyi",
    5: "Mükemmel"
  };

  const submitFeedback = () => {
    if (selectedRating === 0) {
      Alert.alert("Uyarı", "Lütfen bir puan verin.");
      return;
    }
    if (!selectedCategory) {
      Alert.alert("Uyarı", "Lütfen bir kategori seçin.");
      return;
    }
    if (!feedback.trim()) {
      Alert.alert("Uyarı", "Lütfen geri bildiriminizi yazın.");
      return;
    }
    if (!isAnonymous && !email.trim()) {
      Alert.alert("Uyarı", "Lütfen e-posta adresinizi girin veya anonim gönderimi seçin.");
      return;
    }

    Alert.alert(
      "Geri Bildirim Gönderildi",
      "Değerli geri bildiriminiz için teşekkürler! Görüşleriniz bizim için çok önemli.",
      [
        {
          text: "Tamam",
          onPress: () => {
            setSelectedRating(0);
            setSelectedCategory(null);
            setFeedback("");
            setEmail("");
            setIsAnonymous(false);
            navigation.goBack();
          }
        }
      ]
    );
  };

  const renderStars = () => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => setSelectedRating(star)}
            style={styles.starButton}
          >
            <FontAwesome6
              name="star"
              size={32}
              color={star <= selectedRating ? "#f59e0b" : "#e5e7eb"}
              solid={star <= selectedRating}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const CategoryCard = ({ category }) => (
    <TouchableOpacity
      style={[
        styles.categoryCard,
        selectedCategory === category.id && styles.selectedCategoryCard
      ]}
      onPress={() => setSelectedCategory(category.id)}
    >
      <View style={[styles.categoryIcon, { backgroundColor: category.color }]}>
        <FontAwesome5 name={category.icon} size={18} color="#fff" />
      </View>
      <Text style={[
        styles.categoryTitle,
        selectedCategory === category.id && styles.selectedCategoryTitle
      ]}>
        {category.title}
      </Text>
      {selectedCategory === category.id && (
        <FontAwesome6 name="check-circle" size={18} color={category.color} />
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrowleft" size={30} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.logo}>GERİ BİLDİRİM</Text>
        <TouchableOpacity onPress={() => navigation.navigate("Notifications")}>
          <FontAwesome6 name="bell" size={30} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        
        <View style={styles.welcomeCard}>
          <FontAwesome6 name="heart" size={40} color="#FF4896" />
          <Text style={styles.welcomeTitle}>Görüşleriniz Bizim İçin Değerli!</Text>
          <Text style={styles.welcomeText}>
            Woman Hair Design uygulamasını nasıl buluyorsunuz? 
            Geri bildirimleriniz uygulamayı daha iyi hale getirmemize yardımcı oluyor.
          </Text>
        </View>

     
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⭐ Genel Memnuniyet</Text>
          <Text style={styles.ratingQuestion}>Uygulamamızı nasıl değerlendiriyorsunuz?</Text>
          
          {renderStars()}
          
          {selectedRating > 0 && (
            <View style={styles.ratingLabel}>
              <Text style={styles.ratingLabelText}>
                {ratingLabels[selectedRating]}
              </Text>
            </View>
          )}
        </View>

        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📂 Konu Kategorisi</Text>
          <Text style={styles.categoryQuestion}>Hangi konuda geri bildirim vermek istiyorsunuz?</Text>
          
          <View style={styles.categoriesGrid}>
            {feedbackCategories.map((category) => (
              <CategoryCard key={category.id} category={category} />
            ))}
          </View>
        </View>

       
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💬 Geri Bildiriminiz</Text>
          <Text style={styles.feedbackQuestion}>
            Detaylı görüşlerinizi paylaşın. Önerileriniz, şikayetleriniz veya beğendiklerinizi belirtin.
          </Text>
          
          <TextInput
            style={styles.feedbackInput}
            value={feedback}
            onChangeText={setFeedback}
            placeholder="Geri bildiriminizi buraya yazın..."
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
        </View>

        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📧 İletişim Tercihi</Text>
          
          <View style={styles.contactOptions}>
            <TouchableOpacity
              style={[
                styles.contactOption,
                !isAnonymous && styles.selectedContactOption
              ]}
              onPress={() => setIsAnonymous(false)}
            >
              <FontAwesome6 
                name={!isAnonymous ? "check-circle" : "circle"} 
                size={20} 
                color={!isAnonymous ? "#FF4896" : "#ccc"} 
              />
              <Text style={styles.contactOptionText}>
                E-posta ile dönüş istiyorum
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.contactOption,
                isAnonymous && styles.selectedContactOption
              ]}
              onPress={() => setIsAnonymous(true)}
            >
              <FontAwesome6 
                name={isAnonymous ? "check-circle" : "circle"} 
                size={20} 
                color={isAnonymous ? "#FF4896" : "#ccc"} 
              />
              <Text style={styles.contactOptionText}>
                Anonim gönder
              </Text>
            </TouchableOpacity>
          </View>

          {!isAnonymous && (
            <View style={styles.emailContainer}>
              <Text style={styles.emailLabel}>E-posta Adresiniz</Text>
              <TextInput
                style={styles.emailInput}
                value={email}
                onChangeText={setEmail}
                placeholder="e-posta@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          )}
        </View>

       
        <View style={styles.submitContainer}>
          <TouchableOpacity style={styles.submitButton} onPress={submitFeedback}>
            <FontAwesome6 name="paper-plane" size={16} color="#fff" />
            <Text style={styles.submitButtonText}>Geri Bildirim Gönder</Text>
          </TouchableOpacity>
        </View>

        
        <View style={styles.infoCard}>
          <FontAwesome6 name="info-circle" size={24} color="#3b82f6" />
          <Text style={styles.infoTitle}>Geri Bildirim Politikası</Text>
          <Text style={styles.infoText}>
            • Tüm geri bildirimler değerlendirilir{"\n"}
            • Kişisel bilgileriniz korunur{"\n"}
            • Yapıcı eleştiriler özellikle değerlidir{"\n"}
            • Yanıt süresi: 1-3 iş günü
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
  welcomeCard: {
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
  welcomeTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginTop: 10,
    marginBottom: 10,
  },
  welcomeText: {
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
    marginBottom: 10,
  },
  ratingQuestion: {
    fontSize: 14,
    color: "#666",
    marginBottom: 20,
  },
  starsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  starButton: {
    padding: 5,
    marginHorizontal: 2,
  },
  ratingLabel: {
    alignItems: "center",
    marginTop: 10,
  },
  ratingLabelText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#f59e0b",
  },
  categoryQuestion: {
    fontSize: 14,
    color: "#666",
    marginBottom: 15,
  },
  categoriesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  categoryCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    width: "48%",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  selectedCategoryCard: {
    borderColor: "#FF4896",
    backgroundColor: "#fef2f7",
  },
  categoryIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  categoryTitle: {
    fontSize: 12,
    fontWeight: "500",
    color: "#333",
    flex: 1,
  },
  selectedCategoryTitle: {
    color: "#FF4896",
    fontWeight: "600",
  },
  feedbackQuestion: {
    fontSize: 14,
    color: "#666",
    marginBottom: 15,
  },
  feedbackInput: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    height: 120,
    textAlignVertical: "top",
    backgroundColor: "#fff",
  },
  contactOptions: {
    marginBottom: 15,
  },
  contactOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  selectedContactOption: {},
  contactOptionText: {
    fontSize: 14,
    color: "#333",
    marginLeft: 10,
  },
  emailContainer: {
    marginTop: 10,
  },
  emailLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  emailInput: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    backgroundColor: "#fff",
  },
  submitContainer: {
    paddingHorizontal: 15,
    marginBottom: 15,
  },
  submitButton: {
    flexDirection: "row",
    backgroundColor: "#FF4896",
    paddingVertical: 15,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 8,
  },
  infoCard: {
    backgroundColor: "#fff",
    marginHorizontal: 15,
    marginBottom: 15,
    borderRadius: 15,
    padding: 20,
    borderLeftWidth: 4,
    borderLeftColor: "#3b82f6",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 10,
  },
  infoText: {
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