import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { AppProvider } from "./context/AppContext";

// Ekranlar
import SignInScreen from "./screens/SignInScreen";
import SignUpScreen from "./screens/SignUpScreen";
import HomeScreen from "./screens/HomeScreen";
import ProfileScreen from "./screens/ProfileScreen";
import AccountSettingsScreen from "./screens/AccountSettingsScreen";
import WalletScreen from "./screens/WalletScreen";
import NotificationScreen from "./screens/NotificationScreen";
import AppointmentsScreen from "./screens/AppointmentsScreen";
import RandevuForm from "./screens/RandevuForm";
import LoadMoneyScreen from "./screens/LoadMoneyScreen";
import CalendarScreen from "./screens/CalendarScreen";
import PaymentScreen from "./screens/PaymentScreen";
import PaymentVerificationScreen from "./screens/PaymentVerificationScreen";
import BankTransferScreen from "./screens/BankTransferScreen";
import CreditCardTopupScreen from "./screens/CreditCardTopupScreen";
import AddNewCardScreen from "./screens/AddNewCardScreen";
import ShopScreen from "./screens/ShopScreen";
import ProductDetailScreen from "./screens/ProductDetailScreen";
import ShoppingCartScreen from "./screens/ShoppingCartScreen";

// Yeni eklenenler
import AboutScreen from "./screens/AboutScreen";
import FavoritesScreen from "./screens/FavoritesScreen";
import FeedbackScreen from "./screens/FeedbackScreen";
import LanguageScreen from "./screens/LanguageScreen";
import OrderDetailScreen from "./screens/OrderDetailScreen";
import OrderScreen from "./screens/OrderScreen";
import PrivacyScreen from "./screens/PrivacyScreen";
import ReviewsScreen from "./screens/ReviewvsScreen"
import SupportScreen from "./screens/SupportScreen";

const Stack = createStackNavigator();

function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Home">
     {/* <Stack.Screen name="SignIn" component={SignInScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />  */}
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="AccountSettings" component={AccountSettingsScreen} />
      <Stack.Screen name="WalletScreen" component={WalletScreen} />
      <Stack.Screen name="Notifications" component={NotificationScreen} />
      <Stack.Screen name="Appointments" component={AppointmentsScreen} />
      <Stack.Screen name="RandevuForm" component={RandevuForm} />
      <Stack.Screen name="LoadMoney" component={LoadMoneyScreen} />
      <Stack.Screen name="CalendarScreen" component={CalendarScreen} />
      <Stack.Screen name="PaymentScreen" component={PaymentScreen} />
      <Stack.Screen name="PaymentVerificationScreen" component={PaymentVerificationScreen} />
      <Stack.Screen name="BankTransferScreen" component={BankTransferScreen} />
      <Stack.Screen name="CreditCardTopupScreen" component={CreditCardTopupScreen} />
      <Stack.Screen name="AddNewCardScreen" component={AddNewCardScreen} />
      <Stack.Screen name="Shop" component={ShopScreen} />
      <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
      <Stack.Screen name="ShoppingCart" component={ShoppingCartScreen} />

      {/* Eklenen sayfalar */}
      <Stack.Screen name="About" component={AboutScreen} />
      <Stack.Screen name="Favorites" component={FavoritesScreen} />
      <Stack.Screen name="Feedback" component={FeedbackScreen} />
      <Stack.Screen name="Language" component={LanguageScreen} />
      <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
      <Stack.Screen name="Order" component={OrderScreen} />
      <Stack.Screen name="Privacy" component={PrivacyScreen} />
      <Stack.Screen name="Reviews" component={ReviewsScreen} />
      <Stack.Screen name="Support" component={SupportScreen} />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <AppProvider>
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    </AppProvider>
  );
}
