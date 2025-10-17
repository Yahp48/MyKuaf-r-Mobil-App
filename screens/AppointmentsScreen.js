import React, { useEffect, useState } from "react";
import { View, StyleSheet, Text, TouchableOpacity, ScrollView, Platform, StatusBar } from "react-native";
import MaterialIcon from "react-native-vector-icons/MaterialIcons";
import Icon from "react-native-vector-icons/AntDesign";
import FontAwesome5 from "react-native-vector-icons/FontAwesome5";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";
import { useApp } from '../context/AppContext';

export default function AppointmentsScreen({ navigation }) {
  const [appointments, setAppointments] = useState([]);
  const { state } = useApp();
const cartCount = state.cartItems.length;

  useEffect(() => {
    fetch("http://192.168.187.117:5000/api/appointments")
      .then((res) => res.json())
      .then((data) => setAppointments(data))
      .catch((err) => console.error("Randevu verisi alınamadı:", err));
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.navigate("Home")}> 
          <Icon name="home" size={30} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.logo}>WOMAN HAIR DESIGN</Text>
        <TouchableOpacity onPress={() => navigation.navigate("Notifications")}> 
          <FontAwesome6 name="bell" size={30} color="#fff" />
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>Randevularım</Text>
      <ScrollView style={styles.scrollArea}>
        {appointments.length === 0 ? (
          <Text style={styles.message}>Henüz randevunuz yok</Text>
        ) : (
          appointments.map((appointment) => (
            <View key={appointment._id} style={styles.card}>
              <Text style={styles.cardText}>Ad: {appointment.ad}</Text>
              <Text style={styles.cardText}>Telefon: {appointment.telefon}</Text>
              <Text style={styles.cardText}>Tarih: {appointment.tarih}</Text>
              <Text style={styles.cardText}>Saat: {appointment.saat}</Text>
              <Text style={styles.cardText}>Personel: {appointment.personel}</Text>
              <Text style={styles.cardText}>Kuaför: {appointment.kuafor}</Text>
              <Text style={styles.cardText}>Şehir: {appointment.sehir}</Text>
              <Text style={styles.cardText}>Durum: {appointment.status}</Text>
            </View>
          ))
        )}
      </ScrollView>

      <View style={styles.bottomNav}>
        <TouchableOpacity onPress={() => navigation.navigate("Appointments")} style={styles.navButton}>
          <View style={styles.activeNavItem}>
            <FontAwesome5 name="calendar-alt" size={24} color="#e00061" />
            <Text style={[styles.navText, styles.activeNavText]}>Randevular</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate("Home")} style={styles.navButton}>
          <FontAwesome5 name="map-marked-alt" size={24} color="#fff" />
          <Text style={styles.navText}>Harita</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate("Shop")} style={styles.navButton}>
          <FontAwesome5 name="shopping-bag" size={28} color="#fff" />
          {cartCount > 0 && (
            <View style={styles.navCartBadge}>
              <Text style={styles.navCartBadgeText}>{cartCount > 99 ? '99+' : cartCount}</Text>
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
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FF4896",
    paddingTop: Platform.OS === "ios" ? 20 : StatusBar.currentHeight - 35,
    paddingHorizontal: 20,
    paddingBottom: 10,
    position: "absolute",
    width: "100%",
    top: 0,
    zIndex: 2,
  },
  logo: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FF4896",
    marginTop: 90,
    marginLeft: 30,
  },
  scrollArea: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  message: {
    fontSize: 16,
    color: "#888",
    marginTop: 100,
    textAlign: "center",
  },
  card: {
    backgroundColor: "#f9f9f9",
    padding: 15,
    marginVertical: 10,
    borderRadius: 10,
    elevation: 2,
  },
  cardText: {
    fontSize: 14,
    color: "#333",
    marginBottom: 5,
  },
  bottomNav: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    backgroundColor: "#FF4896",
    height: 65,
    position: "absolute",
    bottom: 0,
    width: "100%",
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
