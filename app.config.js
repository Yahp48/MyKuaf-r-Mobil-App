// Expo uygulama yapılandırması.
// Gizli olmayan derleme ayarları burada; anahtarlar .env dosyasından okunur (bkz. .env.example).

const IS_PROD = process.env.APP_VARIANT === "production";

module.exports = {
  expo: {
    name: "MyKuaför",
    slug: "kuafor_mobil",
    scheme: "mykuafor",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },
    ios: {
      bundleIdentifier: "com.yaho.kuaformobil",
      buildNumber: "1",
      supportsTablet: false,
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      package: "com.yaho.kuafor_mobil",
      versionCode: 1,
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
      permissions: ["android.permission.ACCESS_COARSE_LOCATION", "android.permission.ACCESS_FINE_LOCATION"],
      // Play Store incelemesinde sorun çıkaran, uygulamanın kullanmadığı izinler.
      blockedPermissions: [
        "android.permission.SYSTEM_ALERT_WINDOW",
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE",
        "android.permission.RECORD_AUDIO",
      ],
      config: {
        // react-native-maps için Android Maps SDK anahtarı (Google Cloud'da Android uygulamasıyla kısıtlanmalı).
        googleMaps: {
          apiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY || "",
        },
      },
    },
    web: {
      favicon: "./assets/favicon.png",
    },
    plugins: [
      [
        "expo-location",
        {
          locationWhenInUsePermission:
            "Size en yakın kuaförleri haritada göstermek ve yol tarifi oluşturmak için konumunuz kullanılır.",
        },
      ],
      [
        "expo-camera",
        {
          cameraPermission:
            "Saç rengi ve makyajı canlı denemek için ön kamera kullanılır. Görüntünüz yalnızca cihazınızda işlenir ve hiçbir yere gönderilmez.",
          microphonePermission: false,
          recordAudioAndroid: false,
        },
      ],
      [
        "expo-image-picker",
        {
          photosPermission:
            "Yorumlarınıza saçınızın önce/sonra fotoğraflarını ekleyebilmeniz için galerinize erişilir. Yalnızca seçtiğiniz fotoğraflar yüklenir.",
          cameraPermission: false,
          microphonePermission: false,
        },
      ],
      [
        "expo-notifications",
        {
          color: "#C9184A",
        },
      ],
    ],
    extra: {
      isProduction: IS_PROD,
    },
  },
};
