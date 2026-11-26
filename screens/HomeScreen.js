import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Platform,
  Alert,
  Modal,
  Image,
  Dimensions,
} from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { AntDesign as Icon } from '@expo/vector-icons';
import { MaterialIcons as MaterialIcon } from '@expo/vector-icons';
import { FontAwesome5 as FontAwesome5 } from '@expo/vector-icons';
import { FontAwesome6 as FontAwesome6 } from '@expo/vector-icons';
import * as Location from "expo-location";
const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
import polyline from "@mapbox/polyline";
import { useApp } from '../context/AppContext';

const { width, height } = Dimensions.get('window');


function HomeScreen({ navigation }) {
  const [searchText, setSearchText] = useState("");
  const [filteredSalons, setFilteredSalons] = useState([]);
  const [selectedSalon, setSelectedSalon] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [routeCoords, setRouteCoords] = useState([]);
  const [showAdModal, setShowAdModal] = useState(false);
  const { state } = useApp();
  const cartCount = state.cartItems.length;
  

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Konum İzni Gerekli", "Bu özelliği kullanmak için konum izni vermeniz gerekiyor.");
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    })();

    
    const timer = setTimeout(() => {
      setShowAdModal(true);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  const salons = [
    { id: 1, kuafor: "Zeynep Bayan Kuaför", rating: 4.0, openTime: "Açık", closeTime: "20:00", latitude: 39.150, longitude: 34.160, clock: 'Açık', sehir: 'Ahievran, Aşk Paşa Blv. No:29, 40100 Kırşehir Merkez/Kırşehir', website: 'zeynep.kuafor.com.tr' },
    { id: 2, kuafor: "Kentpark Kuaför", rating: 4.5, openTime: "Açık", closeTime: "19:00", latitude: 39.148, longitude: 34.165, clock: 'Açık', sehir: 'Kentpark, Kırşehir Merkez/Kırşehir', website: 'kentpark.kuafor.com.tr' },
    { id: 3, kuafor: "Atatürk Bulvarı Kuaför", rating: 4.2, openTime: "Açık", closeTime: "18:00", latitude: 39.142, longitude: 34.158, clock: 'Kapalı', sehir: 'Atatürk Bulvarı, Kırşehir Merkez/Kırşehir', website: 'atatürk.kuafor.com.tr' },
    { id: 4, kuafor: "Masal Parkı Kuaför", rating: 3.9, openTime: "Kapalı", closeTime: "17:00", latitude: 39.145, longitude: 34.168, clock: 'Kapalı', sehir: 'Masal Parkı, Kırşehir Merkez/Kırşehir', website: 'masalpark.kuafor.com.tr' },
    { id: 5, kuafor: "Hamidiye Kuaför", rating: 4.3, openTime: "Açık", closeTime: "20:00", latitude: 39.140, longitude: 34.155, clock: 'Açık', sehir: 'Hamidiye Cami, Kırşehir Merkez/Kırşehir', website: 'hamidiye.kuafor.com.tr' },
  ];

  const handleSearch = (text) => {
    setSearchText(text);
    if (text === "") {
      setFilteredSalons([]);
    } else {
      const results = salons.filter((salon) => salon.kuafor.toLowerCase().includes(text.toLowerCase()));
      setFilteredSalons(results);
    }
  };

  const closeDetails = () => {
    setSelectedSalon(null);
    setRouteCoords([]);
  };

  const handleMarkerPress = (salon) => {
    setSelectedSalon(salon);
    setRouteCoords([]);
  };

  const handleRandevuAl = () => {
    if (selectedSalon) {
      navigation.navigate("CalendarScreen", {
        salonName: selectedSalon.kuafor,
        sehir: selectedSalon.sehir,
      });
    }
  };

  const openDirections = async () => {
    if (!userLocation || !selectedSalon) {
      Alert.alert("Hata", "Konum veya hedef bulunamadı.");
      return;
    }

    const origin = `${userLocation.latitude},${userLocation.longitude}`;
    const destination = `${selectedSalon.latitude},${selectedSalon.longitude}`;
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&key=${GOOGLE_MAPS_API_KEY}`;

        try {
      const response = await fetch(url);
      const data = await response.json();

      if (data.routes.length) {
        const points = polyline.decode(data.routes[0].overview_polyline.points);
        const coords = points.map(([lat, lng]) => ({
          latitude: lat,
          longitude: lng,
        }));
        setRouteCoords(coords);
      } else {
        Alert.alert("Rota bulunamadı", "Google API'den sonuç alınamadı.");
      }
    } catch (error) {
      console.error("Rota alma hatası:", error); // ✅ artık error tanımlı
      Alert.alert("Hata", "Rota alınırken bir sorun oluştu.");
    }

  };

  const handleAdClick = () => {
    setShowAdModal(false);
    navigation.navigate('Shop');
  };

  const closeAdModal = () => {
    setShowAdModal(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <StatusBar backgroundColor="#FF4896" barStyle="light-content" />
        <Icon name="home" size={35} color="#fff" style={styles.icon} />
        <Text style={styles.logo}>WOMAN HAIR DESIGN</Text>
        <TouchableOpacity onPress={() => navigation.navigate("Notifications")}>
          <MaterialIcon name="notifications-none" size={35} color="#fff" />
        </TouchableOpacity>
      </View>

      <MapView
        style={styles.map}
        initialRegion={{
          latitude: 39.1451,
          longitude: 34.1605,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        {userLocation && (
          <Marker coordinate={userLocation} title="Benim Konumum" pinColor="blue" />
        )}
        {(filteredSalons.length > 0 ? filteredSalons : salons).map((salon) => (
          <Marker
            key={salon.id}
            coordinate={{ latitude: salon.latitude, longitude: salon.longitude }}
            title={salon.kuafor}
            onPress={() => handleMarkerPress(salon)}
          />
        ))}
        {routeCoords.length > 0 && (
          <Polyline coordinates={routeCoords} strokeColor="#FF4896" strokeWidth={4} />
        )}
      </MapView>

      <Modal
        visible={showAdModal}
        transparent={true}
        animationType="fade"
        onRequestClose={closeAdModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.adContainer}>
            <TouchableOpacity style={styles.closeButton} onPress={closeAdModal}>
              <Icon name="close" size={24} color="#333" />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.adContent} onPress={handleAdClick}>
              <View style={styles.adImageContainer}>
                <Image 
                  source={{ uri: 'https://images.unsplash.com/photo-1522338242992-e1a54906a8da?w=300&h=200&fit=crop&overlay=FF4896&blend=multiply&txt=YEN%C4%B0%20MA%C4%9EAZA&txt-size=30&txt-color=white&txt-align=center,middle' }}
                  style={styles.adImage}
                />
                <View style={styles.adBadge}>
                  <Text style={styles.adBadgeText}>YENİ!</Text>
                </View>
              </View>
              
              <View style={styles.adTextContainer}>
                <Text style={styles.adTitle}>🛍️ Mağazamız Açıldı!</Text>
                <Text style={styles.adDescription}>
                  Profesyonel saç bakım ürünleri ve araçları artık sizlerle! 
                  İlk alışverişinizde %20 indirim fırsatını kaçırmayın.
                </Text>
                <View style={styles.adButtonContainer}>
                  <Text style={styles.adButton}>🛒 Mağazayı Keşfet</Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {selectedSalon && (
        <ScrollView style={styles.detailsContainer}>
          <TouchableOpacity style={styles.closeButton} onPress={closeDetails}>
            <Text style={styles.closeButtonText}>×</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.dragButton}>
            <Text style={styles.dragButtonText}></Text>
          </TouchableOpacity>

          <Text style={styles.salonName}>{selectedSalon.kuafor}</Text>
          <View style={styles.ratingContainerR}>
            <View style={styles.ratingContainer}>
              <Text style={styles.rating}>{selectedSalon.rating} ⭐⭐⭐⭐</Text>
              <Text style={styles.hours}>{selectedSalon.openTime} - Kapanış: {selectedSalon.closeTime}</Text>
            </View>

            <TouchableOpacity style={styles.buttonR} onPress={handleRandevuAl}>
              <FontAwesome5 name="calendar-alt" size={35} color="#FF4896" />
              <Text style={styles.buttonTextR}>Randevu Al</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.buttonsContainer}>
            <TouchableOpacity style={styles.button} onPress={openDirections}>
              <MaterialIcon name="directions" size={20} color="#fff" />
              <Text style={styles.buttonText}>Yol Tarifi</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button}>
              <MaterialIcon name="call" size={20} color="#fff" />
              <Text style={styles.buttonText}>Ara</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button}>
              <MaterialIcon name="call" size={20} color="#fff" />
              <Text style={styles.buttonText}>Kaydet</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button}>
              <MaterialIcon name="call" size={20} color="#fff" />
              <Text style={styles.buttonText}>Paylaş</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.imagePlaceholder}></View>
          <View style={styles.additionalInfo}>
            <Text style={styles.address}>{selectedSalon.sehir}</Text>
            <Text style={styles.clock}>Saat: {selectedSalon.clock} - Kapanış: {selectedSalon.closeTime}</Text>
            <Text style={styles.website}>{selectedSalon.website}</Text>
          </View>
        </ScrollView>
      )}

      
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
          <View style={styles.activeNavItem}>
            <FontAwesome5 name="map-marked-alt" size={24} color="#e00061" />
            <Text style={[styles.navText, styles.activeNavText]}>Harita</Text>
          </View>
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
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FF4896',
    paddingTop: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight + 10,
    paddingHorizontal: 20,
    paddingBottom: 15,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  logo: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
  },
  map: {
    flex: 1,
  },
  
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  adContainer: {
    backgroundColor: 'white',
    width: width * 0.85,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  closeButton: {
    position: 'absolute',
    top: 15,
    right: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    elevation: 5,
  },
  adContent: {
    width: '100%',
  },
  adImageContainer: {
    position: 'relative',
    height: 180,
  },
  adImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  adBadge: {
    position: 'absolute',
    top: 15,
    left: 15,
    backgroundColor: '#e00061',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  adBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  adTextContainer: {
    padding: 20,
  },
  adTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  adDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  adButtonContainer: {
    backgroundColor: '#FF4896',
    borderRadius: 25,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  adButton: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Existing styles
  detailsContainer: {
    position: "absolute",
    bottom: 0,
    backgroundColor: "#fff",
    width: "100%",
    padding: 10,
    paddingLeft: 25,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    elevation: 10,
    flexGrow: 1,
  },
  salonName: {
    top: 30,
    fontSize: 20,
    fontWeight: "bold",
  },
  ratingContainer: {
    flexDirection: "column",
    alignItems: "flex-start",
    marginTop: 1,
  },
  ratingContainerR: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    top: 25,
  },
  rating: {
    fontSize: 16,
    color: "#FF4896",
    marginRight: 5,
  },
  hours: {
    fontSize: 14,
    color: "#666",
  },
  imagePlaceholder: {
    width: "100%",
    height: 150,
    backgroundColor: "#ccc",
    borderRadius: 10,
    marginTop: 10,
    top: 30,
  },
  buttonsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
    top: 30,
  },
  button: {
    backgroundColor: "#FF4896",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    marginRight: 10,
  },
  buttonR: {
    backgroundColor: "#fff",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    flexDirection: "column",
    alignItems: "center",
    marginLeft: 70,
  },
  buttonText: {
    color: "#fff",
    marginLeft: 5,
    fontWeight: "bold",
  },
  buttonTextR: {
    color: "#FF4896",
    marginLeft: 5,
    fontWeight: "bold",
  },
  additionalInfo: {
    marginTop: 20,
    top: 25,
  },
  address: {
    fontSize: 14,
    color: "#333",
  },
  clock: {
    fontSize: 14,
    color: "#333",
    top: 10,
  },
  website: {
    fontSize: 14,
    color: "#FF4896",
    top: 20,
  },
  closeButtonText: {
    color: "#333", 
    fontSize: 16,
    fontWeight: "bold",
  },
  dragButton: {
    position: "absolute",
    top: 1,
    left: "50%",
    transform: [{ translateX: -15 }],
    backgroundColor: "#ebebeb", 
    borderRadius: 10,
    paddingRight: 25,
    paddingLeft: 25,
    zIndex: 3,
  },
  dragButtonText: {
    fontSize: 5,
    color: "#333",
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
  activeNavItem: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  activeNavText: {
    color: '#e00061',
    fontWeight: 'bold',
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

export default HomeScreen;