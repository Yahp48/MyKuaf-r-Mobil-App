
import io from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.listeners = new Map();
    this.userId = null;
    this.userType = null; 
    
   
    this.serverUrl = __DEV__ 
      ? 'http://localhost:5000'  
      : 'https://your-backend-url.com'; 
  }

  
  async connect(userId, userType = 'customer') {
    try {
      this.userId = userId;
      this.userType = userType;

      console.log('📱 Mobil Socket.IO bağlantısı kuruluyor...', {
        server: this.serverUrl,
        userId,
        userType
      });

      
      if (this.socket) {
        this.socket.disconnect();
      }

     
      this.socket = io(this.serverUrl, {
        autoConnect: true,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: this.maxReconnectAttempts,
        timeout: 20000,
        forceNew: true,
        transports: ['websocket', 'polling']
      });

      this.setupEventListeners();
      this.setupConnectionEvents();

      
      this.socket.emit('mobile-join', {
        userId: this.userId,
        userType: this.userType,
        platform: 'mobile',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Socket bağlantı hatası:', error);
    }
  }

 
  setupConnectionEvents() {
    this.socket.on('connect', () => {
      console.log('✅ Mobil Socket.IO bağlandı');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      
      this.notifyListeners('connection_success', {
        connected: true,
        userId: this.userId,
        socketId: this.socket.id
      });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Mobil Socket.IO bağlantısı kesildi:', reason);
      this.isConnected = false;
      
      this.notifyListeners('connection_lost', {
        connected: false,
        reason
      });

      if (reason === 'io server disconnect') {
        
        this.socket.connect();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.log('⚠️ Socket bağlantı hatası:', error.message);
      this.isConnected = false;
      this.reconnectAttempts++;

      this.notifyListeners('connection_error', {
        connected: false,
        error: error.message,
        attempts: this.reconnectAttempts
      });

     
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        Alert.alert(
          'Bağlantı Sorunu',
          'Sunucuya bağlanılamıyor. Lütfen internet bağlantınızı kontrol edin.',
          [{ text: 'Tamam' }]
        );
      }
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log(`🔄 Socket yeniden bağlandı (${attemptNumber}. deneme)`);
      
      this.notifyListeners('reconnected', {
        connected: true,
        attempts: attemptNumber
      });
    });
  }

  setupEventListeners() {
   
    
    this.socket.on('order-status-updated', (data) => {
      console.log('📦 Sipariş durumu güncellendi:', data);
      
      this.notifyListeners('order_status_updated', data);
      
      
      if (data.order && data.order.userId === this.userId) {
        this.showNotification({
          title: 'Sipariş Güncellendi',
          body: `Siparişiniz ${data.order.status} durumuna güncellendi`,
          data: { orderId: data.order._id, type: 'order_update' }
        });
      }
    });

   
    this.socket.on('order-confirmed', (data) => {
      console.log('✅ Sipariş onaylandı:', data);
      
      this.notifyListeners('order_confirmed', data);
      
      if (data.order && data.order.userId === this.userId) {
        this.showNotification({
          title: 'Sipariş Onaylandı',
          body: 'Siparişiniz onaylandı ve hazırlanmaya başlandı',
          data: { orderId: data.order._id, type: 'order_confirmed' }
        });
      }
    });

    
    this.socket.on('appointment-updated', (data) => {
      console.log('📅 Randevu güncellendi:', data);
      
      this.notifyListeners('appointment_updated', data);
      
      
      if (data.appointment && data.appointment.userId === this.userId) {
        this.showNotification({
          title: 'Randevu Güncellendi',
          body: `Randevunuz ${data.appointment.status} durumuna güncellendi`,
          data: { appointmentId: data.appointment._id, type: 'appointment_update' }
        });
      }
    });

    
    this.socket.on('appointment-confirmed', (data) => {
      console.log('✅ Randevu onaylandı:', data);
      
      this.notifyListeners('appointment_confirmed', data);
      
      if (data.appointment && data.appointment.userId === this.userId) {
        this.showNotification({
          title: 'Randevu Onaylandı',
          body: `${data.appointment.date} tarihli randevunuz onaylandı`,
          data: { appointmentId: data.appointment._id, type: 'appointment_confirmed' }
        });
      }
    });

   
    if (this.userType === 'hairdresser') {
      
      this.socket.on('new-appointment-request', (data) => {
        console.log('📅 Yeni randevu talebi:', data);
        
        this.notifyListeners('new_appointment_request', data);
        
        if (data.appointment && data.appointment.hairdresserId === this.userId) {
          this.showNotification({
            title: 'Yeni Randevu Talebi',
            body: `${data.appointment.customerName} randevu talebinde bulundu`,
            data: { appointmentId: data.appointment._id, type: 'new_appointment' }
          });
        }
      });

      
      this.socket.on('hairdresser-profile-updated', (data) => {
        console.log('💇‍♀️ Kuaför profili güncellendi:', data);
        
        this.notifyListeners('profile_updated', data);
        
        if (data.hairdresser && data.hairdresser._id === this.userId) {
          this.showNotification({
            title: 'Profil Güncellendi',
            body: 'Profiliniz başarıyla güncellendi',
            data: { type: 'profile_update' }
          });
        }
      });
    }

   

    
    this.socket.on('system-notification', (data) => {
      console.log('🔔 Sistem bildirimi:', data);
      
      this.notifyListeners('system_notification', data);
      
      this.showNotification({
        title: data.title || 'Sistem Bildirimi',
        body: data.message,
        data: { type: 'system_notification' }
      });
    });

    
    this.socket.on('app-update-available', (data) => {
      console.log('📱 Uygulama güncellemesi mevcut:', data);
      
      this.notifyListeners('app_update_available', data);
      
      Alert.alert(
        'Güncelleme Mevcut',
        'Yeni bir uygulama sürümü mevcut. Güncellemek ister misiniz?',
        [
          { text: 'Sonra', style: 'cancel' },
          { text: 'Güncelle', onPress: () => {
            
            this.notifyListeners('app_update_requested', data);
          }}
        ]
      );
    });
  }

  
  addEventListener(eventName, callback) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, []);
    }
    this.listeners.get(eventName).push(callback);
    
    return () => {
     
      const eventListeners = this.listeners.get(eventName);
      if (eventListeners) {
        const index = eventListeners.indexOf(callback);
        if (index > -1) {
          eventListeners.splice(index, 1);
        }
      }
    };
  }

 
  notifyListeners(eventName, data) {
    const eventListeners = this.listeners.get(eventName);
    if (eventListeners) {
      eventListeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Event listener error for ${eventName}:`, error);
        }
      });
    }
  }

 
  emit(eventName, data) {
    if (this.socket && this.isConnected) {
      this.socket.emit(eventName, {
        ...data,
        userId: this.userId,
        userType: this.userType,
        timestamp: new Date().toISOString()
      });
    } else {
      console.warn('Socket bağlantısı yok, event gönderilemedi:', eventName);
    }
  }

  
  async showNotification(notification) {
    try {
      
      const notifications = await AsyncStorage.getItem('notifications');
      const notificationList = notifications ? JSON.parse(notifications) : [];
      
      const newNotification = {
        id: Date.now().toString(),
        ...notification,
        timestamp: new Date().toISOString(),
        read: false
      };
      
      notificationList.unshift(newNotification);
      
      
      const limitedNotifications = notificationList.slice(0, 50);
      
      await AsyncStorage.setItem('notifications', JSON.stringify(limitedNotifications));
      
      
      this.notifyListeners('new_notification', newNotification);
      
      console.log('📱 Yeni bildirim:', notification.title);
      
    } catch (error) {
      console.error('Bildirim kaydetme hatası:', error);
    }
  }

  
  async getNotifications() {
    try {
      const notifications = await AsyncStorage.getItem('notifications');
      return notifications ? JSON.parse(notifications) : [];
    } catch (error) {
      console.error('Bildirimler yüklenirken hata:', error);
      return [];
    }
  }

  
  async markNotificationAsRead(notificationId) {
    try {
      const notifications = await AsyncStorage.getItem('notifications');
      if (notifications) {
        const notificationList = JSON.parse(notifications);
        const updatedList = notificationList.map(notif => 
          notif.id === notificationId ? { ...notif, read: true } : notif
        );
        await AsyncStorage.setItem('notifications', JSON.stringify(updatedList));
        
        this.notifyListeners('notification_read', { notificationId });
      }
    } catch (error) {
      console.error('Bildirim güncelleme hatası:', error);
    }
  }

  
  updateOrderStatus(orderId, status, message) {
    this.emit('update-order-status', {
      orderId,
      status,
      message
    });
  }

 
  updateAppointmentStatus(appointmentId, status, message) {
    this.emit('update-appointment-status', {
      appointmentId,
      status,
      message
    });
  }

  
  updateUserLocation(latitude, longitude) {
    this.emit('update-user-location', {
      latitude,
      longitude
    });
  }

  
  disconnect() {
    if (this.socket) {
      console.log('📱 Socket bağlantısı kapatılıyor...');
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.listeners.clear();
    }
  }

  
  getConnectionStatus() {
    return {
      connected: this.isConnected,
      socketId: this.socket ? this.socket.id : null,
      userId: this.userId,
      userType: this.userType,
      reconnectAttempts: this.reconnectAttempts
    };
  }
}


const socketService = new SocketService();

export default socketService;