import React from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import * as Linking from "expo-linking";
import { AppProvider, useApp } from "./context/AppContext";
import { EmptyState, Loading } from "./components/ui";
import OfflineBanner from "./components/OfflineBanner";

import SignInScreen from "./screens/SignInScreen";
import SignUpScreen from "./screens/SignUpScreen";
import ForgotPasswordScreen from "./screens/ForgotPasswordScreen";
import HomeScreen from "./screens/HomeScreen";
import ProfileScreen from "./screens/ProfileScreen";
import AccountSettingsScreen from "./screens/AccountSettingsScreen";
import WalletScreen from "./screens/WalletScreen";
import LoadMoneyScreen from "./screens/LoadMoneyScreen";
import NotificationScreen from "./screens/NotificationScreen";
import AppointmentsScreen from "./screens/AppointmentsScreen";
import CalendarScreen from "./screens/CalendarScreen";
import ShopScreen from "./screens/ShopScreen";
import ProductDetailScreen from "./screens/ProductDetailScreen";
import ShoppingCartScreen from "./screens/ShoppingCartScreen";
import CheckoutScreen from "./screens/CheckoutScreen";
import AddressFormScreen from "./screens/AddressFormScreen";
import OrderScreen from "./screens/OrderScreen";
import OrderDetailScreen from "./screens/OrderDetailScreen";
import FavoritesScreen from "./screens/FavoritesScreen";
import ReviewsScreen from "./screens/ReviewsScreen";
import FeedbackScreen from "./screens/FeedbackScreen";
import SupportScreen from "./screens/SupportScreen";
import PrivacyScreen from "./screens/PrivacyScreen";
import AboutScreen from "./screens/AboutScreen";
import FeaturedScreen from "./screens/FeaturedScreen";
import TryOnScreen from "./screens/TryOnScreen";
import SavedCardsScreen from "./screens/SavedCardsScreen";
import AddressesScreen from "./screens/AddressesScreen";
import StoreScreen from "./screens/StoreScreen";
import LoyaltyScreen from "./screens/LoyaltyScreen";
import AiTryOnScreen from "./screens/AiTryOnScreen";

const Stack = createStackNavigator();

// Ödeme sayfası "mykuafor://payment-result" ile uygulamaya döner (bkz. services/checkout.js).
const linking = {
  prefixes: [Linking.createURL("/"), "mykuafor://"],
  config: { screens: {} },
};

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SignIn" component={SignInScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="Privacy" component={PrivacyScreen} />
    </Stack.Navigator>
  );
}

function MainStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Home">
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Appointments" component={AppointmentsScreen} />
      <Stack.Screen name="CalendarScreen" component={CalendarScreen} />
      <Stack.Screen name="Featured" component={FeaturedScreen} />
      <Stack.Screen name="SavedCards" component={SavedCardsScreen} />
      <Stack.Screen name="Addresses" component={AddressesScreen} />
      <Stack.Screen name="Store" component={StoreScreen} />
      <Stack.Screen name="Loyalty" component={LoyaltyScreen} />
      <Stack.Screen name="AiTryOn" component={AiTryOnScreen} />
      <Stack.Screen name="TryOn" component={TryOnScreen} options={{ gestureEnabled: false }} />
      <Stack.Screen name="Shop" component={ShopScreen} />
      <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
      <Stack.Screen name="ShoppingCart" component={ShoppingCartScreen} />
      <Stack.Screen name="Checkout" component={CheckoutScreen} />
      <Stack.Screen name="AddressForm" component={AddressFormScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="AccountSettings" component={AccountSettingsScreen} />
      <Stack.Screen name="Order" component={OrderScreen} />
      <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
      <Stack.Screen name="Favorites" component={FavoritesScreen} />
      <Stack.Screen name="WalletScreen" component={WalletScreen} />
      <Stack.Screen name="LoadMoney" component={LoadMoneyScreen} />
      <Stack.Screen name="Notifications" component={NotificationScreen} />
      <Stack.Screen name="Reviews" component={ReviewsScreen} />
      <Stack.Screen name="Feedback" component={FeedbackScreen} />
      <Stack.Screen name="Support" component={SupportScreen} />
      <Stack.Screen name="Privacy" component={PrivacyScreen} />
      <Stack.Screen name="About" component={AboutScreen} />
    </Stack.Navigator>
  );
}

function Root() {
  const { status, actions } = useApp();
  if (status === "loading") return <Loading />;
  if (status === "offline") {
    return (
      <EmptyState
        icon="cloud-off"
        title="Sunucuya bağlanılamadı"
        message="İnternet bağlantınızı kontrol edip tekrar deneyin."
        actionTitle="Tekrar dene"
        onAction={actions.bootstrap}
      />
    );
  }
  return (
    <NavigationContainer linking={linking}>{status === "signedIn" ? <MainStack /> : <AuthStack />}</NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="dark" />
        <Root />
        <OfflineBanner />
      </AppProvider>
    </SafeAreaProvider>
  );
}
