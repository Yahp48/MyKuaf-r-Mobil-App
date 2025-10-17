import React, { createContext, useContext, useReducer, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';


const AppContext = createContext();


const initialState = {

  user: null,
  isLoggedIn: false,
  
  
  cartItems: [],
  cartCount: 0,
  
  
  favorites: [],
  
  
  appointments: [],
  
  
  products: [],
  
  
  notifications: [],
  unreadNotifications: 0,
  
  
  settings: {
    pushNotifications: true,
    emailNotifications: true,
    language: 'tr',
    currency: 'TRY',
  },
  
 
  loading: {
    products: false,
    cart: false,
    appointments: false,
  },
  
  
  errors: {},
};


const actionTypes = {
  
  SET_USER: 'SET_USER',
  LOGOUT: 'LOGOUT',
  
  
  ADD_TO_CART: 'ADD_TO_CART',
  REMOVE_FROM_CART: 'REMOVE_FROM_CART',
  UPDATE_CART_QUANTITY: 'UPDATE_CART_QUANTITY',
  CLEAR_CART: 'CLEAR_CART',
  
  
  ADD_TO_FAVORITES: 'ADD_TO_FAVORITES',
  REMOVE_FROM_FAVORITES: 'REMOVE_FROM_FAVORITES',
  
  
  SET_PRODUCTS: 'SET_PRODUCTS',
  UPDATE_PRODUCT: 'UPDATE_PRODUCT',
  
  
  SET_APPOINTMENTS: 'SET_APPOINTMENTS',
  ADD_APPOINTMENT: 'ADD_APPOINTMENT',
  UPDATE_APPOINTMENT: 'UPDATE_APPOINTMENT',
  CANCEL_APPOINTMENT: 'CANCEL_APPOINTMENT',
 
  SET_NOTIFICATIONS: 'SET_NOTIFICATIONS',
  ADD_NOTIFICATION: 'ADD_NOTIFICATION',
  MARK_NOTIFICATION_READ: 'MARK_NOTIFICATION_READ',
  CLEAR_NOTIFICATIONS: 'CLEAR_NOTIFICATIONS',
  
  
  UPDATE_SETTINGS: 'UPDATE_SETTINGS',
  
  
  SET_LOADING: 'SET_LOADING',
  
  
  SET_ERROR: 'SET_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR',
};


function appReducer(state, action) {
  switch (action.type) {
    case actionTypes.SET_USER:
      return {
        ...state,
        user: action.payload,
        isLoggedIn: !!action.payload,
      };
      
    case actionTypes.LOGOUT:
      return {
        ...state,
        user: null,
        isLoggedIn: false,
        cartItems: [],
        cartCount: 0,
        favorites: [],
        appointments: [],
      };
      
    case actionTypes.ADD_TO_CART:
      const existingItem = state.cartItems.find(item => item.id === action.payload.id);
      let newCartItems;
      
      if (existingItem) {
        newCartItems = state.cartItems.map(item =>
          item.id === action.payload.id
            ? { ...item, quantity: item.quantity + (action.payload.quantity || 1) }
            : item
        );
      } else {
        newCartItems = [...state.cartItems, { ...action.payload, quantity: action.payload.quantity || 1 }];
      }
      
      return {
        ...state,
        cartItems: newCartItems,
        cartCount: newCartItems.reduce((total, item) => total + item.quantity, 0),
      };
      
    case actionTypes.REMOVE_FROM_CART:
      const filteredItems = state.cartItems.filter(item => item.id !== action.payload);
      return {
        ...state,
        cartItems: filteredItems,
        cartCount: filteredItems.reduce((total, item) => total + item.quantity, 0),
      };
      
    case actionTypes.UPDATE_CART_QUANTITY:
      const updatedItems = state.cartItems.map(item =>
        item.id === action.payload.id
          ? { ...item, quantity: action.payload.quantity }
          : item
      );
      return {
        ...state,
        cartItems: updatedItems,
        cartCount: updatedItems.reduce((total, item) => total + item.quantity, 0),
      };
      
    case actionTypes.CLEAR_CART:
      return {
        ...state,
        cartItems: [],
        cartCount: 0,
      };
      
    case actionTypes.ADD_TO_FAVORITES:
      return {
        ...state,
        favorites: [...state.favorites, action.payload],
      };
      
    case actionTypes.REMOVE_FROM_FAVORITES:
      return {
        ...state,
        favorites: state.favorites.filter(item => item.id !== action.payload),
      };
      
    case actionTypes.SET_PRODUCTS:
      return {
        ...state,
        products: action.payload,
      };
      
    case actionTypes.UPDATE_PRODUCT:
      return {
        ...state,
        products: state.products.map(product =>
          product.id === action.payload.id ? { ...product, ...action.payload } : product
        ),
      };
      
    case actionTypes.SET_APPOINTMENTS:
      return {
        ...state,
        appointments: action.payload,
      };
      
    case actionTypes.ADD_APPOINTMENT:
      return {
        ...state,
        appointments: [...state.appointments, action.payload],
      };
      
    case actionTypes.UPDATE_APPOINTMENT:
      return {
        ...state,
        appointments: state.appointments.map(appointment =>
          appointment.id === action.payload.id ? { ...appointment, ...action.payload } : appointment
        ),
      };
      
    case actionTypes.CANCEL_APPOINTMENT:
      return {
        ...state,
        appointments: state.appointments.map(appointment =>
          appointment.id === action.payload ? { ...appointment, status: 'cancelled' } : appointment
        ),
      };
      
    case actionTypes.SET_NOTIFICATIONS:
      const unreadCount = action.payload.filter(notif => !notif.read).length;
      return {
        ...state,
        notifications: action.payload,
        unreadNotifications: unreadCount,
      };
      
    case actionTypes.ADD_NOTIFICATION:
      return {
        ...state,
        notifications: [action.payload, ...state.notifications],
        unreadNotifications: state.unreadNotifications + 1,
      };
      
    case actionTypes.MARK_NOTIFICATION_READ:
      const updatedNotifications = state.notifications.map(notif =>
        notif.id === action.payload ? { ...notif, read: true } : notif
      );
      return {
        ...state,
        notifications: updatedNotifications,
        unreadNotifications: updatedNotifications.filter(notif => !notif.read).length,
      };
      
    case actionTypes.CLEAR_NOTIFICATIONS:
      return {
        ...state,
        notifications: [],
        unreadNotifications: 0,
      };
      
    case actionTypes.UPDATE_SETTINGS:
      return {
        ...state,
        settings: { ...state.settings, ...action.payload },
      };
      
    case actionTypes.SET_LOADING:
      return {
        ...state,
        loading: { ...state.loading, [action.payload.key]: action.payload.value },
      };
      
    case actionTypes.SET_ERROR:
      return {
        ...state,
        errors: { ...state.errors, [action.payload.key]: action.payload.message },
      };
      
    case actionTypes.CLEAR_ERROR:
      const { [action.payload]: removed, ...remainingErrors } = state.errors;
      return {
        ...state,
        errors: remainingErrors,
      };
      
    default:
      return state;
  }
}


export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  useEffect(() => {
    loadDataFromStorage();
  }, []);


  
  useEffect(() => {
    saveDataToStorage();
  }, [state.cartItems, state.favorites, state.user, state.settings]);

  const loadDataFromStorage = async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      const cartData = await AsyncStorage.getItem('cartItems');
      const favoritesData = await AsyncStorage.getItem('favorites');
      const settingsData = await AsyncStorage.getItem('settings');

      if (userData) {
        dispatch({ type: actionTypes.SET_USER, payload: JSON.parse(userData) });
      }
      
      if (cartData) {
        const cartItems = JSON.parse(cartData);
        cartItems.forEach(item => {
          dispatch({ type: actionTypes.ADD_TO_CART, payload: item });
        });
      }
      
      if (favoritesData) {
        const favorites = JSON.parse(favoritesData);
        favorites.forEach(item => {
          dispatch({ type: actionTypes.ADD_TO_FAVORITES, payload: item });
        });
      }
      
      if (settingsData) {
        dispatch({ type: actionTypes.UPDATE_SETTINGS, payload: JSON.parse(settingsData) });
      }
    } catch (error) {
      console.error('AsyncStorage yükleme hatası:', error);
    }
  };

  const saveDataToStorage = async () => {
    try {
      await AsyncStorage.setItem('user', JSON.stringify(state.user));
      await AsyncStorage.setItem('cartItems', JSON.stringify(state.cartItems));
      await AsyncStorage.setItem('favorites', JSON.stringify(state.favorites));
      await AsyncStorage.setItem('settings', JSON.stringify(state.settings));
    } catch (error) {
      console.error('AsyncStorage kaydetme hatası:', error);
    }
  };

 
  const actions = {
   
    setUser: (user) => dispatch({ type: actionTypes.SET_USER, payload: user }),
    logout: () => dispatch({ type: actionTypes.LOGOUT }),
    
    
    addToCart: (product) => dispatch({ type: actionTypes.ADD_TO_CART, payload: product }),
    removeFromCart: (productId) => dispatch({ type: actionTypes.REMOVE_FROM_CART, payload: productId }),
    updateCartQuantity: (productId, quantity) => 
      dispatch({ type: actionTypes.UPDATE_CART_QUANTITY, payload: { id: productId, quantity } }),
    clearCart: () => dispatch({ type: actionTypes.CLEAR_CART }),
    
   
    addToFavorites: (product) => dispatch({ type: actionTypes.ADD_TO_FAVORITES, payload: product }),
    removeFromFavorites: (productId) => dispatch({ type: actionTypes.REMOVE_FROM_FAVORITES, payload: productId }),
    
    
    setProducts: (products) => dispatch({ type: actionTypes.SET_PRODUCTS, payload: products }),
    updateProduct: (product) => dispatch({ type: actionTypes.UPDATE_PRODUCT, payload: product }),
    
    
    setAppointments: (appointments) => dispatch({ type: actionTypes.SET_APPOINTMENTS, payload: appointments }),
    addAppointment: (appointment) => dispatch({ type: actionTypes.ADD_APPOINTMENT, payload: appointment }),
    updateAppointment: (appointment) => dispatch({ type: actionTypes.UPDATE_APPOINTMENT, payload: appointment }),
    cancelAppointment: (appointmentId) => dispatch({ type: actionTypes.CANCEL_APPOINTMENT, payload: appointmentId }),
    
    
    setNotifications: (notifications) => dispatch({ type: actionTypes.SET_NOTIFICATIONS, payload: notifications }),
    addNotification: (notification) => dispatch({ type: actionTypes.ADD_NOTIFICATION, payload: notification }),
    markNotificationRead: (notificationId) => dispatch({ type: actionTypes.MARK_NOTIFICATION_READ, payload: notificationId }),
    clearNotifications: () => dispatch({ type: actionTypes.CLEAR_NOTIFICATIONS }),
    
    
    updateSettings: (settings) => dispatch({ type: actionTypes.UPDATE_SETTINGS, payload: settings }),
    
   
    setLoading: (key, value) => dispatch({ type: actionTypes.SET_LOADING, payload: { key, value } }),
    
    
    setError: (key, message) => dispatch({ type: actionTypes.SET_ERROR, payload: { key, message } }),
    clearError: (key) => dispatch({ type: actionTypes.CLEAR_ERROR, payload: key }),
  };

  return (
    <AppContext.Provider value={{ state, actions }}>
      {children}
    </AppContext.Provider>
  );
}


export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

export default AppContext;