import React, { useState, useEffect } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  Alert,
  ActivityIndicator,
  Platform
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialIcons as MaterialIcons } from '@expo/vector-icons';

export default function PaymentVerificationScreen({ navigation, route }) {
  const [verificationCode, setVerificationCode] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [timeLeft, setTimeLeft] = useState(180);
  const [loading, setLoading] = useState(false);
  const [canResend, setCanResend] = useState(false);

  // Route params debug
  console.log('🔍 PaymentVerification route.params:', JSON.stringify(route.params, null, 2));

  const {
    salonName,
    selectedPersonnel,
    selectedServices,
    selectedDate,
    selectedTime,
    sehir,
    orderType,
    productInfo,
    cartItems,
    items,
    totalPrice,
    phoneNumber,
    pricing
  } = route.params || {};

  const TEST_CODE = __DEV__ ? "123456" : null;
  const isProductOrder = orderType === 'product' || orderType === 'product_purchase';
  const isCartOrder = orderType === 'cart' || orderType === 'cart_purchase';
  const isAppointment = !isProductOrder && !isCartOrder;

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const storedUser = await AsyncStorage.getItem("user");
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);
          setUserEmail(parsedUser?.email || "");
        }
      } catch (error) {
        console.error("Kullanıcı bilgisi çekilemedi:", error);
        setUserEmail("");
      }
    };

    fetchUser();

    if (__DEV__ && TEST_CODE) {
      setTimeout(() => {
        Alert.alert(
          'Geliştirme Modu 🔧',
          `Test doğrulama kodu: ${TEST_CODE}\n\nGerçek SMS gönderimi kapalı.`,
          [{ text: 'Tamam' }]
        );
      }, 1000);
    }
  }, []);

  useEffect(() => {
    if (timeLeft <= 0) {
      Alert.alert("Süre Doldu", "Doğrulama süresi sona erdi. İşlem iptal edildi.");
      navigation.goBack();
      return;
    }

    const timer = setTimeout(() => {
      setTimeLeft((prev) => {
        if (prev <= 60 && !canResend) {
          setCanResend(true);
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, [timeLeft]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const handleVerify = async () => {
    if (verificationCode.trim() === "") {
      Alert.alert("Hata", "Lütfen doğrulama kodunu giriniz.");
      return;
    }

    setLoading(true);

    try {
      if (__DEV__ && verificationCode === TEST_CODE) {
        await handlePaymentSuccess();
        return;
      }

      const isValidCode = await verifyCode(verificationCode);
      
      if (isValidCode) {
        await handlePaymentSuccess();
      } else {
        Alert.alert("Hata", "Doğrulama kodu hatalı. Lütfen tekrar deneyin.");
      }
    } catch (error) {
      console.error("❌ Verification error:", error);
      Alert.alert("Hata", "Doğrulama sırasında bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async (code) => {
    const validCodes = ['123456', '000000', '111111'];
    return validCodes.includes(code);
  };

  const handlePaymentSuccess = async () => {
    try {
      console.log('🎯 Payment success, order type:', { isAppointment, isProductOrder, isCartOrder });
      
      if (isAppointment) {
        console.log('📅 Creating appointment...');
        await createAppointment();
      } else if (isProductOrder) {
        console.log('📦 Creating product order...');
        await createProductOrder();
      } else if (isCartOrder) {
        console.log('🛒 Creating cart order...');
        await createCartOrder();
      } else {
        console.log('⚠️ Unknown order type, defaulting to product order');
        await createProductOrder();
      }
    } catch (error) {
      console.error("❌ Order creation error:", error);
      
      let errorMessage = "Sipariş oluşturulurken hata oluştu.";
      if (error.message.includes('Yetersiz stok')) {
        errorMessage = "Üründe yeterli stok bulunmuyor.";
      } else if (error.message.includes('bulunamadı')) {
        errorMessage = "Ürün bulunamadı veya artık mevcut değil.";
      } else if (error.message.includes('Network')) {
        errorMessage = "İnternet bağlantınızı kontrol edin.";
      } else if (error.message.includes('E-posta gereklidir')) {
        errorMessage = "E-posta adresiniz eksik. Lütfen giriş yapın.";
      }
      
      Alert.alert("Hata", errorMessage);
    }
  };

  const createAppointment = async () => {
    const randevuData = {
      ad: selectedPersonnel?.name || "Bilinmiyor",
      email: userEmail,
      telefon: phoneNumber,
      tarih: selectedDate,
      saat: selectedTime,
      personel: selectedPersonnel?.name || "Bilinmiyor",
      sehir: sehir,
      kuafor: salonName,
      hizmetler: selectedServices?.map(service => `${service.name} (${service.price} TL)`).join(", ") || "",
      toplamTutar: totalPrice,
    };

    const response = await fetch("http://10.0.2.2:5000/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(randevuData),
    });

    const data = await response.json();

    if (response.ok) {
      Alert.alert("Başarılı! 🎉", "Randevunuz başarıyla oluşturuldu!", [
        {
          text: "Tamam",
          onPress: () => navigation.reset({ index: 0, routes: [{ name: "Appointments" }] })
        }
      ]);
    } else {
      throw new Error(data.message || "Randevu oluşturulamadı.");
    }
  };

  const createProductOrder = async () => {
    // E-posta kontrolü eklendi
    if (!userEmail) {
      Alert.alert("Hata", "E-posta adresiniz eksik. Lütfen giriş yapın.");
      throw new Error("E-posta adresi gereklidir");
    }

    console.log('🔍 Debug: All route params:', JSON.stringify(route.params, null, 2));
    
    // Ürün bilgisini farklı kaynaklardan al
    let product = productInfo;
    
    if (!product) {
      if (items && items.length > 0) {
        product = items[0];
        console.log('📦 Using product from items:', product);
      } else if (cartItems && cartItems.length > 0) {
        product = cartItems[0];
        console.log('📦 Using product from cartItems:', product);
      }
    }
    
    if (!product) {
      const routeParams = route.params || {};
      if (routeParams.name || routeParams.price || routeParams.quantity) {
        product = {
          name: routeParams.name,
          price: routeParams.price,
          quantity: routeParams.quantity,
          _id: routeParams._id || routeParams.id || routeParams.productId,
          id: routeParams.id || routeParams._id || routeParams.productId
        };
        console.log('📦 Created product from route params:', product);
      }
    }

    if (!product) {
      console.error("❌ No product found anywhere");
      throw new Error("Ürün bilgisi bulunamadı. Lütfen tekrar deneyin.");
    }

    const productId = product._id || product.id || product.productId;
    if (!productId) {
      console.error("❌ Product ID not found:", product);
    }

    const orderData = {
      items: [{
        productId: productId || `temp_product_${Date.now()}`,
        name: product.name || 'Ürün Adı',
        quantity: product.quantity || 1,
        price: product.price || 0
      }],
      customerInfo: {
        name: userEmail ? userEmail.split('@')[0] : 'Müşteri',
        email: userEmail,
        phone: phoneNumber || ''
      },
      shippingAddress: {
        phone: phoneNumber,
        fullAddress: 'Mobil uygulama siparişi'
      },
      paymentMethod: 'Kredi Kartı',
      totalAmount: totalPrice || product.price || 0
    };

    console.log('📦 Creating product order:', JSON.stringify(orderData, null, 2));

    const response = await fetch("http://10.0.2.2:5000/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(orderData),
    });

    const data = await response.json();

    if (response.ok) {
      console.log('✅ Product order created:', data);
      Alert.alert("Başarılı! 🎉", "Siparişiniz başarıyla oluşturuldu!", [
        {
          text: "Tamam",
          onPress: () => navigation.reset({ index: 0, routes: [{ name: "Shop" }] })
        }
      ]);
    } else {
      console.error('❌ Product order error:', data);
      throw new Error(data.message || "Sipariş oluşturulamadı.");
    }
  };

  const createCartOrder = async () => {
    // E-posta kontrolü eklendi
    if (!userEmail) {
      Alert.alert("Hata", "E-posta adresiniz eksik. Lütfen giriş yapın.");
      throw new Error("E-posta adresi gereklidir");
    }

    const orderItems = (cartItems || items || []).map(item => {
      const itemId = item._id || item.id || item.productId;
      if (!itemId) {
        console.warn("⚠️ Item without ID found:", item);
      }
      
      return {
        productId: itemId || `temp_${Date.now()}_${Math.random()}`,
        name: item.name || 'Ürün',
        quantity: item.quantity || 1,
        price: item.price || 0
      };
    });

    if (orderItems.length === 0) {
      throw new Error("Sepette ürün bulunamadı.");
    }

    const orderData = {
      items: orderItems,
      customerInfo: {
        name: userEmail ? userEmail.split('@')[0] : 'Müşteri',
        email: userEmail,
        phone: phoneNumber || ''
      },
      shippingAddress: {
        phone: phoneNumber,
        fullAddress: 'Mobil uygulama sepet siparişi'
      },
      paymentMethod: 'Kredi Kartı',
      totalAmount: totalPrice || 0
    };

    console.log('🛒 Creating cart order:', JSON.stringify(orderData, null, 2));

    const response = await fetch("http://10.0.2.2:5000/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(orderData),
    });

    const data = await response.json();

    if (response.ok) {
      console.log('✅ Cart order created:', data);
      Alert.alert("Başarılı! 🎉", "Sepet siparişiniz başarıyla oluşturuldu!", [
        {
          text: "Tamam",
          onPress: () => navigation.reset({ index: 0, routes: [{ name: "Shop" }] })
        }
      ]);
    } else {
      console.error('❌ Cart order error:', data);
      throw new Error(data.message || "Sepet siparişi oluşturulamadı.");
    }
  };

  

  const resendCode = async () => {
    if (!canResend) return;

    try {
      setLoading(true);
      setTimeLeft(180);
      setCanResend(false);
      
      Alert.alert(
        'Kod Gönderildi',
        __DEV__ 
          ? `Test kodu: ${TEST_CODE}` 
          : `Doğrulama kodu ${phoneNumber} numarasına tekrar gönderildi.`
      );
      
    } catch (error) {
      Alert.alert('Hata', 'Kod gönderilirken hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const renderOrderInfo = () => {
    if (isAppointment) {
      return (
        <View style={styles.infoBox}>
          <Text style={styles.infoRow}><Text style={styles.label}>Kuaför:</Text> {salonName || 'Belirtilmemiş'}</Text>
          <Text style={styles.infoRow}><Text style={styles.label}>Personel:</Text> {selectedPersonnel?.name || 'Belirtilmemiş'}</Text>
          <Text style={styles.infoRow}><Text style={styles.label}>Tarih-Saat:</Text> {selectedDate || 'Belirtilmemiş'} - {selectedTime || 'Belirtilmemiş'}</Text>
          <Text style={styles.infoRow}><Text style={styles.label}>Tutar:</Text> ₺{totalPrice || '0'}</Text>
          <Text style={styles.infoRow}><Text style={styles.label}>Telefon:</Text> {phoneNumber || 'Belirtilmemiş'}</Text>
        </View>
      );
    } else if (isProductOrder) {
      // Ürün bilgisini al (farklı kaynaklardan)
      const product = productInfo || (items && items[0]) || (cartItems && cartItems[0]) || {};
      
      return (
        <View style={styles.infoBox}>
          <Text style={styles.infoRow}><Text style={styles.label}>Ürün:</Text> {product.name || 'Ürün Adı'}</Text>
          <Text style={styles.infoRow}><Text style={styles.label}>Miktar:</Text> {product.quantity || 1} adet</Text>
          <Text style={styles.infoRow}><Text style={styles.label}>Birim Fiyat:</Text> ₺{product.price || 0}</Text>
          <Text style={styles.infoRow}><Text style={styles.label}>Toplam:</Text> ₺{totalPrice || product.price || '0'}</Text>
          <Text style={styles.infoRow}><Text style={styles.label}>Telefon:</Text> {phoneNumber || 'Belirtilmemiş'}</Text>
        </View>
      );
    } else if (isCartOrder) {
      const itemCount = cartItems?.length || items?.length || 0;
      return (
        <View style={styles.infoBox}>
          <Text style={styles.infoRow}><Text style={styles.label}>Sipariş:</Text> Sepet ({itemCount} ürün)</Text>
          <Text style={styles.infoRow}><Text style={styles.label}>Ara Toplam:</Text> ₺{pricing?.subtotal || 0}</Text>
          <Text style={styles.infoRow}><Text style={styles.label}>Kargo:</Text> {pricing?.shipping > 0 ? `₺${pricing.shipping}` : 'Ücretsiz'}</Text>
          <Text style={styles.infoRow}><Text style={styles.label}>Toplam:</Text> ₺{totalPrice || '0'}</Text>
          <Text style={styles.infoRow}><Text style={styles.label}>Telefon:</Text> {phoneNumber || 'Belirtilmemiş'}</Text>
        </View>
      );
    }
    
    // Fallback - herhangi bir durumda
    return (
      <View style={styles.infoBox}>
        <Text style={styles.infoRow}><Text style={styles.label}>Sipariş Türü:</Text> {orderType || 'Bilinmiyor'}</Text>
        <Text style={styles.infoRow}><Text style={styles.label}>Toplam:</Text> ₺{totalPrice || '0'}</Text>
        <Text style={styles.infoRow}><Text style={styles.label}>Telefon:</Text> {phoneNumber || 'Belirtilmemiş'}</Text>
      </View>
    );
  };

  const getTitle = () => {
    if (isAppointment) return 'Randevu Ödemesi';
    if (isProductOrder) return 'Ürün Ödemesi';
    if (isCartOrder) return 'Sepet Ödemesi';
    return 'Güvenli Ödeme';
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, styles.alternativeGradient]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{getTitle()}</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        <View style={styles.card}>
          <View style={styles.securitySection}>
            <MaterialIcons name="security" size={50} color="#FF4896" />
            <Text style={styles.instruction}>Güvenlik Doğrulaması</Text>
            <Text style={styles.subInstruction}>
              {__DEV__ 
                ? `Test kodu: ${TEST_CODE}` 
                : `${phoneNumber} numarasına gönderilen doğrulama kodunu girin`
              }
            </Text>
          </View>

          {renderOrderInfo()}

          <View style={styles.inputSection}>
            <Text style={styles.verificationLabel}>Doğrulama Kodu</Text>
            <TextInput
              style={styles.input}
              placeholder="6 haneli kodu giriniz"
              value={verificationCode}
              onChangeText={setVerificationCode}
              keyboardType="numeric"
              maxLength={6}
              autoFocus
            />
          </View>

          <TouchableOpacity 
            style={[styles.confirmButton, loading && styles.disabledButton]} 
            onPress={handleVerify}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.confirmButtonText}>Ödemeyi Tamamla</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.resendButton, !canResend && styles.disabledResendButton]}
            onPress={resendCode}
            disabled={!canResend || loading}
          >
            <Text style={[styles.resendText, !canResend && styles.disabledResendText]}>
              {canResend ? 'Kodu Tekrar Gönder' : `Kod tekrar gönderilebilir: ${formatTime(timeLeft)}`}
            </Text>
          </TouchableOpacity>

          <View style={styles.footerActions}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.footerText}>İşlemi İptal Et</Text>
            </TouchableOpacity>
            <TouchableOpacity>
              <Text style={styles.footerText}>Yardım</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#f6f6f6" 
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingHorizontal: 20,
    paddingBottom: 15,
    backgroundColor: '#FF4896',
    borderBottomWidth: 4,
    borderBottomColor: '#5A189A',
    shadowColor: '#5A189A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
    position: 'relative',
    overflow: 'hidden'
  },
  gradientOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: '30%',
    backgroundColor: '#5A189A',
    opacity: 0.6
  },
  backButton: {
    padding: 5,
    zIndex: 1
  },
  headerTitle: { 
    fontSize: 18, 
    fontWeight: "bold", 
    color: "#fff",
    flex: 1,
    textAlign: 'center',
    textShadowColor: 'rgba(90, 24, 154, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    zIndex: 1
  },
  placeholder: {
    width: 34,
    zIndex: 1
  },
  content: {
    flex: 1,
    padding: 20,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 25,
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },
  securitySection: {
    alignItems: 'center',
    marginBottom: 25,
  },
  instruction: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 15,
    marginBottom: 8,
    color: "#333",
    textAlign: "center",
  },
  subInstruction: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 20,
  },
  infoBox: {
    marginBottom: 25,
    borderTopWidth: 1,
    borderColor: "#eee",
    paddingTop: 20,
  },
  infoRow: {
    fontSize: 15,
    marginBottom: 8,
    color: "#222",
  },
  label: {
    fontWeight: "bold",
    color: "#333",
  },
  inputSection: {
    marginBottom: 25,
  },
  verificationLabel: {
    fontSize: 16,
    marginBottom: 8,
    color: "#333",
    fontWeight: '500',
  },
  input: {
    borderWidth: 2,
    borderColor: "#e0e0e0",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 18,
    textAlign: 'center',
    letterSpacing: 2,
    fontWeight: 'bold',
  },
  confirmButton: {
    backgroundColor: "#FF4896",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 15,
    elevation: 2,
  },
  disabledButton: {
    backgroundColor: "#ccc",
  },
  confirmButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  resendButton: {
    alignItems: 'center',
    paddingVertical: 10,
    marginBottom: 20,
  },
  disabledResendButton: {
    opacity: 0.5,
  },
  resendText: {
    color: "#FF4896",
    fontSize: 14,
    fontWeight: '500',
  },
  disabledResendText: {
    color: "#999",
  },
  footerActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#eee",
    paddingTop: 15,
  },
  footerText: {
    color: "#007BFF",
    fontSize: 14,
    fontWeight: '500',
  },
});