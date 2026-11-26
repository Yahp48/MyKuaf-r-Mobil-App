import React, { useState, useEffect } from "react";
import { View, StyleSheet, Text, TouchableOpacity, ScrollView, Image, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AntDesign as Icon } from '@expo/vector-icons';
import { FontAwesome5 as FontAwesome5 } from '@expo/vector-icons';
import { FontAwesome6 as FontAwesome6 } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';

export default function FavoritesScreen({ navigation }) {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
    const { state } = useApp();
    const cartCount = state.cartItems.length;

  useEffect(() => {
    loadFavorites();
  }, []);

  const loadFavorites = async () => {
    try {
      const savedFavorites = await AsyncStorage.getItem("favorites");
      if (savedFavorites) {
        setFavorites(JSON.parse(savedFavorites));
      } else {
        
        setFavorites([
          {
            id: "1",
            name: "Glam Hair Studio",
            address: "Kadıköy, İstanbul",
            rating: 4.8,
            price: "₺150-250",
            image: "https://via.placeholder.com/100x100",
            services: ["Saç Kesimi", "Boyama", "Fön"]
          },
          {
            id: "2",
            name: "Elite Beauty Center",
            address: "Beşiktaş, İstanbul",
            rating: 4.9,
            price: "₺200-300",
            image: "https://via.placeholder.com/100x100",
            services: ["Makyaj", "Saç Bakımı", "Keratin"]
          }
        ]);
      }
    } catch (error) {
      console.error("Favoriler yüklenirken hata:", error);
    } finally {
      setLoading(false);
    }
  };

  const removeFavorite = async (id) => {
    Alert.alert(
      "Favorilerden Çıkar",
      "Bu kuaförü favorilerden çıkarmak istediğinizden emin misiniz?",
      [
        { text: "İptal", style: "cancel" },
        {
          text: "Çıkar",
          style: "destructive",
          onPress: async () => {
            const updatedFavorites = favorites.filter(item => item.id !== id);
            setFavorites(updatedFavorites);
            await AsyncStorage.setItem("favorites", JSON.stringify(updatedFavorites));
          }
        }
      ]
    );
  };

  const FavoriteCard = ({ item }) => (
    <View style={styles.favoriteCard}>
      <Image source={{ uri: item.image }} style={styles.favoriteImage} />
      <View style={styles.favoriteInfo}>
        <View style={styles.favoriteHeader}>
          <Text style={styles.favoriteName}>{item.name}</Text>
          <TouchableOpacity onPress={() => removeFavorite(item.id)}>
            <FontAwesome6 name="heart-crack" size={20} color="#ef4444" />
          </TouchableOpacity>
        </View>
        <Text style={styles.favoriteAddress}>📍 {item.address}</Text>
        <View style={styles.favoriteDetails}>
          <Text style={styles.favoriteRating}>⭐ {item.rating}</Text>
          <Text style={styles.favoritePrice}>{item.price}</Text>
        </View>
        <View style={styles.servicesContainer}>
          {item.services.slice(0, 3).map((service, index) => (
            <View key={index} style={styles.serviceTag}>
              <Text style={styles.serviceText}>{service}</Text>
            </View>
          ))}
        </View>
        <TouchableOpacity 
          style={styles.bookButton}
          onPress={() => navigation.navigate("BookAppointment", { salon: item })}
        >
          <Text style={styles.bookButtonText}>Randevu Al</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrowleft" size={30} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.logo}>FAVORİLERİM</Text>
        <TouchableOpacity onPress={() => navigation.navigate("Notifications")}>
          <FontAwesome6 name="bell" size={30} color="#fff" />
        </TouchableOpacity>
      </View>

      
      <ScrollView style={styles.content}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Favoriler yükleniyor...</Text>
          </View>
        ) : favorites.length > 0 ? (
          <View style={styles.favoritesContainer}>
            <Text style={styles.favoritesCount}>💖 {favorites.length} favori kuaförünüz</Text>
            {favorites.map((item) => (
              <FavoriteCard key={item.id} item={item} />
            ))}
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <FontAwesome6 name="heart" size={60} color="#ccc" />
            <Text style={styles.emptyText}>Henüz favori kuaförünüz bulunmuyor</Text>
            <Text style={styles.emptySubtext}>Beğendiğiniz kuaförleri favorilere ekleyerek kolayca ulaşabilirsiniz</Text>
            <TouchableOpacity 
              style={styles.exploreButton}
              onPress={() => navigation.navigate("Home")}
            >
              <Text style={styles.exploreButtonText}>Kuaförleri Keşfet</Text>
            </TouchableOpacity>
          </View>
        )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  loadingText: { fontSize: 16, color: "#666", marginTop: 20 },
  favoritesContainer: { padding: 15 },
  favoritesCount: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 15,
    textAlign: "center",
  },
  favoriteCard: {
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    flexDirection: "row",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  favoriteImage: {
    width: 80,
    height: 80,
    borderRadius: 10,
    marginRight: 15,
  },
  favoriteInfo: { flex: 1 },
  favoriteHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 5,
  },
  favoriteName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    flex: 1,
  },
  favoriteAddress: { fontSize: 12, color: "#666", marginBottom: 5 },
  favoriteDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  favoriteRating: { fontSize: 12, color: "#f59e0b" },
  favoritePrice: { fontSize: 12, fontWeight: "bold", color: "#FF4896" },
  servicesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 10,
  },
  serviceTag: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginRight: 5,
    marginBottom: 3,
  },
  serviceText: { fontSize: 10, color: "#666" },
  bookButton: {
    backgroundColor: "#FF4896",
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  bookButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
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