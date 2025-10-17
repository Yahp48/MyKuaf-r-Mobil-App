import { Alert } from 'react-native';



class PaymentService {
  constructor() {
    this.stripePublishableKey = 'pk_test_your_stripe_key_here';
    this.backendUrl = 'https://your-backend.com/api';
  }


  async processCardPayment(paymentData) {
    try {
      const { amount, currency = 'TRY', orderData } = paymentData;

      const paymentIntent = await this.createPaymentIntent({
        amount: Math.round(amount * 100), 
        currency,
        orderData,
      });

      if (!paymentIntent.success) {
        throw new Error(paymentIntent.error);
      }

      
      const result = await this.confirmCardPayment(
        paymentIntent.data.client_secret,
        paymentData.cardDetails
      );

      if (result.success) {
        
        await this.confirmOrderPayment({
          paymentIntentId: result.paymentIntent.id,
          orderId: orderData.orderId,
        });

        return {
          success: true,
          transactionId: result.paymentIntent.id,
          message: 'Ödeme başarıyla tamamlandı',
        };
      } else {
        return {
          success: false,
          error: result.error,
        };
      }
    } catch (error) {
      console.error('Ödeme hatası:', error);
      return {
        success: false,
        error: error.message || 'Ödeme sırasında bir hata oluştu',
      };
    }
  }

  
  async createPaymentIntent(paymentData) {
    try {
      const response = await fetch(`${this.backendUrl}/payments/create-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAuthToken()}`,
        },
        body: JSON.stringify(paymentData),
      });

      const data = await response.json();
      
      if (response.ok) {
        return { success: true, data };
      } else {
        return { success: false, error: data.message || 'Payment intent oluşturulamadı' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  
  async confirmCardPayment(clientSecret, cardDetails) {
    try {
 
      const mockSuccess = Math.random() > 0.2; 

      if (mockSuccess) {
        return {
          success: true,
          paymentIntent: {
            id: 'pi_mock_' + Date.now(),
            status: 'succeeded',
            amount: 29999,
            currency: 'try',
          },
        };
      } else {
        return {
          success: false,
          error: 'Kartınız reddedildi. Lütfen farklı bir kart deneyin.',
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async processWalletPayment(paymentData) {
    try {
      const { amount, orderData } = paymentData;

     
      const response = await fetch(`${this.backendUrl}/payments/wallet-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAuthToken()}`,
        },
        body: JSON.stringify({
          amount,
          orderData,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        return {
          success: true,
          transactionId: data.transactionId,
          remainingBalance: data.remainingBalance,
          message: 'Cüzdan ödemesi başarılı',
        };
      } else {
        return {
          success: false,
          error: data.message || 'Cüzdan ödemesi başarısız',
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Cüzdan ödemesi sırasında hata oluştu',
      };
    }
  }

  
  async getInstallmentOptions(amount, cardBin) {
    try {
      const response = await fetch(`${this.backendUrl}/payments/installments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount,
          cardBin, 
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        return {
          success: true,
          installments: data.installments,
        };
      } else {
        return {
          success: false,
          installments: [1], 
        };
      }
    } catch (error) {
      return {
        success: false,
        installments: [1],
      };
    }
  }

 
  async handle3DSecure(paymentIntentId) {
    try {
      
      return new Promise((resolve) => {
        Alert.alert(
          '3D Secure Doğrulama',
          'Bankanızın güvenlik sayfasına yönlendiriliyorsunuz...',
          [
            {
              text: 'İptal',
              style: 'cancel',
              onPress: () => resolve({ success: false, error: 'Kullanıcı iptal etti' }),
            },
            {
              text: 'Devam Et',
              onPress: () => {
                
                setTimeout(() => {
                  resolve({
                    success: true,
                    paymentIntent: {
                      id: paymentIntentId,
                      status: 'succeeded',
                    },
                  });
                }, 2000);
              },
            },
          ]
        );
      });
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  
  async getPaymentHistory(userId) {
    try {
      const response = await fetch(`${this.backendUrl}/payments/history/${userId}`, {
        headers: {
          'Authorization': `Bearer ${await this.getAuthToken()}`,
        },
      });

      const data = await response.json();
      return { success: response.ok, data: data.payments || [] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  
  async processRefund(paymentIntentId, amount, reason) {
    try {
      const response = await fetch(`${this.backendUrl}/payments/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAuthToken()}`,
        },
        body: JSON.stringify({
          paymentIntentId,
          amount: amount ? Math.round(amount * 100) : undefined, 
          reason,
        }),
      });

      const data = await response.json();
      return { success: response.ok, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }


  async getSavedCards(userId) {
    try {
      const response = await fetch(`${this.backendUrl}/payments/saved-cards/${userId}`, {
        headers: {
          'Authorization': `Bearer ${await this.getAuthToken()}`,
        },
      });

      const data = await response.json();
      return { success: response.ok, cards: data.cards || [] };
    } catch (error) {
      return { success: false, cards: [] };
    }
  }

  
  async saveCard(cardDetails, userId) {
    try {
      const response = await fetch(`${this.backendUrl}/payments/save-card`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAuthToken()}`,
        },
        body: JSON.stringify({
          userId,
          cardDetails,
        }),
      });

      const data = await response.json();
      return { success: response.ok, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  
  async deleteCard(cardId) {
    try {
      const response = await fetch(`${this.backendUrl}/payments/delete-card/${cardId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${await this.getAuthToken()}`,
        },
      });

      return { success: response.ok };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  
  async checkPaymentStatus(paymentIntentId) {
    try {
      const response = await fetch(`${this.backendUrl}/payments/status/${paymentIntentId}`, {
        headers: {
          'Authorization': `Bearer ${await this.getAuthToken()}`,
        },
      });

      const data = await response.json();
      return { success: response.ok, status: data.status };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  
  async loadWalletBalance(amount, paymentMethodId) {
    try {
      const response = await fetch(`${this.backendUrl}/payments/load-wallet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAuthToken()}`,
        },
        body: JSON.stringify({
          amount: Math.round(amount * 100),
          paymentMethodId,
        }),
      });

      const data = await response.json();
      return { success: response.ok, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

 
  async confirmOrderPayment(paymentData) {
    try {
      const response = await fetch(`${this.backendUrl}/payments/confirm-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAuthToken()}`,
        },
        body: JSON.stringify(paymentData),
      });

      const data = await response.json();
      return { success: response.ok, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  
  validateCreditCard(cardNumber, expiryMonth, expiryYear, cvc) {
    const errors = {};

 
    const cleanCardNumber = cardNumber.replace(/\s/g, '');
    if (!cleanCardNumber || cleanCardNumber.length < 13 || cleanCardNumber.length > 19) {
      errors.cardNumber = 'Geçerli bir kart numarası girin';
    }

    
    if (!this.luhnCheck(cleanCardNumber)) {
      errors.cardNumber = 'Kart numarası geçersiz';
    }

    
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;

    if (!expiryMonth || expiryMonth < 1 || expiryMonth > 12) {
      errors.expiryMonth = 'Geçerli bir ay girin';
    }

    if (!expiryYear || expiryYear < currentYear) {
      errors.expiryYear = 'Geçerli bir yıl girin';
    }

    if (expiryYear === currentYear && expiryMonth < currentMonth) {
      errors.expiry = 'Kartın son kullanma tarihi geçmiş';
    }

    
    if (!cvc || cvc.length < 3 || cvc.length > 4) {
      errors.cvc = 'Geçerli bir CVC girin';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  }

  
  luhnCheck(cardNumber) {
    const digits = cardNumber.replace(/\D/g, '').split('').map(Number);
    let sum = 0;
    let isEven = false;

    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = digits[i];

      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }

      sum += digit;
      isEven = !isEven;
    }

    return sum % 10 === 0;
  }

  
  getCardType(cardNumber) {
    const cleanNumber = cardNumber.replace(/\s/g, '');
    
    if (/^4/.test(cleanNumber)) return 'Visa';
    if (/^5[1-5]/.test(cleanNumber)) return 'Mastercard';
    if (/^3[47]/.test(cleanNumber)) return 'American Express';
    if (/^6/.test(cleanNumber)) return 'Discover';
    
    return 'Unknown';
  }

  
  async getAuthToken() {
    
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    return await AsyncStorage.getItem('authToken');
  }

  
  validatePaymentSecurity(paymentData) {
    const { amount, orderData } = paymentData;

    
    if (amount < 1) {
      return { isValid: false, error: 'Minimum ödeme tutarı 1 TL' };
    }

    if (amount > 50000) {
      return { isValid: false, error: 'Maksimum ödeme tutarı 50,000 TL' };
    }

    
    if (!orderData || !orderData.orderId) {
      return { isValid: false, error: 'Geçersiz sipariş bilgisi' };
    }

    return { isValid: true };
  }
}


const paymentService = new PaymentService();

export default paymentService;