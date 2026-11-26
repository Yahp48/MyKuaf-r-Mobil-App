import React from "react";
import { View, StyleSheet, Text, TouchableOpacity, ScrollView } from "react-native";
import { AntDesign as Icon } from '@expo/vector-icons';
import { MaterialIcons as MaterialIcon } from '@expo/vector-icons';
import { FontAwesome5 as FontAwesome5 } from '@expo/vector-icons';
import { FontAwesome6 as FontAwesome6 } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';

export default function ProfileScreen({ navigation }) {
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
          <FontAwesome6 name="bell" size={30} color="#fff" />
        </TouchableOpacity>
      </View>

     
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        
        <View style={styles.profileSection}>
          <View style={styles.profileImage}>
            <MaterialIcon name="edit" size={30} color="#FF4896" />
          </View>
          <Text style={styles.profileText}>Profil</Text>
        </View>

       
        <View style={styles.menuContainer}>
          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate("AccountSettings")}>
            <FontAwesome6 name="sliders" size={30} color="#FF4896" />
            <Text style={styles.menuText}>Hesap Ayarları</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate("Order")}>
            <FontAwesome6 name="shopping-bag" size={30} color="#FF4896" />
            <Text style={styles.menuText}>Siparişlerim</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate("Favorites")}>
            <FontAwesome6 name="heart" size={30} color="#FF4896" />
            <Text style={styles.menuText}>Favorilerim</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate("WalletScreen")}>
            <FontAwesome6 name="wallet" size={30} color="#FF4896" />
            <Text style={styles.menuText}>Cüzdanım</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate("Privacy")}>
            <FontAwesome6 name="lock" size={30} color="#FF4896" />
            <Text style={styles.menuText}>Gizlilik</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate("Reviews")}>
            <FontAwesome6 name="comment-alt" size={30} color="#FF4896" />
            <Text style={styles.menuText}>Değerlendirmelerim</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate("Language")}>
            <FontAwesome6 name="globe" size={30} color="#FF4896" />
            <Text style={styles.menuText}>Dil Seçimi (Beta)</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate("Support")}>
            <FontAwesome6 name="headset" size={30} color="#FF4896" />
            <Text style={styles.menuText}>Müşteri Hizmetleri</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate("Feedback")}>
            <FontAwesome6 name="star" size={30} color="#FF4896" />
            <Text style={styles.menuText}>Uygulama Geri Bildirimleri</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate("About")}>
            <FontAwesome6 name="info-circle" size={30} color="#FF4896" />
            <Text style={styles.menuText}>Hakkında</Text>
          </TouchableOpacity>
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
          <View style={styles.activeNavItem}>
            <FontAwesome6 name="user" size={24} color="#e00061" />
            <Text style={[styles.navText, styles.activeNavText]}>Profil</Text>
          </View>
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
    paddingBottom: 10,
  },
  logo: { color: "white", fontSize: 20, fontWeight: "bold" },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 80, 
  },
  profileSection: { alignItems: "center", marginVertical: 20 },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 50,
    backgroundColor: "#f8c8dc",
    justifyContent: "center",
    alignItems: "center",
  },
  profileText: { fontSize: 18, color: "#FF4896", marginTop: 10 },
  menuContainer: { paddingHorizontal: 20, paddingTop: 35 },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#FFD1DC",
  },
  menuText: { marginLeft: 15, fontSize: 20, color: "#FF4896", fontWeight: "500" },
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



