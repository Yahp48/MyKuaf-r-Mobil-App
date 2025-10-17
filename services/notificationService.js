import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';


Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

class NotificationService {
  constructor() {
    this.expoPushToken = null;
    this.notificationListener = null;
    this.responseListener = null;
    this.isInitialized = false;
    this.eventListeners = new Map();
    this.maxStoredNotifications = 100;
    
    
    this.notificationTypes = {
      ORDER_UPDATE: 'order_status_updated',
      ORDER_CONFIRMED: 'order_confirmed',
      ORDER_SHIPPED: 'order_shipped',
      ORDER_DELIVERED: 'order_delivered',
      ORDER_CANCELLED: 'order_cancelled',
      APPOINTMENT_CONFIRMED: 'appointment_confirmed',
      APPOINTMENT_REMINDER: 'appointment_reminder',
      APPOINTMENT_CANCELLED: 'appointment_cancelled',
      APPOINTMENT_UPDATED: 'appointment_updated',
      SYSTEM_NOTIFICATION: 'system_notification',
      PROMOTION: 'promotion',
      NEW_PRODUCT: 'new_product',
      CART_REMINDER: 'cart_reminder',
      DAILY_DEALS: 'daily_deals',
    };
  }


  async initialize() {
    if (this.isInitialized) return;

    try {
      console.log('🔔 Notification servisi başlatılıyor...');

      
      await this.registerForPushNotificationsAsync();

   
      await this.setupSocketIntegration();

     
      await this.loadStoredNotifications();

      this.isInitialized = true;
      console.log('✅ Notification servisi başarıyla başlatıldı');

    } catch (error) {
      console.error('❌ Notification servisi başlatma hatası:', error);
    }
  }


  async registerForPushNotificationsAsync() {
    let token;

    if (Platform.OS === 'android') {
      
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF4896',
      });
      
      
      await Notifications.setNotificationChannelAsync('orders', {
        name: 'Sipariş Bildirimleri',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#4CAF50',
        sound: 'order_notification.wav',
      });
      
     
      await Notifications.setNotificationChannelAsync('appointments', {
        name: 'Randevu Bildirimleri',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 500, 250, 500],
        lightColor: '#FF9800',
        sound: 'appointment_notification.wav',
      });

     
      await Notifications.setNotificationChannelAsync('system', {
        name: 'Sistem Bildirimleri',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 100, 100, 100],
        lightColor: '#2196F3',
      });

      
      await Notifications.setNotificationChannelAsync('promotions', {
        name: 'Promosyon Bildirimleri',
        importance: Notifications.AndroidImportance.NORMAL,
        vibrationPattern: [0, 200, 200, 200],
        lightColor: '#9C27B0',
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        Alert.alert(
          'Bildirim İzni',
          'Önemli güncellemeleri kaçırmamak için bildirim izni verin.',
          [
            { text: 'İptal', style: 'cancel' },
            { text: 'Ayarlar', onPress: () => Notifications.openNotificationSettingsAsync() }
          ]
        );
        return;
      }
      
      token = (await Notifications.getExpoPushTokenAsync()).data;
      console.log('📱 Push token:', token);
      
      
      await AsyncStorage.setItem('expoPushToken', token);
      
     
      await this.sendTokenToBackend(token);
    } else {
      console.warn('⚠️ Push notifications require physical device');
    }

    this.expoPushToken = token;
    return token;
  }

 
  async sendTokenToBackend(token) {
    try {
    
      const apiService = require('./apiService').default;
      
      await apiService.updatePushToken(token);
      console.log('✅ Push token admin panel backend\'ine gönderildi');
      
    } catch (error) {
      console.error('❌ Push token gönderme hatası:', error);
      
     
      try {
        const API_URL = __DEV__ ? 'http://localhost:5000/api' : 'https://your-backend-url.com/api';
        const authToken = await AsyncStorage.getItem('authToken');
        
        const response = await fetch(`${API_URL}/notifications/update-push-token`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
          },
          body: JSON.stringify({
            pushToken: token,
            platform: Platform.OS,
            deviceInfo: {
              brand: Device.brand,
              modelName: Device.modelName,
              osName: Device.osName,
              osVersion: Device.osVersion,
            }
          }),
        });
        
        if (response.ok) {
          console.log('✅ Push token fallback ile gönderildi');
        }
      } catch (fallbackError) {
        console.error('❌ Push token fallback hatası:', fallbackError);
      }
    }
  }

 

  async setupSocketIntegration() {
    try {
     
      const socketService = require('./socketServices').default;
      
    
      const socketListener = socketService.addEventListener('new_notification', (notification) => {
        console.log('🔌 Socket\'ten bildirim alındı:', notification);
        this.handleSocketNotification(notification);
      });

      const orderListener = socketService.addEventListener('order_status_updated', (data) => {
        console.log('📦 Socket sipariş güncellendi:', data);
        this.handleOrderUpdate(data);
      });

      
      const appointmentListener = socketService.addEventListener('appointment_updated', (data) => {
        console.log('📅 Socket randevu güncellendi:', data);
        this.handleAppointmentUpdate(data);
      });

     
      const systemListener = socketService.addEventListener('system_notification', (data) => {
        console.log('🔔 Socket sistem bildirimi:', data);
        this.handleSystemNotification(data);
      });

      console.log('✅ Socket integration kuruldu');
      
    } catch (error) {
      console.error('❌ Socket integration hatası:', error);
    }
  }



  handleSocketNotification(notification) {
   
    this.scheduleLocalNotification(
      notification.title,
      notification.body || notification.message,
      {
        type: notification.type || 'general',
        ...notification.data,
        socketNotification: true,
        timestamp: new Date().toISOString(),
      }
    );


    this.storeNotification(notification);
  }

  handleOrderUpdate(data) {
    const { order } = data;
    if (!order) return;

    
    this.sendOrderStatusNotification(order, order.status);

    
    this.notifyListeners('order_notification', { order, type: 'status_update' });
  }

  handleAppointmentUpdate(data) {
    const { appointment } = data;
    if (!appointment) return;

    let title, body;
    
    switch (appointment.status) {
      case 'confirmed':
        title = 'Randevu Onaylandı';
        body = `${appointment.date} tarihli randevunuz onaylandı`;
        break;
      case 'cancelled':
        title = 'Randevu İptal Edildi';
        body = `${appointment.date} tarihli randevunuz iptal edildi`;
        break;
      case 'rescheduled':
        title = 'Randevu Yeniden Planlandı';
        body = `Randevunuz ${appointment.date} tarihine alındı`;
        break;
      default:
        title = 'Randevu Güncellendi';
        body = `Randevunuz ${appointment.status} durumuna güncellendi`;
    }

    this.scheduleLocalNotification(title, body, {
      type: this.notificationTypes.APPOINTMENT_UPDATED,
      appointmentId: appointment._id || appointment.id,
      appointment: appointment,
    });

  
    this.notifyListeners('appointment_notification', { appointment, type: 'status_update' });
  }

  handleSystemNotification(data) {
    this.scheduleLocalNotification(
      data.title || 'Sistem Bildirimi',
      data.message || data.body,
      {
        type: this.notificationTypes.SYSTEM_NOTIFICATION,
        ...data.data,
        priority: 'high',
      }
    );
  }


  startNotificationListeners(navigation) {
    if (this.notificationListener || this.responseListener) {
      this.stopNotificationListeners();
    }

    
    this.notificationListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('📨 Bildirim alındı:', notification);
      this.handleNotificationReceived(notification);
    });

    this.responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('👆 Bildirime tıklandı:', response);
      this.handleNotificationResponse(response, navigation);
    });
  }

  stopNotificationListeners() {
    if (this.notificationListener) {
      Notifications.removeNotificationSubscription(this.notificationListener);
      this.notificationListener = null;
    }
    if (this.responseListener) {
      Notifications.removeNotificationSubscription(this.responseListener);
      this.responseListener = null;
    }
  }

  

  async handleNotificationReceived(notification) {
    const { title, body, data } = notification.request.content;
    
   
    await this.storeNotification({
      id: notification.request.identifier,
      title,
      body,
      data,
      receivedAt: new Date().toISOString(),
      read: false,
    });

    
    await this.updateBadgeCount();

    
    this.notifyListeners('notification_received', { title, body, data });

   
    switch (data?.type) {
      case this.notificationTypes.ORDER_UPDATE:
        this.handleOrderNotification(data);
        break;
      case this.notificationTypes.APPOINTMENT_CONFIRMED:
      case this.notificationTypes.APPOINTMENT_UPDATED:
        this.handleAppointmentNotification(data);
        break;
      case this.notificationTypes.PROMOTION:
        this.handlePromotionNotification(data);
        break;
      default:
        console.log('Genel bildirim işlendi:', { title, body });
    }
  }

  handleNotificationResponse(response, navigation) {
    const { data } = response.notification.request.content;
    
  
    this.markAsRead(response.notification.request.identifier);

   
    this.notifyListeners('notification_clicked', { data, response });

    
    if (!navigation) {
      console.warn('⚠️ Navigation instance yok, yönlendirme yapılamadı');
      return;
    }

    
    switch (data?.type) {
      case this.notificationTypes.ORDER_UPDATE:
      case this.notificationTypes.ORDER_CONFIRMED:
      case this.notificationTypes.ORDER_SHIPPED:
      case this.notificationTypes.ORDER_DELIVERED:
      case this.notificationTypes.ORDER_CANCELLED:
        if (data.orderId) {
          navigation.navigate('OrderDetail', { orderId: data.orderId });
        } else {
          navigation.navigate('Orders');
        }
        break;
        
      case this.notificationTypes.APPOINTMENT_CONFIRMED:
      case this.notificationTypes.APPOINTMENT_UPDATED:
      case this.notificationTypes.APPOINTMENT_REMINDER:
      case this.notificationTypes.APPOINTMENT_CANCELLED:
        if (data.appointmentId) {
          navigation.navigate('AppointmentDetail', { appointmentId: data.appointmentId });
        } else {
          navigation.navigate('Appointments');
        }
        break;
        
      case this.notificationTypes.PROMOTION:
      case this.notificationTypes.NEW_PRODUCT:
        if (data.productId) {
          navigation.navigate('ProductDetail', { productId: data.productId });
        } else {
          navigation.navigate('Shop');
        }
        break;
        
      case this.notificationTypes.CART_REMINDER:
        navigation.navigate('Cart');
        break;

      case this.notificationTypes.DAILY_DEALS:
        navigation.navigate('Shop', { section: 'deals' });
        break;
        
      default:
        navigation.navigate('Notifications');
    }
  }




  handleOrderNotification(data) {
    console.log('📦 Sipariş bildirimi işlendi:', data);
    
    this.notifyListeners('order_notification', data);
  }

  handleAppointmentNotification(data) {
    console.log('📅 Randevu bildirimi işlendi:', data);
    
    this.notifyListeners('appointment_notification', data);
  }

  
  handlePromotionNotification(data) {
    console.log('🎁 Promosyon bildirimi işlendi:', data);
    
    this.notifyListeners('promotion_notification', data);
  }

  

  async scheduleLocalNotification(title, body, data = {}, trigger = null) {
    try {
      const notificationContent = {
        title,
        body,
        data: {
          ...data,
          timestamp: new Date().toISOString(),
        },
        sound: this.getNotificationSound(data.type),
        badge: await this.getBadgeCount() + 1,
      };

     
      if (Platform.OS === 'android') {
        notificationContent.android = { 
          channelId: this.getNotificationChannel(data.type),
          color: this.getNotificationColor(data.type),
        };
      }

      const identifier = await Notifications.scheduleNotificationAsync({
        content: notificationContent,
        trigger: trigger || null, 
      });

      console.log(`📱 Local notification scheduled: ${identifier}`);
      return identifier;

    } catch (error) {
      console.error('❌ Local notification scheduling hatası:', error);
      return null;
    }
  }



  getNotificationChannel(type) {
    switch (type) {
      case this.notificationTypes.ORDER_UPDATE:
      case this.notificationTypes.ORDER_CONFIRMED:
      case this.notificationTypes.ORDER_SHIPPED:
      case this.notificationTypes.ORDER_DELIVERED:
      case this.notificationTypes.ORDER_CANCELLED:
        return 'orders';
      
      case this.notificationTypes.APPOINTMENT_CONFIRMED:
      case this.notificationTypes.APPOINTMENT_UPDATED:
      case this.notificationTypes.APPOINTMENT_REMINDER:
      case this.notificationTypes.APPOINTMENT_CANCELLED:
        return 'appointments';
      
      case this.notificationTypes.SYSTEM_NOTIFICATION:
        return 'system';
      
      case this.notificationTypes.PROMOTION:
      case this.notificationTypes.NEW_PRODUCT:
      case this.notificationTypes.DAILY_DEALS:
        return 'promotions';
      
      default:
        return 'default';
    }
  }

  getNotificationSound(type) {
    switch (type) {
      case this.notificationTypes.ORDER_UPDATE:
      case this.notificationTypes.ORDER_CONFIRMED:
        return 'order_notification.wav';
      
      case this.notificationTypes.APPOINTMENT_CONFIRMED:
      case this.notificationTypes.APPOINTMENT_REMINDER:
        return 'appointment_notification.wav';
      
      default:
        return 'default';
    }
  }

  getNotificationColor(type) {
    switch (type) {
      case this.notificationTypes.ORDER_UPDATE:
        return '#4CAF50'; 
      
      case this.notificationTypes.APPOINTMENT_CONFIRMED:
        return '#FF9800'; 
      
      case this.notificationTypes.SYSTEM_NOTIFICATION:
        return '#2196F3';
      
      case this.notificationTypes.PROMOTION:
        return '#9C27B0'; 
      
      default:
        return '#FF4896'; 
    }
  }



  async scheduleAppointmentReminder(appointment) {
    const { _id, id, salonName, hairdresserName, date, time } = appointment;
    const appointmentId = _id || id;
    
    
    const appointmentDate = new Date(`${date} ${time}`);
    const reminderDate = new Date(appointmentDate.getTime() - 60 * 60 * 1000);

    if (reminderDate > new Date()) {
      await this.scheduleLocalNotification(
        'Randevu Hatırlatması',
        `1 saat sonra ${salonName || hairdresserName} kuaföründe randevunuz var.`,
        {
          type: this.notificationTypes.APPOINTMENT_REMINDER,
          appointmentId: appointmentId,
          reminder: '1hour',
        },
        reminderDate
      );
    }

    
    const finalReminderDate = new Date(appointmentDate.getTime() - 15 * 60 * 1000);
    
    if (finalReminderDate > new Date()) {
      await this.scheduleLocalNotification(
        'Son Hatırlatma',
        `15 dakika sonra randevunuz başlayacak.`,
        {
          type: this.notificationTypes.APPOINTMENT_REMINDER,
          appointmentId: appointmentId,
          reminder: '15min',
        },
        finalReminderDate
      );
    }

    console.log(`📅 Randevu hatırlatmaları ayarlandı: ${appointmentId}`);
  }

 

  async sendOrderStatusNotification(order, status) {
    let title, body, channel;
    const orderId = order._id || order.id;

    switch (status) {
      case 'confirmed':
        title = 'Sipariş Onaylandı';
        body = `${order.orderNumber} numaralı siparişiniz onaylandı.`;
        break;
      case 'preparing':
        title = 'Sipariş Hazırlanıyor';
        body = `Siparişiniz hazırlanmaya başlandı.`;
        break;
      case 'shipped':
      case 'shipping':
        title = 'Sipariş Kargoya Verildi';
        body = `Siparişiniz kargoya verildi.${order.trackingNumber ? ` Takip: ${order.trackingNumber}` : ''}`;
        break;
      case 'delivered':
        title = 'Sipariş Teslim Edildi';
        body = `Siparişiniz başarıyla teslim edildi. Afiyet olsun!`;
        break;
      case 'cancelled':
        title = 'Sipariş İptal Edildi';
        body = `${order.orderNumber} numaralı siparişiniz iptal edildi.`;
        break;
      default:
        title = 'Sipariş Güncellendi';
        body = `Siparişiniz ${status} durumuna güncellendi.`;
    }

    await this.scheduleLocalNotification(title, body, {
      type: this.notificationTypes.ORDER_UPDATE,
      orderId: orderId,
      status: status,
      orderNumber: order.orderNumber,
    });
  }


  async sendPromotionNotification(promotion) {
    await this.scheduleLocalNotification(
      promotion.title || 'Özel Fırsat',
      promotion.message || promotion.body,
      {
        type: this.notificationTypes.PROMOTION,
        promotionId: promotion.id || promotion._id,
        couponCode: promotion.couponCode,
        discountAmount: promotion.discountAmount,
        validUntil: promotion.validUntil,
      }
    );
  }

 

  async scheduleDailyDeals() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0); 

    await this.scheduleLocalNotification(
      'Günün Fırsatları',
      'Bugünün özel indirimlerini kaçırma! Mağazayı kontrol et.',
      {
        type: this.notificationTypes.DAILY_DEALS,
        section: 'deals',
      },
      tomorrow
    );
  }

  async scheduleCartReminder() {
    const reminderDate = new Date();
    reminderDate.setHours(reminderDate.getHours() + 24); 

    await this.scheduleLocalNotification(
      'Sepetinde Ürünler Var',
      'Sepetindeki ürünleri unutma! Hemen sipariş ver.',
      {
        type: this.notificationTypes.CART_REMINDER,
        action: 'reminder',
      },
      reminderDate
    );
  }

 

  async storeNotification(notification) {
    try {
      const stored = await this.getStoredNotifications();
      const newNotification = {
        id: notification.id || Date.now().toString(),
        ...notification,
        storedAt: new Date().toISOString(),
      };

      stored.unshift(newNotification);
      
     
      if (stored.length > this.maxStoredNotifications) {
        stored.splice(this.maxStoredNotifications);
      }

      await AsyncStorage.setItem('stored_notifications', JSON.stringify(stored));
      console.log(`💾 Notification stored: ${newNotification.id}`);

    } catch (error) {
      console.error('❌ Notification storing hatası:', error);
    }
  }

  async getStoredNotifications() {
    try {
      const stored = await AsyncStorage.getItem('stored_notifications');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('❌ Stored notifications yükleme hatası:', error);
      return [];
    }
  }

  async loadStoredNotifications() {
    const notifications = await this.getStoredNotifications();
    console.log(`📋 ${notifications.length} stored notification yüklendi`);
    return notifications;
  }

  async markAsRead(notificationId) {
    try {
      const stored = await this.getStoredNotifications();
      const updated = stored.map(notif => 
        notif.id === notificationId ? { ...notif, read: true, readAt: new Date().toISOString() } : notif
      );
      
      await AsyncStorage.setItem('stored_notifications', JSON.stringify(updated));
      await this.updateBadgeCount();
      
      console.log(`✅ Notification marked as read: ${notificationId}`);
      
    } catch (error) {
      console.error('❌ Mark as read hatası:', error);
    }
  }

  async markAllAsRead() {
    try {
      const stored = await this.getStoredNotifications();
      const updated = stored.map(notif => ({ 
        ...notif, 
        read: true, 
        readAt: new Date().toISOString() 
      }));
      
      await AsyncStorage.setItem('stored_notifications', JSON.stringify(updated));
      await this.setBadgeCount(0);
      
      console.log('✅ Tüm bildirimler okundu olarak işaretlendi');
      
    } catch (error) {
      console.error('❌ Mark all as read hatası:', error);
    }
  }

 

  async getBadgeCount() {
    try {
      const stored = await this.getStoredNotifications();
      return stored.filter(notif => !notif.read).length;
    } catch (error) {
      console.error('❌ Badge count alma hatası:', error);
      return 0;
    }
  }

  async updateBadgeCount() {
    const count = await this.getBadgeCount();
    await this.setBadgeCount(count);
    return count;
  }

  async setBadgeCount(count) {
    try {
      await Notifications.setBadgeCountAsync(count);
      console.log(`🔢 Badge count güncellendi: ${count}`);
    } catch (error) {
      console.error('❌ Badge count ayarlama hatası:', error);
    }
  }

  async clearBadge() {
    await this.setBadgeCount(0);
  }



  addEventListener(eventName, callback) {
    if (!this.eventListeners.has(eventName)) {
      this.eventListeners.set(eventName, []);
    }
    this.eventListeners.get(eventName).push(callback);
    
 
    return () => {
      const listeners = this.eventListeners.get(eventName);
      if (listeners) {
        const index = listeners.indexOf(callback);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    };
  }

  notifyListeners(eventName, data) {
    const listeners = this.eventListeners.get(eventName);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Event listener error for ${eventName}:`, error);
        }
      });
    }
  }



  async cancelAllScheduledNotifications() {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('🗑️ Tüm zamanlanmış bildirimler iptal edildi');
  }

  async cancelScheduledNotification(identifier) {
    await Notifications.cancelScheduledNotificationAsync(identifier);
    console.log(`🗑️ Scheduled notification iptal edildi: ${identifier}`);
  }

  async checkPermissions() {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  }

  async sendTestNotification() {
    await this.scheduleLocalNotification(
      'Test Bildirimi',
      'Push bildirimler çalışıyor! 🎉',
      { 
        type: 'test',
        timestamp: new Date().toISOString(),
        testMode: true,
      }
    );
  }

  
  async getNotificationSettings() {
    try {
      const settings = await AsyncStorage.getItem('notification_settings');
      const defaultSettings = {
        orders: true,
        appointments: true,
        promotions: true,
        system: true,
        sound: true,
        vibration: true,
        badge: true,
      };
      
      return settings ? { ...defaultSettings, ...JSON.parse(settings) } : defaultSettings;
    } catch (error) {
      console.error('❌ Notification settings alma hatası:', error);
      return {
        orders: true,
        appointments: true,
        promotions: true,
        system: true,
        sound: true,
        vibration: true,
        badge: true,
      };
    }
  }

 
  async updateNotificationSettings(settings) {
    try {
      await AsyncStorage.setItem('notification_settings', JSON.stringify(settings));
      console.log('✅ Notification settings güncellendi:', settings);
      
      
      this.notifyListeners('settings_updated', settings);
      
    } catch (error) {
      console.error('❌ Notification settings kaydetme hatası:', error);
    }
  }


  async isNotificationTypeEnabled(type) {
    const settings = await this.getNotificationSettings();
    
    switch (type) {
      case this.notificationTypes.ORDER_UPDATE:
      case this.notificationTypes.ORDER_CONFIRMED:
      case this.notificationTypes.ORDER_SHIPPED:
      case this.notificationTypes.ORDER_DELIVERED:
      case this.notificationTypes.ORDER_CANCELLED:
        return settings.orders;
      
      case this.notificationTypes.APPOINTMENT_CONFIRMED:
      case this.notificationTypes.APPOINTMENT_UPDATED:
      case this.notificationTypes.APPOINTMENT_REMINDER:
      case this.notificationTypes.APPOINTMENT_CANCELLED:
        return settings.appointments;
      
      case this.notificationTypes.PROMOTION:
      case this.notificationTypes.NEW_PRODUCT:
      case this.notificationTypes.DAILY_DEALS:
        return settings.promotions;
      
      case this.notificationTypes.SYSTEM_NOTIFICATION:
        return settings.system;
      
      default:
        return true;
    }
  }

 

  async getNotificationStats() {
    try {
      const stored = await this.getStoredNotifications();
      const settings = await this.getNotificationSettings();
      
      const stats = {
        total: stored.length,
        unread: stored.filter(n => !n.read).length,
        read: stored.filter(n => n.read).length,
        byType: {},
        settings: settings,
        lastNotification: stored[0]?.storedAt || null,
        pushToken: this.expoPushToken,
        permissionsGranted: await this.checkPermissions(),
      };

      
      stored.forEach(notif => {
        const type = notif.data?.type || 'unknown';
        stats.byType[type] = (stats.byType[type] || 0) + 1;
      });

      return stats;
    } catch (error) {
      console.error('❌ Notification stats hatası:', error);
      return null;
    }
  }


  async debugNotifications() {
    try {
      const stats = await this.getNotificationStats();
      console.log('🔍 Notification Debug Info:', {
        isInitialized: this.isInitialized,
        expoPushToken: this.expoPushToken ? 'Set' : 'Not Set',
        listenerActive: !!this.notificationListener,
        responseListenerActive: !!this.responseListener,
        stats: stats,
        eventListenersCount: Array.from(this.eventListeners.entries()).map(([key, listeners]) => ({
          event: key,
          listenerCount: listeners.length
        }))
      });
    } catch (error) {
      console.error('❌ Debug hatası:', error);
    }
  }



  async clearAllNotifications() {
    try {
      await AsyncStorage.removeItem('stored_notifications');
      await this.clearBadge();
      console.log('🗑️ Tüm bildirimler temizlendi');
    } catch (error) {
      console.error('❌ Notification temizleme hatası:', error);
    }
  }

  async clearOldNotifications(daysOld = 30) {
    try {
      const stored = await this.getStoredNotifications();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const filtered = stored.filter(notif => {
        const notifDate = new Date(notif.storedAt || notif.receivedAt || notif.timestamp);
        return notifDate > cutoffDate;
      });

      await AsyncStorage.setItem('stored_notifications', JSON.stringify(filtered));
      
      const removedCount = stored.length - filtered.length;
      console.log(`🗑️ ${removedCount} eski bildirim temizlendi (${daysOld} günden eski)`);
      
      return removedCount;
    } catch (error) {
      console.error('❌ Eski bildirim temizleme hatası:', error);
      return 0;
    }
  }

  
  cleanup() {
    this.stopNotificationListeners();
    this.eventListeners.clear();
    this.isInitialized = false;
    this.expoPushToken = null;
    console.log('🧹 NotificationService temizlendi');
  }

  
  
  async sendInstantNotification(notification) {
    const { title, body, data = {}, users = [] } = notification;
    
    
    const currentUser = await AsyncStorage.getItem('userData');
    const currentUserId = currentUser ? JSON.parse(currentUser)._id : null;
    
    if (users.length === 0 || users.includes(currentUserId)) {
      await this.scheduleLocalNotification(title, body, {
        ...data,
        adminNotification: true,
        priority: 'high',
      });
    }
  }

  
  async handleBulkNotification(bulkData) {
    const { notifications = [] } = bulkData;
    
    for (const notification of notifications) {
      await this.sendInstantNotification(notification);
      
     
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`📮 ${notifications.length} bulk notification işlendi`);
  }

  
  async syncNotificationStatus() {
    try {
      const stats = await this.getNotificationStats();
      const apiService = require('./apiService').default;
      
      await apiService.request('/notifications/sync-status', {
        method: 'POST',
        body: {
          pushToken: this.expoPushToken,
          unreadCount: stats.unread,
          lastSync: new Date().toISOString(),
          settings: stats.settings,
        }
      });
      
      console.log('🔄 Notification status synced with backend');
      
    } catch (error) {
      console.error('❌ Notification sync hatası:', error);
    }
  }



  
  getStatusText(status) {
    const statusMap = {
      'pending': 'Beklemede',
      'confirmed': 'Onaylandı',
      'preparing': 'Hazırlanıyor',
      'shipping': 'Kargoda',
      'shipped': 'Kargoya Verildi',
      'delivered': 'Teslim Edildi',
      'cancelled': 'İptal Edildi',
      'completed': 'Tamamlandı',
    };
    
    return statusMap[status] || status;
  }

  
  getPriorityLevel(type) {
    const priorities = {
      [this.notificationTypes.ORDER_DELIVERED]: 5,
      [this.notificationTypes.ORDER_CANCELLED]: 5,
      [this.notificationTypes.APPOINTMENT_CANCELLED]: 5,
      [this.notificationTypes.SYSTEM_NOTIFICATION]: 4,
      [this.notificationTypes.ORDER_CONFIRMED]: 4,
      [this.notificationTypes.APPOINTMENT_CONFIRMED]: 4,
      [this.notificationTypes.ORDER_SHIPPED]: 3,
      [this.notificationTypes.APPOINTMENT_REMINDER]: 3,
      [this.notificationTypes.ORDER_UPDATE]: 2,
      [this.notificationTypes.APPOINTMENT_UPDATED]: 2,
      [this.notificationTypes.PROMOTION]: 1,
      [this.notificationTypes.NEW_PRODUCT]: 1,
      [this.notificationTypes.DAILY_DEALS]: 1,
    };
    
    return priorities[type] || 2;
  }

  
  async adjustForNetworkCondition() {
    try {
      const apiService = require('./apiService').default;
      const isOnline = await apiService.checkNetworkStatus();
      
      if (!isOnline) {
        console.log('📵 Offline mode: Notification\'lar local olarak saklanacak');
       
        return 'offline';
      } else {
        console.log('📶 Online mode: Full notification support');
      
        return 'online';
      }
    } catch (error) {
      console.error('❌ Network condition check hatası:', error);
      return 'unknown';
    }
  }
}


const notificationService = new NotificationService();

export default notificationService;