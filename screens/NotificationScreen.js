import React from "react";
import { View, StyleSheet, Text, TextInput, TouchableOpacity, Platform, StatusBar, ScrollView } from "react-native";
import { MaterialIcons as MaterialIcon } from '@expo/vector-icons';
import { AntDesign as Icon } from '@expo/vector-icons';
import { FontAwesome5 as FontAwesome5 } from '@expo/vector-icons';
import { FontAwesome6 as FontAwesome6 } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';

export default function NotificationScreen({ navigation }) {
  const { state } = useApp();
    const cartCount = state.cartItems.length;
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.navigate("Home")}>
            <Icon name="home" size={30} color="#fff" />
        </TouchableOpacity>
            <Text style={styles.logo}>WOMAN HAIR DESIGN</Text>
        <TouchableOpacity onPress={() => navigation.navigate("Notifications")}>
            <FontAwesome6 name="bell" size={30} color="#e00061" />
        </TouchableOpacity>
      </View>
      <Text style={styles.title}>Bildirimlerim</Text>
      <Text style={styles.message}>Henüz bildiriminiz yok</Text>



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
    title: { fontSize: 24, fontWeight: "bold", color: "#FF4896", marginTop:90, marginLeft:30},
    message: { fontSize: 16, color: "#888", marginTop: 100, marginLeft:110 },
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
