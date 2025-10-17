import React from "react";
import { View, StyleSheet, Text, TouchableOpacity, ScrollView, Alert } from "react-native";
import Icon from "react-native-vector-icons/AntDesign";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";

export default function OrderDetailScreen({ navigation, route }) {
  const { order } = route.params;

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

  const trackOrder = () => {
    if (order.trackingNumber) {
      Alert.alert(
        "Kargo Takibi",
        `Takip Numarası: ${order.trackingNumber}\n\nKargo firmasının web sitesinden veya mobil uygulamasından takip edebilirsiniz.`,
        [
          { text: "Tamam" },
          { text: "Kopyala", onPress: () => {
            Alert.alert("Kopyalandı", "Takip numarası panoya kopyalandı");
          }}
        ]
      );
    } else {
      Alert.alert("Bilgi", "Bu sipariş için henüz kargo takip numarası oluşturulmamış.");
    }
  };

  const StatusTimeline = () => {
    const statuses = [
      { key: "Beklemede", label: "Sipariş Alındı", icon: "⏳" },
      { key: "Hazırlanıyor", label: "Hazırlanıyor", icon: "📦" },
      { key: "Kargoda", label: "Kargoya Verildi", icon: "🚚" },
      { key: "Teslim Edildi", label: "Teslim Edildi", icon: "✅" }
    ];

    const currentIndex = statuses.findIndex(s => s.key === order.status);

    return (
      <View style={styles.timelineContainer}>
        <Text style={styles.timelineTitle}>Sipariş Durumu</Text>
        {statuses.map((status, index) => (
          <View key={status.key} style={styles.timelineItem}>
            <View style={[
              styles.timelineIcon,
              { backgroundColor: index <= currentIndex ? "#FF4896" : "#e5e7eb" }
            ]}>
              <Text style={[
                styles.timelineIconText,
                { color: index <= currentIndex ? "#fff" : "#9ca3af" }
              ]}>
                {status.icon}
              </Text>
            </View>
            <View style={styles.timelineContent}>
              <Text style={[
                styles.timelineLabel,
                { color: index <= currentIndex ? "#333" : "#9ca3af" }
              ]}>
                {status.label}
              </Text>
              {index === currentIndex && (
                <Text style={styles.currentStatus}>Mevcut Durum</Text>
              )}
            </View>
          </View>
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrowleft" size={30} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sipariş Detayı</Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView style={styles.content}>
     
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Text style={styles.orderId}>{order.id}</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) }]}>
              <Text style={styles.statusText}>{getStatusIcon(order.status)} {order.status}</Text>
            </View>
          </View>
          <Text style={styles.orderDate}>📅 Sipariş Tarihi: {order.orderDate}</Text>
          {order.deliveryDate && (
            <Text style={styles.deliveryDate}>🚚 Teslimat Tarihi: {order.deliveryDate}</Text>
          )}
          <Text style={styles.totalAmount}>💰 Toplam: ₺{order.total.toFixed(2)}</Text>
        </View>

        
        <StatusTimeline />

       
        <View style={styles.itemsCard}>
          <Text style={styles.cardTitle}>🛍️ Sipariş Edilen Ürünler</Text>
          {order.items.map((item, index) => (
            <View key={index} style={styles.itemRow}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemPrice}>₺{item.price.toFixed(2)} x {item.quantity}</Text>
              </View>
              <Text style={styles.itemTotal}>₺{(item.price * item.quantity).toFixed(2)}</Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Toplam:</Text>
            <Text style={styles.totalValue}>₺{order.total.toFixed(2)}</Text>
          </View>
        </View>

        
        {order.trackingNumber && (
          <View style={styles.trackingCard}>
            <Text style={styles.cardTitle}>📦 Kargo Bilgileri</Text>
            <View style={styles.trackingInfo}>
              <Text style={styles.trackingLabel}>Takip Numarası:</Text>
              <Text style={styles.trackingNumber}>{order.trackingNumber}</Text>
            </View>
            <TouchableOpacity style={styles.trackButton} onPress={trackOrder}>
              <FontAwesome6 name="truck" size={16} color="#fff" />
              <Text style={styles.trackButtonText}>Kargo Takibi</Text>
            </TouchableOpacity>
          </View>
        )}

       
        <View style={styles.actionsCard}>
          <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate("Support")}>
            <FontAwesome6 name="headset" size={16} color="#FF4896" />
            <Text style={styles.actionButtonText}>Yardım Al</Text>
          </TouchableOpacity>
          
          {order.status === "Teslim Edildi" && (
            <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate("Review", { order })}>
              <FontAwesome6 name="star" size={16} color="#FF4896" />
              <Text style={styles.actionButtonText}>Değerlendir</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
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
  headerTitle: { color: "white", fontSize: 18, fontWeight: "bold" },
  content: { flex: 1, padding: 15 },
  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  orderId: { fontSize: 18, fontWeight: "bold", color: "#333" },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  statusText: { color: "#fff", fontSize: 12, fontWeight: "bold" },
  orderDate: { fontSize: 14, color: "#666", marginBottom: 5 },
  deliveryDate: { fontSize: 14, color: "#666", marginBottom: 5 },
  totalAmount: { fontSize: 16, fontWeight: "bold", color: "#FF4896" },
  timelineContainer: {
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 15,
  },
  timelineItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
  },
  timelineIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  timelineIconText: { fontSize: 16 },
  timelineContent: { flex: 1 },
  timelineLabel: { fontSize: 14, fontWeight: "500" },
  currentStatus: { fontSize: 12, color: "#FF4896", fontWeight: "bold" },
  itemsCard: {
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 15,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: "500", color: "#333" },
  itemPrice: { fontSize: 12, color: "#666" },
  itemTotal: { fontSize: 14, fontWeight: "bold", color: "#FF4896" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 15,
    borderTopWidth: 2,
    borderTopColor: "#f1f5f9",
  },
  totalLabel: { fontSize: 16, fontWeight: "bold", color: "#333" },
  totalValue: { fontSize: 18, fontWeight: "bold", color: "#FF4896" },
  trackingCard: {
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  trackingInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  trackingLabel: { fontSize: 14, color: "#666" },
  trackingNumber: { fontSize: 14, fontWeight: "bold", color: "#333" },
  trackButton: {
    flexDirection: "row",
    backgroundColor: "#3b82f6",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  trackButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
    marginLeft: 8,
  },
  actionsCard: {
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FF4896",
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 10,
  },
  actionButtonText: {
    color: "#FF4896",
    fontSize: 14,
    fontWeight: "bold",
    marginLeft: 8,
  },
});