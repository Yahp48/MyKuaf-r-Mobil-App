import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const API_BASE_URL = __DEV__ 
  ? Platform.OS === 'android' 
    ? 'http://10.0.2.2:5000/api'  
    : 'http://localhost:5000/api'  
  : 'https://your-production-api.com/api'; 

const MOCK_MODE = false;

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
    this.token = null;
    this.timeout = 15000; 
    this.isOnline = true;
    this.requestQueue = [];
  }

  // User ID Management - DÜZELTME
  async getUserId() {
    try {
      let userId = await AsyncStorage.getItem('userId');
      
      if (!userId) {
        // Geçici guest user ID oluştur
        userId = 'guest_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        await AsyncStorage.setItem('userId', userId);
        console.log('🆔 New user ID created:', userId);
      }
      
      return userId;
    } catch (error) {
      console.error('❌ Get user ID error:', error);
      return 'guest_' + Date.now();
    }
  }

  async setAuthToken(token) {
    this.token = token;
    await AsyncStorage.multiSet([
      ['authToken', token],
      ['userToken', token] 
    ]);
  }

  async getAuthToken() {
    if (!this.token) {
      this.token = await AsyncStorage.getItem('authToken');
    }
    return this.token;
  }

  async removeAuthToken() {
    this.token = null;
    await AsyncStorage.multiRemove(['authToken', 'userToken', 'userData']);
  }

  async getUserData() {
    try {
      const userData = await AsyncStorage.getItem('userData');
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error('Kullanıcı verileri alınırken hata:', error);
      return null;
    }
  }

  async setUserData(userData) {
    try {
      await AsyncStorage.setItem('userData', JSON.stringify(userData));
    } catch (error) {
      console.error('Kullanıcı verileri kaydedilirken hata:', error);
    }
  }

  async checkNetworkStatus() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${this.baseURL}/health`, {
        method: 'GET',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' }
      });
      
      clearTimeout(timeoutId);
      this.isOnline = response.ok;
      return response.ok;
    } catch (error) {
      this.isOnline = false;
      return false;
    }
  }

  get networkStatus() {
    return this.isOnline;
  }

  async request(endpoint, options = {}) {
    if (MOCK_MODE) {
      return this.mockRequest(endpoint, options);
    }

    const token = await this.getAuthToken();
    const url = `${this.baseURL}${endpoint}`;
    
    const config = {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
      ...(options.body && { body: typeof options.body === 'string' ? options.body : JSON.stringify(options.body) }),
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    config.signal = controller.signal;

    try {
      console.log(`📡 API Request: ${config.method} ${url}`);
      
      const response = await fetch(url, config);
      clearTimeout(timeoutId);
      
      if (response.status === 401) {
        await this.logout();
        throw new Error('Oturum süresi dolmuş, lütfen tekrar giriş yapın');
      }
      
      if (response.status === 403) {
        throw new Error('Bu işlem için yetkiniz bulunmuyor');
      }
      
      if (response.status === 404) {
        throw new Error('İstenen kaynak bulunamadı');
      }
      
      if (response.status >= 500) {
        throw new Error('Sunucu hatası, lütfen daha sonra tekrar deneyin');
      }
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || `HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`✅ API Response: ${config.method} ${endpoint}`, data);
      
      return { success: true, data };
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        console.error('❌ Request timeout:', endpoint);
        return { success: false, error: 'İstek zaman aşımına uğradı' };
      }
      
      console.error('❌ API Request Error:', error);
      
      if (error.message.includes('Network') || error.message.includes('fetch')) {
        await this.addToOfflineQueue({ endpoint, options });
        return { success: false, error: 'Bağlantı hatası, istek kuyruğa eklendi', offline: true };
      }
      
      return { success: false, error: error.message };
    }
  }

  async requestWithRetry(endpoint, options = {}, maxRetries = 3) {
    let lastError;
    
    for (let i = 0; i <= maxRetries; i++) {
      try {
        const result = await this.request(endpoint, options);
        if (result.success || !result.error.includes('Network')) {
          return result;
        }
        throw new Error(result.error);
      } catch (error) {
        lastError = error;
        
        if (i === maxRetries) break;
        
        const delay = Math.pow(2, i) * 1000;
        console.log(`🔄 Retry ${i + 1}/${maxRetries} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    return { success: false, error: lastError.message };
  }

  // AUTH METHODS
  async login(email, password) {
    const result = await this.request('/auth/login', {
      method: 'POST',
      body: { email, password },
    });

    if (result.success && result.data.token) {
      await this.setAuthToken(result.data.token);
      await this.setUserData(result.data.user);
      this.processOfflineQueue();
    }

    return result;
  }

  async register(userData) {
    const result = await this.request('/auth/register', {
      method: 'POST',
      body: userData,
    });

    if (result.success && result.data.token) {
      await this.setAuthToken(result.data.token);
      await this.setUserData(result.data.user);
    }

    return result;
  }

  async logout() {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } catch (error) {
      console.log('Logout request failed, but continuing with local cleanup');
    }
    
    await this.removeAuthToken();
    await this.clearCache();
    return { success: true };
  }

  async refreshToken() {
    const result = await this.request('/auth/refresh', { method: 'POST' });
    
    if (result.success && result.data.token) {
      await this.setAuthToken(result.data.token);
    }
    
    return result;
  }

  async forgotPassword(email) {
    return this.request('/auth/forgot-password', {
      method: 'POST',
      body: { email },
    });
  }

  async resetPassword(token, newPassword) {
    return this.request('/auth/reset-password', {
      method: 'POST',
      body: { token, newPassword },
    });
  }

  async verifyToken() {
    return this.request('/auth/verify');
  }

  // USER METHODS
  async getUserProfile() {
    return this.request('/user/profile');
  }

  async updateUserProfile(userData) {
    const result = await this.request('/user/profile', {
      method: 'PUT',
      body: userData,
    });

    if (result.success && result.data.user) {
      await this.setUserData(result.data.user);
    }

    return result;
  }

  async uploadProfilePhoto(imageUri) {
    try {
      const formData = new FormData();
      formData.append('profilePhoto', {
        uri: imageUri,
        type: 'image/jpeg',
        name: 'profile.jpg',
      });

      return this.request('/user/upload-photo', {
        method: 'POST',
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
      });
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async deleteAccount() {
    return this.request('/user/delete-account', { method: 'DELETE' });
  }

  // HAIRDRESSER METHODS
  async getHairdressers(filters = {}) {
    const queryParams = new URLSearchParams(filters).toString();
    return this.requestWithCache(`/hairdressers${queryParams ? `?${queryParams}` : ''}`);
  }

  async getHairdresserDetail(hairdresserId) {
    return this.request(`/hairdressers/${hairdresserId}`);
  }

  async getHairdresserServices(hairdresserId) {
    return this.requestWithCache(`/hairdressers/${hairdresserId}/services`);
  }

  async getHairdresserReviews(hairdresserId, page = 1) {
    return this.request(`/hairdressers/${hairdresserId}/reviews?page=${page}`);
  }

  async getHairdresserAvailability(hairdresserId, date) {
    return this.request(`/hairdressers/${hairdresserId}/availability?date=${date}`);
  }

  async getNearbyHairdressers(latitude, longitude, radius = 10) {
    return this.request('/hairdressers/nearby', {
      method: 'POST',
      body: { latitude, longitude, radius },
    });
  }

  async searchHairdressers(query, filters = {}) {
    return this.request('/hairdressers/search', {
      method: 'POST',
      body: { query, ...filters },
    });
  }

  async addHairdresserReview(hairdresserId, reviewData) {
    return this.request(`/hairdressers/${hairdresserId}/reviews`, {
      method: 'POST',
      body: reviewData,
    });
  }

  // PRODUCT METHODS
  async getProducts(filters = {}) {
    const queryParams = new URLSearchParams(filters).toString();
    return this.requestWithCache(`/products${queryParams ? `?${queryParams}` : ''}`, {}, { maxAge: 300000 }); 
  }

  async getProduct(productId) {
    return this.requestWithCache(`/products/${productId}`);
  }

  async getProductCategories() {
    return this.requestWithCache('/products/categories', {}, { maxAge: 600000 }); 
  }

  async searchProducts(query, filters = {}) {
    return this.request('/products/search', {
      method: 'POST',
      body: { searchTerm: query, filters },
    });
  }

  async getProductReviews(productId, page = 1) {
    return this.request(`/products/${productId}/reviews?page=${page}`);
  }

  async addProductReview(productId, reviewData) {
    return this.request(`/products/${productId}/reviews`, {
      method: 'POST',
      body: reviewData,
    });
  }

  async getFeaturedProducts() {
    return this.requestWithCache('/products/featured');
  }

  // Related Products - DÜZELTME
  async getRelatedProducts(productId) {
    try {
      console.log('🔍 İlgili ürünler isteniyor:', productId);
      
      const result = await this.requestWithCache(`/products/${productId}/related`);
      
      if (result.success) {
        // Backend response yapısını kontrol et
        let relatedProducts = [];
        
        if (result.data.relatedProducts && Array.isArray(result.data.relatedProducts)) {
          // Backend'den gelen yapı: { success: true, data: { relatedProducts: [...] } }
          relatedProducts = result.data.relatedProducts;
        } else if (result.data.data && Array.isArray(result.data.data)) {
          // Alternatif yapı: { success: true, data: { data: [...] } }
          relatedProducts = result.data.data;
        } else if (Array.isArray(result.data)) {
          // Direkt array: { success: true, data: [...] }
          relatedProducts = result.data;
        } else {
          console.log('⚠️ Beklenmeyen response yapısı:', result.data);
          relatedProducts = [];
        }
        
        console.log(`✅ ${relatedProducts.length} ilgili ürün bulundu`);
        return { success: true, data: { products: relatedProducts } };
        
      } else {
        console.log('⚠️ Related products API hatası:', result.error);
        return { success: false, data: { products: [] } };
      }
      
    } catch (error) {
      console.error('❌ Önerilen ürünler yükleme hatası:', error);
      return { success: false, data: { products: [] } };
    }
  }

  // CART METHODS - DÜZELTME
  async syncCartWithServer(cartItems) {
    try {
      const userId = await this.getUserId();
      
      console.log('📡 Cart sync başlatılıyor:', {
        userId,
        itemCount: cartItems?.length || 0
      });
      
      const result = await this.request('/cart/sync', {
        method: 'POST',
        body: {
          userId: userId,
          cartItems: cartItems || [],
          metadata: {
            platform: Platform.OS,
            source: 'mobile_app',
            timestamp: new Date().toISOString()
          }
        }
      });
      
      if (result.success) {
        console.log('✅ Sepet başarıyla senkronize edildi');
      } else {
        console.log('⚠️ Sepet senkronizasyonu başarısız:', result.error);
      }
      
      return result;
      
    } catch (error) {
      console.log('⚠️ Sepet senkronizasyonu başarısız:', error.message);
      return {
        success: false,
        error: error.message,
        offline: true
      };
    }
  }

  async getServerCart() {
    try {
      const userId = await this.getUserId();
      return this.request(`/cart/${userId}`);
    } catch (error) {
      console.error('❌ Get cart error:', error);
      return { success: false, cart: [], itemCount: 0 };
    }
  }

  async addToServerCart(productId, quantity = 1, productData = {}) {
    try {
      const userId = await this.getUserId();
      
      return this.request('/cart/add', {
        method: 'POST',
        body: {
          userId,
          productId,
          quantity,
          name: productData.name,
          price: productData.price,
          image: productData.image || productData.images?.[0]
        }
      });
    } catch (error) {
      console.error('❌ Server cart add error:', error);
      throw error;
    }
  }

  async updateCartItem(productId, quantity) {
    try {
      const userId = await this.getUserId();
      
      return this.request(`/cart/${userId}/item/${productId}`, {
        method: 'PUT',
        body: { quantity }
      });
    } catch (error) {
      console.error('❌ Cart item update error:', error);
      throw error;
    }
  }

  async removeFromServerCart(productId) {
    try {
      const userId = await this.getUserId();
      
      return this.request(`/cart/${userId}/item/${productId}`, {
        method: 'DELETE'
      });
    } catch (error) {
      console.error('❌ Cart item remove error:', error);
      throw error;
    }
  }

  async clearServerCart() {
    try {
      const userId = await this.getUserId();
      
      return this.request(`/cart/${userId}`, {
        method: 'DELETE'
      });
    } catch (error) {
      console.error('❌ Clear cart error:', error);
      throw error;
    }
  }

  // ORDER METHODS
  async getOrders(status = null, page = 1) {
    const query = status ? `?status=${status}&page=${page}` : `?page=${page}`;
    return this.request(`/orders${query}`);
  }

  async getOrder(orderId) {
    return this.request(`/orders/${orderId}`);
  }

  async createOrder(orderData) {
    return this.request('/orders', {
      method: 'POST',
      body: orderData,
    });
  }

  async updateOrder(orderId, updateData) {
    return this.request(`/orders/${orderId}`, {
      method: 'PUT',
      body: updateData,
    });
  }

  async cancelOrder(orderId, reason = null) {
    return this.request(`/orders/${orderId}/cancel`, {
      method: 'PUT',
      body: { reason },
    });
  }

  async getOrderTracking(orderId) {
    return this.request(`/orders/${orderId}/tracking`);
  }

  async confirmOrderDelivery(orderId) {
    return this.request(`/orders/${orderId}/confirm-delivery`, {
      method: 'PUT',
    });
  }

  async requestOrderRefund(orderId, reason) {
    return this.request(`/orders/${orderId}/refund`, {
      method: 'POST',
      body: { reason },
    });
  }

  // APPOINTMENT METHODS
  async getAppointments(status = null, page = 1) {
    const query = status ? `?status=${status}&page=${page}` : `?page=${page}`;
    return this.request(`/appointments${query}`);
  }

  async getAppointment(appointmentId) {
    return this.request(`/appointments/${appointmentId}`);
  }

  async createAppointment(appointmentData) {
    return this.request('/appointments', {
      method: 'POST',
      body: appointmentData,
    });
  }

  async updateAppointment(appointmentId, updateData) {
    return this.request(`/appointments/${appointmentId}`, {
      method: 'PUT',
      body: updateData,
    });
  }

  async cancelAppointment(appointmentId, reason = null) {
    return this.request(`/appointments/${appointmentId}/cancel`, {
      method: 'PUT',
      body: { reason },
    });
  }

  async rescheduleAppointment(appointmentId, newDate, newTime) {
    return this.request(`/appointments/${appointmentId}/reschedule`, {
      method: 'PUT',
      body: { newDate, newTime },
    });
  }

  async confirmAppointment(appointmentId) {
    return this.request(`/appointments/${appointmentId}/confirm`, {
      method: 'PUT',
    });
  }

  async completeAppointment(appointmentId) {
    return this.request(`/appointments/${appointmentId}/complete`, {
      method: 'PUT',
    });
  }

  async rateAppointment(appointmentId, rating, comment) {
    return this.request(`/appointments/${appointmentId}/rate`, {
      method: 'POST',
      body: { rating, comment },
    });
  }

  // NOTIFICATION METHODS
  async getNotifications(page = 1, limit = 20) {
    return this.request(`/notifications?page=${page}&limit=${limit}`);
  }

  async markNotificationRead(notificationId) {
    return this.request(`/notifications/${notificationId}/read`, {
      method: 'PUT',
    });
  }

  async markAllNotificationsRead() {
    return this.request('/notifications/mark-all-read', {
      method: 'PUT',
    });
  }

  async deleteNotification(notificationId) {
    return this.request(`/notifications/${notificationId}`, {
      method: 'DELETE',
    });
  }

  async updatePushToken(pushToken, deviceType = 'mobile') {
    return this.request('/notifications/push-token', {
      method: 'PUT',
      body: { pushToken, deviceType },
    });
  }

  async getNotificationSettings() {
    return this.request('/notifications/settings');
  }

  async updateNotificationSettings(settings) {
    return this.request('/notifications/settings', {
      method: 'PUT',
      body: settings,
    });
  }

  // FAVORITES METHODS
  async getFavorites(type = 'all', page = 1) {
    return this.request(`/favorites?type=${type}&page=${page}`);
  }

  async addToFavorites(itemId, itemType = 'product') {
    return this.request('/favorites', {
      method: 'POST',
      body: { itemId, itemType },
    });
  }

  async removeFromFavorites(itemId, itemType = 'product') {
    return this.request(`/favorites/${itemId}`, {
      method: 'DELETE',
      body: { itemType },
    });
  }

  async checkFavoriteStatus(itemId, itemType) {
    return this.request(`/favorites/check/${itemId}?type=${itemType}`);
  }

  // PAYMENT METHODS
  async processPayment(paymentData) {
    return this.request('/payments/process', {
      method: 'POST',
      body: paymentData,
    });
  }

  async getPaymentMethods() {
    return this.request('/payments/methods');
  }

  async addPaymentMethod(paymentMethodData) {
    return this.request('/payments/methods', {
      method: 'POST',
      body: paymentMethodData,
    });
  }

  async deletePaymentMethod(methodId) {
    return this.request(`/payments/methods/${methodId}`, {
      method: 'DELETE',
    });
  }

  async getPaymentHistory(page = 1) {
    return this.request(`/payments/history?page=${page}`);
  }

  async refundPayment(paymentId, amount, reason) {
    return this.request(`/payments/${paymentId}/refund`, {
      method: 'POST',
      body: { amount, reason },
    });
  }

  // LOCATION METHODS
  async updateLocation(latitude, longitude) {
    return this.request('/user/location', {
      method: 'PUT',
      body: { latitude, longitude },
    });
  }

  async searchByLocation(latitude, longitude, type = 'hairdressers', radius = 10) {
    return this.request('/search/location', {
      method: 'POST',
      body: { latitude, longitude, type, radius },
    });
  }

  // SUPPORT METHODS
  async sendFeedback(feedbackData) {
    return this.request('/support/feedback', {
      method: 'POST',
      body: feedbackData,
    });
  }

  async createSupportTicket(ticketData) {
    return this.request('/support/tickets', {
      method: 'POST',
      body: ticketData,
    });
  }

  async getSupportTickets(page = 1) {
    return this.request(`/support/tickets?page=${page}`);
  }

  async getSupportTicket(ticketId) {
    return this.request(`/support/tickets/${ticketId}`);
  }

  async replySupportTicket(ticketId, message) {
    return this.request(`/support/tickets/${ticketId}/replies`, {
      method: 'POST',
      body: { message },
    });
  }

  async sendContactForm(contactData) {
    return this.request('/contact', {
      method: 'POST',
      body: contactData,
    });
  }

  // APP METHODS
  async getAppVersion() {
    return this.request('/app/version');
  }

  async checkForUpdates() {
    return this.request('/app/updates');
  }

  async getAppSettings() {
    return this.requestWithCache('/app/settings', {}, { maxAge: 3600000 });
  }

  async reportBug(bugData) {
    return this.request('/app/bug-report', {
      method: 'POST',
      body: bugData,
    });
  }

  async getTermsAndConditions() {
    return this.requestWithCache('/app/terms');
  }

  async getPrivacyPolicy() {
    return this.requestWithCache('/app/privacy');
  }

  // CACHE METHODS
  getCacheKey(endpoint, params = {}) {
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((acc, key) => {
        acc[key] = params[key];
        return acc;
      }, {});
    
    return `api_cache_${endpoint.replace(/\//g, '_')}_${JSON.stringify(sortedParams)}`;
  }

  async getCachedData(cacheKey, maxAge = 300000) { 
    try {
      const cachedData = await AsyncStorage.getItem(cacheKey);
      if (cachedData) {
        const { data, timestamp } = JSON.parse(cachedData);
        const age = Date.now() - timestamp;
        
        if (age < maxAge) {
          console.log(`📋 Cache hit: ${cacheKey}`);
          return data;
        } else {
          console.log(`⏰ Cache expired: ${cacheKey}`);
          await AsyncStorage.removeItem(cacheKey);
        }
      }
    } catch (error) {
      console.error('Cache okuma hatası:', error);
    }
    
    return null;
  }

  async setCachedData(cacheKey, data) {
    try {
      const cacheData = {
        data,
        timestamp: Date.now()
      };
      await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheData));
      console.log(`💾 Cache saved: ${cacheKey}`);
    } catch (error) {
      console.error('Cache kaydetme hatası:', error);
    }
  }

  async requestWithCache(endpoint, options = {}, cacheOptions = {}) {
    const { useCache = true, maxAge = 300000 } = cacheOptions;
    
    if (useCache && (!options.method || options.method === 'GET')) {
      const cacheKey = this.getCacheKey(endpoint, options.params);
      
      const cachedData = await this.getCachedData(cacheKey, maxAge);
      if (cachedData) {
        return { success: true, data: cachedData };
      }
      
      const result = await this.request(endpoint, options);
      if (result.success) {
        await this.setCachedData(cacheKey, result.data);
      }
      return result;
    } else {
      return await this.request(endpoint, options);
    }
  }

  async clearCache() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith('api_cache_'));
      
      if (cacheKeys.length > 0) {
        await AsyncStorage.multiRemove(cacheKeys);
        console.log(`🗑️ ${cacheKeys.length} cache item temizlendi`);
      }
    } catch (error) {
      console.error('Cache temizleme hatası:', error);
    }
  }

  // OFFLINE QUEUE METHODS
  async addToOfflineQueue(request) {
    try {
      const queue = await AsyncStorage.getItem('offlineQueue');
      const offlineQueue = queue ? JSON.parse(queue) : [];
      
      offlineQueue.push({
        id: Date.now().toString(),
        ...request,
        timestamp: new Date().toISOString()
      });
      
      await AsyncStorage.setItem('offlineQueue', JSON.stringify(offlineQueue));
      console.log('📱 Offline queue\'e eklendi:', request.endpoint);
    } catch (error) {
      console.error('Offline queue hatası:', error);
    }
  }

  async processOfflineQueue() {
    try {
      const queue = await AsyncStorage.getItem('offlineQueue');
      if (!queue) return;
      
      const offlineQueue = JSON.parse(queue);
      const successfulRequests = [];
      
      for (const request of offlineQueue) {
        try {
          const result = await this.request(request.endpoint, request.options);
          if (result.success) {
            successfulRequests.push(request.id);
            console.log('✅ Offline request başarılı:', request.endpoint);
          }
        } catch (error) {
          console.log('❌ Offline request başarısız:', request.endpoint, error.message);
        }
      }
      
      if (successfulRequests.length > 0) {
        const remainingQueue = offlineQueue.filter(
          request => !successfulRequests.includes(request.id)
        );
        await AsyncStorage.setItem('offlineQueue', JSON.stringify(remainingQueue));
        console.log(`✅ ${successfulRequests.length} offline request işlendi`);
      }
      
    } catch (error) {
      console.error('Offline queue işleme hatası:', error);
    }
  }

  async getOfflineQueueCount() {
    try {
      const queue = await AsyncStorage.getItem('offlineQueue');
      return queue ? JSON.parse(queue).length : 0;
    } catch (error) {
      return 0;
    }
  }

  // MOCK METHODS
  async mockRequest(endpoint, options = {}) {
    // Mock delay simülasyonu
    await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 700));

    const method = options.method || 'GET';
    console.log(`🎭 Mock API: ${method} ${endpoint}`);

    // Mock responses
    switch (endpoint) {
      case '/auth/login':
        return {
          success: true,
          data: {
            user: {
              _id: 'user_123',
              id: 123,
              name: 'Test Kullanıcı',
              email: options.body?.email || 'test@example.com',
              phone: '+90 555 123 4567',
              avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face',
              role: 'customer',
              isVerified: true,
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: new Date().toISOString(),
            },
            token: 'mock_jwt_token_' + Date.now(),
            expiresIn: '7d'
          }
        };

      case '/products':
        return {
          success: true,
          data: {
            products: [
              {
                _id: 'prod_1',
                name: 'Profesyonel Saç Bakım Seti',
                description: 'Profesyonel kalitede saç bakım seti. Tüm saç tipleri için uygun.',
                price: 299.99,
                originalPrice: 399.99,
                discount: 25,
                images: [
                  'https://images.unsplash.com/photo-1522338242992-e1a54906a8da?w=400&h=400&fit=crop',
                  'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=400&h=400&fit=crop'
                ],
                category: 'Saç Bakımı',
                brand: 'ProfessionalCare',
                rating: 4.5,
                reviewCount: 127,
                inStock: true,
                stock: 25,
                features: ['Doğal içerik', 'Paraben free', 'Dermatolog onaylı'],
                specifications: {
                  weight: '500ml',
                  ingredients: 'Argan oil, Keratin, Vitamin E',
                  usage: 'Nemli saça uygulayın'
                },
                tags: ['saç bakımı', 'profesyonel', 'doğal'],
                isActive: true,
                isFeatured: true,
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: new Date().toISOString(),
              },
              {
                _id: 'prod_2',
                name: 'Argan Yağı Serumu',
                description: 'Doğal argan yağı ile zenginleştirilmiş onarıcı serum.',
                price: 149.99,
                originalPrice: 199.99,
                discount: 25,
                images: [
                  'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=400&h=400&fit=crop'
                ],
                category: 'Serum',
                brand: 'NaturalCare',
                rating: 4.8,
                reviewCount: 89,
                inStock: true,
                stock: 15,
                features: ['100% doğal', 'Onarıcı', 'Besleyici'],
                specifications: {
                  weight: '50ml',
                  ingredients: '100% Argan Oil',
                  usage: 'Saç uçlarına uygulayın'
                },
                tags: ['serum', 'argan', 'doğal'],
                isActive: true,
                isFeatured: false,
                createdAt: '2024-01-15T00:00:00.000Z',
                updatedAt: new Date().toISOString(),
              },
              {
                _id: 'prod_3',
                name: 'Saç Düzleştirici',
                description: 'Profesyonel seramik saç düzleştirici.',
                price: 899.99,
                originalPrice: 999.99,
                discount: 10,
                images: [
                  'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400&h=400&fit=crop'
                ],
                category: 'Araçlar',
                brand: 'TechStyle',
                rating: 4.3,
                reviewCount: 56,
                inStock: false,
                stock: 0,
                features: ['Seramik kaplama', 'Dijital gösterge', '2 yıl garanti'],
                specifications: {
                  power: '45W',
                  temperature: '80-230°C',
                  warranty: '2 years'
                },
                tags: ['düzleştirici', 'seramik', 'profesyonel'],
                isActive: true,
                isFeatured: false,
                createdAt: '2024-02-01T00:00:00.000Z',
                updatedAt: new Date().toISOString(),
              }
            ],
            pagination: {
              currentPage: 1,
              totalPages: 1,
              totalItems: 3,
              itemsPerPage: 20,
              hasNextPage: false,
              hasPrevPage: false
            }
          }
        };

      case '/hairdressers':
        return {
          success: true,
          data: {
            hairdressers: [
              {
                _id: 'hair_1',
                name: 'Zeynep Bayan Kuaför',
                description: 'Profesyonel kadın kuaförü, 15 yıllık deneyim',
                ownerName: 'Zeynep Hanım',
                avatar: 'https://images.unsplash.com/photo-1494790108755-2616c04e35d1?w=200&h=200&fit=crop&crop=face',
                coverImage: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=600&h=300&fit=crop',
                rating: 4.8,
                reviewCount: 156,
                priceRange: { min: 100, max: 500 },
                specialties: ['Saç Kesimi', 'Fön', 'Makyaj', 'Saç Boyama'],
                services: [
                  {
                    _id: 'service_1',
                    name: 'Saç Kesimi',
                    price: 150,
                    duration: 30,
                    description: 'Profesyonel saç kesimi'
                  },
                  {
                    _id: 'service_2',
                    name: 'Fön',
                    price: 100,
                    duration: 20,
                    description: 'Saç şekillendirme'
                  }
                ],
                location: {
                  address: 'Bağdat Caddesi No:123, Kadıköy',
                  city: 'İstanbul',
                  district: 'Kadıköy',
                  postalCode: '34710',
                  coordinates: {
                    latitude: 40.9876,
                    longitude: 29.0345
                  }
                },
                contact: {
                  phone: '+90 216 555 0123',
                  email: 'info@zeynepkuafor.com',
                  website: 'www.zeynepkuafor.com'
                },
                workingHours: {
                  monday: { open: '09:00', close: '18:00', isOpen: true },
                  tuesday: { open: '09:00', close: '18:00', isOpen: true },
                  wednesday: { open: '09:00', close: '18:00', isOpen: true },
                  thursday: { open: '09:00', close: '18:00', isOpen: true },
                  friday: { open: '09:00', close: '18:00', isOpen: true },
                  saturday: { open: '09:00', close: '17:00', isOpen: true },
                  sunday: { open: '10:00', close: '16:00', isOpen: true }
                },
                amenities: ['WiFi', 'Klima', 'Otopark', 'Kahve'],
                images: [
                  'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=400&h=300&fit=crop',
                  'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=400&h=300&fit=crop'
                ],
                distance: 2.5,
                isActive: true,
                isVerified: true,
                isFeatured: true,
                createdAt: '2023-06-01T00:00:00.000Z',
                updatedAt: new Date().toISOString(),
              }
            ],
            pagination: {
              currentPage: 1,
              totalPages: 1,
              totalItems: 1,
              itemsPerPage: 20,
              hasNextPage: false,
              hasPrevPage: false
            }
          }
        };

      // Diğer mock endpoint'ler için varsayılan response
      default:
        if (endpoint.startsWith('/orders') && method === 'POST') {
          return {
            success: true,
            data: {
              order: {
                _id: 'ord_' + Date.now(),
                orderNumber: `ORD-2024-${String(Date.now()).slice(-3)}`,
                status: 'pending',
                totalAmount: options.body?.totalPrice || 299.99,
                createdAt: new Date().toISOString(),
              },
              message: 'Siparişiniz başarıyla oluşturuldu.',
            }
          };
        }

        if (endpoint.startsWith('/appointments') && method === 'POST') {
          return {
            success: true,
            data: {
              appointment: {
                _id: 'app_' + Date.now(),
                appointmentNumber: `APP-2024-${String(Date.now()).slice(-3)}`,
                status: 'pending',
                date: options.body?.date,
                time: options.body?.time,
                totalPrice: options.body?.totalPrice || 250,
                createdAt: new Date().toISOString(),
              },
              message: 'Randevunuz başarıyla oluşturuldu.',
            }
          };
        }

        if (endpoint.includes('/cart/sync') && method === 'POST') {
          return {
            success: true,
            data: {
              message: 'Sepet başarıyla senkronize edildi',
              itemCount: options.body?.cartItems?.length || 0,
              timestamp: new Date().toISOString()
            }
          };
        }

        if (endpoint.includes('/related')) {
          return {
            success: true,
            data: {
              relatedProducts: [
                {
                  _id: 'related_1',
                  name: 'İlgili Ürün 1',
                  price: 199.99,
                  images: ['https://images.unsplash.com/photo-1522338242992-e1a54906a8da?w=200&h=200&fit=crop'],
                  category: 'Saç Bakımı',
                  rating: 4.2,
                  inStock: true,
                  isActive: true
                },
                {
                  _id: 'related_2',
                  name: 'İlgili Ürün 2',
                  price: 149.99,
                  images: ['https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=200&h=200&fit=crop'],
                  category: 'Serum',
                  rating: 4.5,
                  inStock: true,
                  isActive: true
                }
              ],
              count: 2,
              message: '2 ilgili ürün bulundu'
            }
          };
        }

        return { 
          success: false, 
          error: `Mock endpoint bulunamadı: ${method} ${endpoint}` 
        };
    }
  }

  // UTILITY METHODS
  setMockMode(enabled) {
    MOCK_MODE = enabled;
    console.log(`🎭 Mock mode: ${enabled ? 'Açık' : 'Kapalı'}`);
  }

  getMockMode() {
    return MOCK_MODE;
  }

  async getApiStats() {
    try {
      const stats = await AsyncStorage.getItem('apiStats');
      return stats ? JSON.parse(stats) : {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        cacheHits: 0,
        lastRequestTime: null,
        averageResponseTime: 0
      };
    } catch (error) {
      console.error('API stats hatası:', error);
      return null;
    }
  }

  async updateApiStats(success, responseTime) {
    try {
      const stats = await this.getApiStats();
      const newStats = {
        totalRequests: stats.totalRequests + 1,
        successfulRequests: stats.successfulRequests + (success ? 1 : 0),
        failedRequests: stats.failedRequests + (success ? 0 : 1),
        cacheHits: stats.cacheHits,
        lastRequestTime: new Date().toISOString(),
        averageResponseTime: ((stats.averageResponseTime * stats.totalRequests) + responseTime) / (stats.totalRequests + 1)
      };
      
      await AsyncStorage.setItem('apiStats', JSON.stringify(newStats));
    } catch (error) {
      console.error('API stats güncelleme hatası:', error);
    }
  }

  async testConnection() {
    try {
      const startTime = Date.now();
      const result = await this.checkNetworkStatus();
      const responseTime = Date.now() - startTime;
      
      return {
        connected: result,
        responseTime,
        server: this.baseURL,
        mockMode: MOCK_MODE,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        connected: false,
        error: error.message,
        server: this.baseURL,
        mockMode: MOCK_MODE,
        timestamp: new Date().toISOString()
      };
    }
  }

  async clearAllData() {
    try {
      const keysToRemove = [
        'authToken',
        'userToken', 
        'userData',
        'userId',
        'notifications',
        'offlineQueue',
        'apiStats'
      ];
      
      await AsyncStorage.multiRemove(keysToRemove);
      await this.clearCache();
      
      console.log('🗑️ Tüm uygulama verisi temizlendi');
      return { success: true };
    } catch (error) {
      console.error('Veri temizleme hatası:', error);
      return { success: false, error: error.message };
    }
  }

  async healthCheck() {
    const checks = {
      api: false,
      cache: false,
      storage: false,
      network: false
    };

    try {
      // API kontrolü
      const apiResult = await this.request('/health').catch(() => ({ success: false }));
      checks.api = apiResult.success;

      // Cache kontrolü
      const testKey = 'health_check_cache';
      await this.setCachedData(testKey, { test: true });
      const cachedData = await this.getCachedData(testKey);
      checks.cache = !!cachedData;
      await AsyncStorage.removeItem(testKey);

      // Storage kontrolü
      const storageTestKey = 'health_check_storage';
      await AsyncStorage.setItem(storageTestKey, 'test');
      const storageData = await AsyncStorage.getItem(storageTestKey);
      checks.storage = storageData === 'test';
      await AsyncStorage.removeItem(storageTestKey);

      // Network kontrolü
      checks.network = await this.checkNetworkStatus();

    } catch (error) {
      console.error('Health check hatası:', error);
    }

    const isHealthy = Object.values(checks).every(check => check === true);

    return {
      healthy: isHealthy,
      checks,
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    };
  }
}

// ApiService instance oluştur
const apiService = new ApiService();

// Development environment'da global olarak erişilebilir yap
if (__DEV__) {
  global.apiService = apiService;
}

export default apiService;