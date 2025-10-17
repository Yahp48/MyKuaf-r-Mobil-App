import React, { useState, useEffect } from "react";
import { View, StyleSheet, Text, TouchableOpacity, ScrollView, RefreshControl, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Icon from "react-native-vector-icons/AntDesign";
import MaterialIcon from "react-native-vector-icons/MaterialIcons";
import FontAwesome5 from "react-native-vector-icons/FontAwesome5";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";
import { useApp } from '../context/AppContext';

export default function OrdersScreen({ navigation }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { state } = useApp();
    const cartCount = state.cartItems.length;

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      const userData = await AsyncStorage.getItem("user");
      const user = JSON.parse(userData);

     const response = await fetch(`http://192.168.244.116:5000/api/orders`, {
  method: "GET",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
});

      const data = await response.json();
      if (response.ok) {
        setOrders(data.orders || []);
      } else {
        Alert.alert("Hata", data.message || "Siparişler yüklenemedi");
      }
    } catch (error) {
      console.error("Siparişler yüklenirken hata:", error);
     
      setOrders([
        {
          _id: "1",
          id: "ORD-2025-001",
          total: 299.99,
          status: "Teslim Edildi",
          orderDate: "2025-01-15",
          deliveryDate: "2025-01-18",
          trackingNumber: "TRK123456789",
          items: [
            { name: "Premium Saç Şampuanı", quantity: 2, price: 89.99 },
            { name: "Keratin Bakım Maskesi", quantity: 1, price: 149.99 }
          ]
        },
        {
          _id: "2",
          id: "ORD-2025-002",
          total: 449.99,
          status: "Kargoda",
          orderDate: "2025-01-14",
          deliveryDate: null,
          trackingNumber: "TRK987654321",
          items: [
            { name: "Saç Düzleştirici", quantity: 1, price: 449.99 }
          ]
        }
      ]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "Teslim Edildi": return "#10b981";
      case "Kargoda": return "#3b82f6";
      case "Hazırlanıyor": return "#f59e0b";
      case "Beklemede": return "#6b7280";
      case "İptal Edildi": return "#ef4444";
      default: return "#FF4896";
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "Teslim Edildi": return "✅";
      case "Kargoda": return "🚚";
      case "Hazırlanıyor": return "📦";
      case "Beklemede": return "⏳";
      case "İptal Edildi": return "❌";
      default: return "📋";
    }
  };

  const trackOrder = (trackingNumber) => {
    Alert.alert(
      "Kargo Takibi",
      `Takip Numarası: ${trackingNumber}\n\nKargo firmasının web sitesinden veya mobil uygulamasından takip edebilirsiniz.`,
      [
        { text: "Tamam" },
        { text: "Kopyala", onPress: () => {
          
          Alert.alert("Kopyalandı", "Takip numarası panoya kopyalandı");
        }}
      ]
    );
  };

  const OrderCard = ({ order }) => (
    <View style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <Text style={styles.orderId}>{order.id}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) }]}>
          <Text style={styles.statusText}>{getStatusIcon(order.status)} {order.status}</Text>
        </View>
      </View>

      <View style={styles.orderInfo}>
        <Text style={styles.orderDate}>📅 {order.orderDate}</Text>
        <Text style={styles.orderTotal}>💰 ₺{typeof order.total === "number" ? order.total.toFixed(2) : "0.00"}</Text>

      </View>

      <View style={styles.itemsContainer}>
        <Text style={styles.itemsTitle}>🛍️ Ürünler:</Text>
        {order.items.slice(0, 2).map((item, index) => (
          <Text key={index} style={styles.itemText}>
            • {item.name} ({item.quantity}x)
          </Text>
        ))}
        {order.items.length > 2 && (
          <Text style={styles.moreItems}>+{order.items.length - 2} ürün daha...</Text>
        )}
      </View>

      {order.trackingNumber && (
        <TouchableOpacity 
          style={styles.trackButton}
          onPress={() => trackOrder(order.trackingNumber)}
        >
          <FontAwesome6 name="truck" size={16} color="#fff" />
          <Text style={styles.trackButtonText}>Kargo Takibi</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity 
        style={styles.detailButton}
        onPress={() => navigation.navigate('OrderDetail', { order })}
      >
        <Text style={styles.detailButtonText}>Detayları Gör</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
     
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrowleft" size={30} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.logo}>SİPARİŞLERİM</Text>
        <TouchableOpacity onPress={() => navigation.navigate("Notifications")}>
          <FontAwesome6 name="bell" size={30} color="#fff" />
        </TouchableOpacity>
      </View>

      
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#FF4896"]} />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Siparişler yükleniyor...</Text>
          </View>
        ) : orders.length > 0 ? (
          <View style={styles.ordersContainer}>
            <Text style={styles.ordersCount}>Toplam {orders.length} sipariş</Text>
            {orders.map((order) => (
              <OrderCard key={order._id} order={order} />
            ))}
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <FontAwesome6 name="box-open" size={60} color="#ccc" />
            <Text style={styles.emptyText}>Henüz siparişiniz bulunmuyor</Text>
            <TouchableOpacity 
              style={styles.shopButton}
              onPress={() => navigation.navigate("Home")}
            >
              <Text style={styles.shopButtonText}>Alışverişe Başla</Text>
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
  ordersContainer: { padding: 15 },
  ordersCount: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 15,
    textAlign: "center",
  },
  orderCard: {
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
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  orderId: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  statusText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
  orderInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  orderDate: { fontSize: 14, color: "#666" },
  orderTotal: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FF4896",
  },
  itemsContainer: { marginBottom: 15 },
  itemsTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 5,
  },
  itemText: { fontSize: 13, color: "#666", marginBottom: 2 },
  moreItems: { fontSize: 13, color: "#FF4896", fontStyle: "italic" },
  trackButton: {
    flexDirection: "row",
    backgroundColor: "#3b82f6",
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  trackButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
    marginLeft: 5,
  },
  detailButton: {
    backgroundColor: "#FF4896",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  detailButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginTop: 20,
    marginBottom: 30,
  },
  shopButton: {
    backgroundColor: "#FF4896",
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  shopButtonText: {
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