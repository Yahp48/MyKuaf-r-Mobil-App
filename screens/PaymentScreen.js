import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  SafeAreaView,
  Alert,
  Image
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialIcons as MaterialIcons } from '@expo/vector-icons';
import { FontAwesome6 as FontAwesome6 } from '@expo/vector-icons';
import { FontAwesome as FontAwesome } from '@expo/vector-icons';

export default function PaymentScreen({ navigation, route }) {
  const orderType = route.params?.orderType;
  const items = route.params?.items || route.params?.cartItems || [];
  const cartItems = items;
  
  
  function calculateSubtotal(items) {
    if (!items || items.length === 0) return "0.00";
    return items.reduce((acc, item) => {
      const price = parseFloat(item.price || 0);
      const quantity = parseInt(item.quantity || 1);
      return acc + (price * quantity);
    }, 0).toFixed(2);
  }

  function calculateShipping(subtotal) {
    const subtotalAmount = parseFloat(subtotal);
    return subtotalAmount > 500 ? 0 : 29.99;
  }

  const subtotal = route.params?.subtotal || route.params?.pricing?.subtotal || calculateSubtotal(cartItems);
  const shipping = route.params?.shipping || route.params?.pricing?.shipping || calculateShipping(subtotal);
  const totalPrice = route.params?.totalPrice || route.params?.pricing?.total || (parseFloat(subtotal) + parseFloat(shipping)).toFixed(2);

  const { productInfo } = route.params || {};
  const {
    selectedPersonnel,
    selectedServices,
    selectedDate,
    selectedTime,
    salonName
  } = route.params || {};

  const isProductOrder = orderType === "product" || orderType === "product_purchase";
  const isCartOrder = orderType === "cart" || orderType === "cart_purchase";
  const isAppointment = !orderType || (!isProductOrder && !isCartOrder);

  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("card");
  const [showNewCardForm, setShowNewCardForm] = useState(false);
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");

  const exampleCards = [
    { id: 1, number: "**** **** **** 8413", holder: "Örnek Kart Sahibi", bank: "Troy" },
  ];

  const handlePayment = () => {
    if (!agreementAccepted) {
      Alert.alert("Hata", "Ön bilgilendirme koşullarını onaylamalısınız.");
      return;
    }
    if (!phoneNumber.trim()) {
      Alert.alert("Hata", "Telefon numarası girmek zorunludur.");
      return;
    }

    if (selectedPaymentMethod === "wallet") {
      if (isProductOrder || isCartOrder) {
        Alert.alert("Başarı", "Siparişiniz tamamlandı. Kargo bilgileri telefon numaranıza gönderilecek.");
        navigation.reset({ index: 0, routes: [{ name: "Shop" }] });
      } else {
        Alert.alert("Başarı", "Randevu ödemeniz tamamlandı.");
        navigation.reset({ index: 0, routes: [{ name: "Appointments" }] });
      }
    } else {
      const paymentData = {
        ...route.params,
        phoneNumber,
        cartItems,
        subtotal,
        shipping,
        totalPrice,
      };
      navigation.navigate("PaymentVerificationScreen", paymentData);
    }
  };

  const renderOrderSummary = () => {
    console.log('=== RENDER ORDER SUMMARY DEBUG ===');
    console.log('isProductOrder:', isProductOrder);
    console.log('isCartOrder:', isCartOrder);
    console.log('isAppointment:', isAppointment);
    console.log('productInfo exists:', !!productInfo);
    console.log('cartItems exists:', !!cartItems);
    console.log('cartItems length:', cartItems?.length);
    console.log('salonName exists:', !!salonName);
    console.log('=== END DEBUG ===');

    if (isProductOrder && productInfo) {
      console.log('RENDERING: Product Order Summary');

      const productTotal = (productInfo.price * productInfo.quantity).toFixed(2);
      const productShipping = parseFloat(productTotal) > 500 ? 0 : 29.99;

      return (
        <View style={styles.summaryBox}>
          <Text style={styles.summaryTitle}>Ürün Siparişi</Text>

          <View style={styles.productSummary}>
            <Image 
              source={{ uri: productInfo.image || 'https://images.unsplash.com/photo-1522338242992-e1a54906a8da?w=100&h=100&fit=crop' }} 
              style={styles.productImage} 
            />
            <View style={styles.productDetails}>
              <Text style={styles.productName}>{productInfo.name}</Text>
              <Text style={styles.productCategory}>{productInfo.category}</Text>
              <Text style={styles.productPrice}>₺{productInfo.price} x {productInfo.quantity}</Text>
            </View>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Ürün Tutarı:</Text>
            <Text style={styles.summaryValue}>₺{productTotal}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Kargo:</Text>
            <Text style={styles.summaryValue}>
              {productShipping === 0 ? 'Ücretsiz' : `₺${productShipping.toFixed(2)}`}
            </Text>
          </View>

          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Toplam:</Text>
            <Text style={styles.totalAmount}>₺{totalPrice}</Text>
          </View>

          <View style={styles.deliveryInfo}>
            <MaterialIcons name="local-shipping" size={20} color="#4CAF50" />
            <Text style={styles.deliveryText}>2-3 iş günü içinde teslim</Text>
          </View>
        </View>
      );
    } else if ((isCartOrder || (cartItems && cartItems.length > 0)) && !isProductOrder) {
      console.log('RENDERING: Cart Order Summary');

      return (
        <View style={styles.summaryBox}>
          <Text style={styles.summaryTitle}>Sepet Siparişi ({cartItems.length} ürün)</Text>

          <ScrollView style={styles.cartItemsList} showsVerticalScrollIndicator={false}>
            {cartItems.map((item, index) => (
              <View key={item.id || item.productId || index} style={styles.cartItemSummary}>
                <Image 
                  source={{ uri: item.image || 'https://images.unsplash.com/photo-1522338242992-e1a54906a8da?w=50&h=50&fit=crop' }} 
                  style={styles.cartItemImage} 
                />
                <View style={styles.cartItemDetails}>
                  <Text style={styles.cartItemName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.cartItemPrice}>₺{item.price} x {item.quantity}</Text>
                </View>
                <Text style={styles.cartItemTotal}>₺{(parseFloat(item.price || 0) * parseInt(item.quantity || 1)).toFixed(2)}</Text>
              </View>
            ))}
          </ScrollView>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Ara Toplam:</Text>
            <Text style={styles.summaryValue}>₺{subtotal}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Kargo:</Text>
            <Text style={styles.summaryValue}>
              {parseFloat(shipping) === 0 ? 'Ücretsiz' : `₺${shipping}`}
            </Text>
          </View>

          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Toplam:</Text>
            <Text style={styles.totalAmount}>₺{totalPrice}</Text>
          </View>

          <View style={styles.deliveryInfo}>
            <MaterialIcons name="local-shipping" size={20} color="#4CAF50" />
            <Text style={styles.deliveryText}>2-3 iş günü içinde teslim</Text>
          </View>
        </View>
      );
    } else if (isAppointment && salonName) {
      console.log('RENDERING: Appointment Summary');
      return (
        <View style={styles.summaryBox}>
          <Text style={styles.summaryTitle}>Randevu Özeti</Text>
          <Text style={styles.summaryText}>Kuaför: {salonName}</Text>
          <Text style={styles.summaryText}>Personel: {selectedPersonnel?.name || 'Belirtilmemiş'}</Text>
          <Text style={styles.summaryText}>Tarih: {selectedDate} - Saat: {selectedTime}</Text>
          <Text style={styles.summaryText}>Hizmetler:</Text>
          {selectedServices?.map((service, index) => (
            <Text key={index} style={styles.serviceItem}>- {service.name} (₺{service.price})</Text>
          ))}
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Toplam:</Text>
            <Text style={styles.totalAmount}>₺{totalPrice}</Text>
          </View>
        </View>
      );
    } else {
      console.log('RENDERING: Fallback Summary');

      return (
        <View style={styles.summaryBox}>
          <Text style={styles.summaryTitle}>Ödeme Özeti</Text>
          <Text style={styles.summaryText}>Sipariş türü: {orderType || 'Randevu'}</Text>
          {cartItems && cartItems.length > 0 && (
            <Text style={styles.summaryText}>Ürün sayısı: {cartItems.length}</Text>
          )}
          {productInfo && (
            <Text style={styles.summaryText}>Ürün: {productInfo.name}</Text>
          )}
          {salonName && (
            <Text style={styles.summaryText}>Kuaför: {salonName}</Text>
          )}
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Toplam:</Text>
            <Text style={styles.totalAmount}>₺{totalPrice || '0.00'}</Text>
          </View>
        </View>
      );
    }
  };

  const getPageTitle = () => {
    if (isProductOrder) return 'Ürün Siparişi';
    if (isCartOrder) return 'Sepet Siparişi';
    return 'Randevu Ödemesi';
  };

  const getAgreementText = () => {
    const isProductPurchase = isProductOrder || isCartOrder;
    return `Ön Bilgilendirme Koşulları'nı ve ${isProductPurchase ? 'Mesafeli Satış Sözleşmesi' : 'Hizmet Sözleşmesi'}'ni okudum, onaylıyorum.`;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.header, { backgroundColor: '#FF4896' }]}>
    <View style={styles.headerContent}>
      <Text style={styles.headerTitle}>{getPageTitle()}</Text>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <MaterialIcons name="close" size={30} color="#fff" />
      </TouchableOpacity>
    </View>
  </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {renderOrderSummary()}

        <View style={styles.phoneInputBox}>
          <Text style={styles.inputLabel}>İletişim Bilgileri</Text>
          <TextInput
            placeholder="Telefon Numaranız *"
            keyboardType="phone-pad"
            style={styles.input}
            value={phoneNumber}
            onChangeText={setPhoneNumber}
          />
          {(isProductOrder || isCartOrder) && (
            <Text style={styles.inputHint}>
              Kargo bilgileri bu numaraya SMS ile gönderilecektir.
            </Text>
          )}
        </View>

        <View style={styles.paymentOptionsBox}>
          <Text style={styles.sectionTitle}>Ödeme Yöntemi</Text>

          <TouchableOpacity
            style={[styles.paymentButton, selectedPaymentMethod === "card" && styles.selectedPaymentButton]}
            onPress={() => { setSelectedPaymentMethod("card"); setShowNewCardForm(false); }}
          >
            <FontAwesome6 name="credit-card" size={24} color={selectedPaymentMethod === "card" ? "#fff" : "#800080"} />
            <Text style={[styles.paymentText, selectedPaymentMethod === "card" && styles.selectedPaymentText]}>
              Banka & Kredi Kartı ile Öde
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.paymentButton, selectedPaymentMethod === "wallet" && styles.selectedPaymentButton]}
            onPress={() => { setSelectedPaymentMethod("wallet"); setShowNewCardForm(false); }}
          >
            <FontAwesome6 name="wallet" size={24} color={selectedPaymentMethod === "wallet" ? "#fff" : "#800080"} />
            <Text style={[styles.paymentText, selectedPaymentMethod === "wallet" && styles.selectedPaymentText]}>
              Cüzdanım ile Öde
            </Text>
          </TouchableOpacity>
        </View>

        {selectedPaymentMethod === "card" && (
          <View style={styles.cardInfoBox}>
            <View style={styles.cardInfoHeader}>
              <Text style={styles.cardInfoTitle}>Kart Bilgileri</Text>
              <TouchableOpacity onPress={() => setShowNewCardForm(!showNewCardForm)}>
                <Text style={styles.addNewCardText}>{showNewCardForm ? "Kapat" : "Başka Kartla Öde"}</Text>
              </TouchableOpacity>
            </View>

            {!showNewCardForm && exampleCards.map((card) => (
              <TouchableOpacity key={card.id} style={styles.exampleCard}>
                <FontAwesome name="credit-card" size={24} color="#800080" />
                <View style={styles.cardInfo}>
                  <Text style={styles.cardText}>{card.number}</Text>
                  <Text style={styles.cardBank}>{card.bank} - {card.holder}</Text>
                </View>
                <MaterialIcons name="radio-button-checked" size={24} color="#FF4896" />
              </TouchableOpacity>
            ))}

            {showNewCardForm && (
              <View style={styles.newCardForm}>
                <TextInput placeholder="Kart Numarası" style={styles.input} keyboardType="numeric" />
                <TextInput placeholder="Kart Sahibi" style={styles.input} />
                <View style={styles.cardRow}>
                  <TextInput placeholder="MM/YY" style={[styles.input, styles.halfInput]} />
                  <TextInput placeholder="CVV" style={[styles.input, styles.halfInput]} keyboardType="numeric" />
                </View>
              </View>
            )}
          </View>
        )}

        <View style={styles.securityInfo}>
          <MaterialIcons name="security" size={20} color="#4CAF50" />
          <Text style={styles.securityText}>
            Ödeme bilgileriniz 256-bit SSL ile şifrelenir ve güvenle işlenir.
          </Text>
        </View>

        <View style={styles.agreementContainer}>
          <TouchableOpacity onPress={() => setAgreementAccepted(!agreementAccepted)}>
            <MaterialIcons
              name={agreementAccepted ? "check-box" : "check-box-outline-blank"}
              size={24}
              color={agreementAccepted ? "#FF4896" : "#666"}
            />
          </TouchableOpacity>
          <Text style={styles.agreementText}>{' '}{getAgreementText()}</Text>
        </View>

        <TouchableOpacity
          style={[styles.completeButton, !agreementAccepted && styles.disabledButton]}
          onPress={handlePayment}
          disabled={!agreementAccepted}
        >
          <Text style={styles.completeButtonText}>
            ₺{totalPrice} - Ödemeyi Tamamla
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { 
    flex: 1, 
    backgroundColor: "#fff" 
  },
  header: { 
    height: 100, 
    justifyContent: "center", 
    alignItems: "center", 
    paddingTop: 40, 
    zIndex: 10 
  },
  headerContent: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    alignItems: "center", 
    width: "90%" 
  },
  headerTitle: { 
    color: "#fff", 
    fontSize: 24, 
    fontWeight: "bold" 
  },
  scrollContent: { 
    paddingTop: 20,
    paddingBottom: 40,
  },
  summaryBox: { 
    margin: 20, 
    padding: 20, 
    backgroundColor: "#f9f9f9", 
    borderRadius: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  cartItemsList: {
    maxHeight: 200,
    marginBottom: 15,
  },
  cartItemSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  cartItemImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    resizeMode: 'cover',
  },
  cartItemDetails: {
    flex: 1,
    marginLeft: 12,
  },
  cartItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 3,
  },
  cartItemPrice: {
    fontSize: 12,
    color: '#666',
  },
  cartItemTotal: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FF4896',
  },
  productSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    resizeMode: 'cover',
  },
  productDetails: {
    flex: 1,
    marginLeft: 15,
  },
  productName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  productCategory: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  productPrice: {
    fontSize: 14,
    color: '#FF4896',
    fontWeight: '500',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 10,
    marginTop: 10,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF4896',
  },
  deliveryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 15,
    padding: 10,
    backgroundColor: '#e8f5e8',
    borderRadius: 8,
  },
  deliveryText: {
    fontSize: 14,
    color: '#4CAF50',
    marginLeft: 8,
    fontWeight: '500',
  },
  summaryText: { 
    fontSize: 16, 
    marginBottom: 5, 
    color: "#333" 
  },
  serviceItem: { 
    fontSize: 14, 
    color: "#555", 
    marginLeft: 10,
    marginBottom: 3,
  },
  phoneInputBox: { 
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  input: { 
    backgroundColor: "#fff", 
    borderWidth: 1, 
    borderColor: "#ddd", 
    padding: 15, 
    borderRadius: 10, 
    marginVertical: 5,
    fontSize: 16,
  },
  halfInput: {
    flex: 1,
    marginHorizontal: 5,
  },
  cardRow: {
    flexDirection: 'row',
  },
  inputHint: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
    fontStyle: 'italic',
  },
  paymentOptionsBox: { 
    padding: 20 
  },
  paymentButton: { 
    flexDirection: "row", 
    alignItems: "center", 
    backgroundColor: "#f0f0f0", 
    padding: 18, 
    borderRadius: 12, 
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedPaymentButton: { 
    backgroundColor: "#FF4896",
    borderColor: '#FF4896',
  },
  paymentText: { 
    marginLeft: 15, 
    fontSize: 16, 
    color: "#333",
    fontWeight: '500',
  },
  selectedPaymentText: { 
    color: "#fff", 
    fontWeight: "bold" 
  },
  cardInfoBox: { 
    marginHorizontal: 20, 
    backgroundColor: "#fff", 
    padding: 20, 
    borderRadius: 15, 
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginBottom: 20 
  },
  cardInfoHeader: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    alignItems: "center", 
    marginBottom: 15 
  },
  cardInfoTitle: { 
    fontSize: 16, 
    fontWeight: "bold",
    color: '#333',
  },
  addNewCardText: { 
    color: "#FF4896", 
    fontWeight: "bold",
    fontSize: 14,
  },
  exampleCard: { 
    flexDirection: "row", 
    alignItems: "center", 
    marginBottom: 15,
    padding: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
  },
  cardInfo: {
    flex: 1,
    marginLeft: 15,
  },
  cardText: { 
    fontSize: 16, 
    color: "#333",
    fontWeight: '500',
  },
  cardBank: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  newCardForm: {
    marginTop: 10,
  },
  securityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    padding: 15,
    backgroundColor: '#e8f5e8',
    borderRadius: 10,
    marginBottom: 20,
  },
  securityText: {
    fontSize: 14,
    color: '#4CAF50',
    marginLeft: 10,
    flex: 1,
    lineHeight: 18,
  },
  agreementContainer: { 
    flexDirection: "row", 
    alignItems: "flex-start", 
    marginTop: 10,
    marginHorizontal: 20,
    marginBottom: 30,
  },
  agreementText: { 
    fontSize: 14, 
    color: "#666", 
    flex: 1,
    lineHeight: 20,
  },
  completeButton: { 
    backgroundColor: "#FF4896", 
    marginHorizontal: 20, 
    paddingVertical: 18, 
    borderRadius: 25, 
    alignItems: "center",
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  disabledButton: {
    backgroundColor: '#ccc',
    elevation: 0,
    shadowOpacity: 0,
  },
  completeButtonText: { 
    color: "#fff", 
    fontWeight: "bold", 
    fontSize: 18 
  },
});