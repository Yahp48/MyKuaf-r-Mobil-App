import React from "react";
import { View, StyleSheet, Text, TextInput, TouchableOpacity, Platform, StatusBar, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Icon from "react-native-vector-icons/AntDesign";
import FontAwesome5 from "react-native-vector-icons/FontAwesome5";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";
import AntDesign from "react-native-vector-icons/AntDesign";
import MaterialIcon from "react-native-vector-icons/MaterialIcons";
import { useApp } from '../context/AppContext';

export default function WalletScreen({ navigation }) {
  const { state } = useApp();
    const cartCount = state.cartItems.length;
  return (
    <View style={styles.container}>
  
      <View style={styles.header}>
              <TouchableOpacity onPress={() => navigation.navigate("")}>
                <Icon name="home" size={30} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.logo}>WOMAN HAIR DESIGN</Text>
              <TouchableOpacity onPress={() => navigation.navigate("Notifications")}>
                <FontAwesome6 name="bell" size={30} color="#fff" />
              </TouchableOpacity>
      </View>

    
      <LinearGradient colors={["#FF4896", "#5A189A"]} style={styles.walletContainer}>
        <View style={styles.walletContent}>
          <View style={styles.walletInfo}>
            <Text style={styles.title}>Cüzdanım</Text>
            <Text style={styles.balanceLabel}>Bakiyem</Text>
            <Text style={styles.balance}>0 TL</Text>
          </View>
          <View style={styles.walletActions}>
          <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('LoadMoney')}>
  <FontAwesome6 name="wallet" size={35} color="#fff" />
  <Text style={styles.actionText}>Yükle</Text>
</TouchableOpacity>

            <TouchableOpacity style={styles.actionButton}>
              <FontAwesome6 name="arrow-right-arrow-left" size={35} color="#fff" />
              <Text style={styles.actionText}>Gönder</Text>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      
      <View style={styles.transactionContainer}>
        <Text style={styles.transactionTitle}>Son Hareketler</Text>
        <Text style={styles.noTransaction}>Henüz işlem yapmadınız</Text>
      </View>

      
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
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FF4896",
    paddingTop: 15,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  logo: { color: "white", fontSize: 20, fontWeight: "bold" },
  walletContainer: {
    paddingVertical: 20,
    paddingHorizontal: 25,
    borderBottomLeftRadius: 80,
    borderBottomRightRadius: 0,
    paddingLeft: 30,
    paddingBottom: 40,
  },
  walletContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  walletInfo: {
    alignItems: "flex-start",
  },
  title: { fontSize: 40, color: "#fff", fontWeight: "bold", marginTop: -30, marginLeft: 13 },
  balanceLabel: { fontSize: 16, color: "#fff", marginTop: 20, marginLeft: 15 },
  balance: { fontSize: 40, color: "#fff", fontWeight: "bold", marginTop: 2, marginLeft: 15 },
  walletActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionButton: {
    flexDirection: "column",
    alignItems: "center",
    marginLeft: 25,
  },
  actionText: { color: "#fff", marginTop: 5, fontWeight: "bold", fontSize: 14 },
  transactionContainer: {
    padding: 20,
  },
  transactionTitle: { fontSize: 18, fontWeight: "bold", color: "#333" },
  noTransaction: { color: "#FF4896", marginTop: 40, textAlign: "center" },
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
