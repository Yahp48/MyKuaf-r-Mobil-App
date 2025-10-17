import React, { useState, useEffect } from "react";
import { View, StyleSheet, Text, TouchableOpacity, ScrollView, Alert, TextInput, Modal } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Icon from "react-native-vector-icons/AntDesign";
import FontAwesome5 from "react-native-vector-icons/FontAwesome5";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";
import { useApp } from '../context/AppContext';

export default function ReviewsScreen({ navigation }) {
  const { state } = useApp();
    const cartCount = state.cartItems.length;
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingReview, setEditingReview] = useState(null);
  const [editText, setEditText] = useState("");
  const [editRating, setEditRating] = useState(5);

  useEffect(() => {
    loadReviews();
  }, []);

  const loadReviews = async () => {
    try {
      const savedReviews = await AsyncStorage.getItem("userReviews");
      if (savedReviews) {
        setReviews(JSON.parse(savedReviews));
      } else {
        
        setReviews([
          {
            id: "1",
            salonName: "Glam Hair Studio",
            salonAddress: "Kadıköy, İstanbul",
            rating: 5,
            comment: "Harika bir deneyimdi! Saçlarım mükemmel oldu ve personel çok ilgiliydi.",
            date: "2025-01-10",
            serviceType: "Saç Kesimi ve Boyama"
          },
          {
            id: "2",
            salonName: "Elite Beauty Center",
            salonAddress: "Beşiktaş, İstanbul",
            rating: 4,
            comment: "Güzel bir salon, fiyatlar biraz yüksek ama kaliteli hizmet alıyorsunuz.",
            date: "2025-01-05",
            serviceType: "Keratin Bakımı"
          },
          {
            id: "3",
            salonName: "Beauty Paradise",
            salonAddress: "Şişli, İstanbul",
            rating: 3,
            comment: "Ortalama bir deneyim. Randevu saatinde gecikmeler oldu.",
            date: "2024-12-28",
            serviceType: "Saç Kesimi"
          }
        ]);
      }
    } catch (error) {
      console.error("Değerlendirmeler yüklenirken hata:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveReviews = async (updatedReviews) => {
    try {
      await AsyncStorage.setItem("userReviews", JSON.stringify(updatedReviews));
    } catch (error) {
      console.error("Değerlendirmeler kaydedilirken hata:", error);
    }
  };

  const deleteReview = (id) => {
    Alert.alert(
      "Değerlendirmeyi Sil",
      "Bu değerlendirmeyi silmek istediğinizden emin misiniz?",
      [
        { text: "İptal", style: "cancel" },
        {
          text: "Sil",
          style: "destructive",
          onPress: () => {
            const updatedReviews = reviews.filter(review => review.id !== id);
            setReviews(updatedReviews);
            saveReviews(updatedReviews);
          }
        }
      ]
    );
  };

  const editReview = (review) => {
    setEditingReview(review);
    setEditText(review.comment);
    setEditRating(review.rating);
    setEditModalVisible(true);
  };

  const saveEditedReview = () => {
    const updatedReviews = reviews.map(review =>
      review.id === editingReview.id
        ? { ...review, comment: editText, rating: editRating }
        : review
    );
    setReviews(updatedReviews);
    saveReviews(updatedReviews);
    setEditModalVisible(false);
    setEditingReview(null);
  };

  const renderStars = (rating, onPress = null) => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => onPress && onPress(star)}
            disabled={!onPress}
          >
            <FontAwesome6
              name="star"
              size={20}
              color={star <= rating ? "#f59e0b" : "#e5e7eb"}
              solid={star <= rating}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const ReviewCard = ({ review }) => (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <View style={styles.salonInfo}>
          <Text style={styles.salonName}>{review.salonName}</Text>
          <Text style={styles.salonAddress}>📍 {review.salonAddress}</Text>
        </View>
        <View style={styles.reviewActions}>
          <TouchableOpacity onPress={() => editReview(review)}>
            <FontAwesome6 name="edit" size={16} color="#3b82f6" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => deleteReview(review.id)} style={styles.deleteButton}>
            <FontAwesome6 name="trash-alt" size={16} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.reviewContent}>
        <View style={styles.ratingRow}>
          {renderStars(review.rating)}
          <Text style={styles.reviewDate}>{review.date}</Text>
        </View>
        <Text style={styles.serviceType}>🎯 {review.serviceType}</Text>
        <Text style={styles.reviewComment}>{review.comment}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrowleft" size={30} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.logo}>DEĞERLENDİRMELERİM</Text>
        <TouchableOpacity onPress={() => navigation.navigate("Notifications")}>
          <FontAwesome6 name="bell" size={30} color="#fff" />
        </TouchableOpacity>
      </View>

      
      <ScrollView style={styles.content}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Değerlendirmeler yükleniyor...</Text>
          </View>
        ) : reviews.length > 0 ? (
          <View style={styles.reviewsContainer}>
            <Text style={styles.reviewsCount}>⭐ {reviews.length} değerlendirmeniz var</Text>
            <Text style={styles.averageRating}>
              Ortalama Puanınız: {(reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)} ⭐
            </Text>
            {reviews.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <FontAwesome6 name="star" size={60} color="#ccc" />
            <Text style={styles.emptyText}>Henüz değerlendirmeniz bulunmuyor</Text>
            <Text style={styles.emptySubtext}>Gittiğiniz kuaförleri değerlendirerek diğer kullanıcılara yardımcı olabilirsiniz</Text>
            <TouchableOpacity 
              style={styles.exploreButton}
              onPress={() => navigation.navigate("Home")}
            >
              <Text style={styles.exploreButtonText}>Kuaförleri Keşfet</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

     
      <Modal
        visible={editModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Değerlendirmeyi Düzenle</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <FontAwesome6 name="times" size={20} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.editForm}>
              <Text style={styles.editLabel}>Puanınız:</Text>
              {renderStars(editRating, setEditRating)}

              <Text style={styles.editLabel}>Yorumunuz:</Text>
              <TextInput
                style={styles.editTextInput}
                value={editText}
                onChangeText={setEditText}
                placeholder="Deneyiminizi paylaşın..."
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={styles.cancelButton}
                  onPress={() => setEditModalVisible(false)}
                >
                  <Text style={styles.cancelButtonText}>İptal</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.saveButton}
                  onPress={saveEditedReview}
                >
                  <Text style={styles.saveButtonText}>Kaydet</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

     
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
  logo: { color: "white", fontSize: 16, fontWeight: "bold" },
  content: { flex: 1, paddingBottom: 80 },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  loadingText: { fontSize: 16, color: "#666", marginTop: 20 },
  reviewsContainer: { padding: 15 },
  reviewsCount: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 5,
    textAlign: "center",
  },
  averageRating: {
    fontSize: 14,
    color: "#f59e0b",
    marginBottom: 20,
    textAlign: "center",
    fontWeight: "600",
  },
  reviewCard: {
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  reviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  salonInfo: { flex: 1 },
  salonName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 2,
  },
  salonAddress: { fontSize: 12, color: "#666" },
  reviewActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  deleteButton: { marginLeft: 15 },
  reviewContent: {},
  ratingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  starsContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  reviewDate: { fontSize: 12, color: "#666" },
  serviceType: {
    fontSize: 12,
    color: "#FF4896",
    fontWeight: "500",
    marginBottom: 8,
  },
  reviewComment: {
    fontSize: 14,
    color: "#333",
    lineHeight: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    color: "#666",
    textAlign: "center",
    marginTop: 20,
    marginBottom: 10,
    fontWeight: "bold",
  },
  emptySubtext: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
    marginBottom: 30,
    lineHeight: 20,
  },
  exploreButton: {
    backgroundColor: "#FF4896",
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  exploreButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    width: "90%",
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  editForm: {},
  editLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 10,
    marginTop: 15,
  },
  editTextInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    height: 100,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  cancelButton: {
    flex: 1,
    backgroundColor: "#f1f5f9",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginRight: 10,
  },
  cancelButtonText: {
    color: "#666",
    fontSize: 16,
    fontWeight: "600",
  },
  saveButton: {
    flex: 1,
    backgroundColor: "#FF4896",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginLeft: 10,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
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