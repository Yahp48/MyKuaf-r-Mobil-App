// Expo uygulama yapılandırması.
// Gizli olmayan derleme ayarları burada; anahtarlar .env dosyasından okunur (bkz. .env.example).

const IS_PROD = process.env.APP_VARIANT === "production";

module.exports = {
  expo: {
    name: "Bakımca",
    slug: "bakimca",
    scheme: "bakimca",
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
      bundleIdentifier: "com.symmetrygroup.bakimca",
      buildNumber: "1",
      supportsTablet: false,
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
      // Apple gizlilik bildirimi (PrivacyInfo.xcprivacy). İzleme yok; konum cihazda kalır, sunucuya gitmez.
      // Toplanan veri türleri App Store Connect'teki "App Privacy" yanıtlarıyla aynı olmalı.
      privacyManifests: {
        NSPrivacyTracking: false,
        NSPrivacyTrackingDomains: [],
        NSPrivacyAccessedAPITypes: [
          { NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryUserDefaults", NSPrivacyAccessedAPITypeReasons: ["CA92.1"] },
          { NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryFileTimestamp", NSPrivacyAccessedAPITypeReasons: ["C617.1"] },
          { NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategorySystemBootTime", NSPrivacyAccessedAPITypeReasons: ["35F9.1"] },
          { NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryDiskSpace", NSPrivacyAccessedAPITypeReasons: ["E174.1"] },
        ],
        NSPrivacyCollectedDataTypes: [
          ["NSPrivacyCollectedDataTypeName", true],
          ["NSPrivacyCollectedDataTypeEmailAddress", true],
          ["NSPrivacyCollectedDataTypePhoneNumber", true],
          ["NSPrivacyCollectedDataTypePhysicalAddress", true],
          ["NSPrivacyCollectedDataTypePurchaseHistory", true],
          ["NSPrivacyCollectedDataTypePhotosorVideos", true],
          ["NSPrivacyCollectedDataTypeCustomerSupport", true],
          ["NSPrivacyCollectedDataTypeOtherUserContent", true],
        ].map(([type, linked]) => ({
          NSPrivacyCollectedDataType: type,
          NSPrivacyCollectedDataTypeLinked: linked,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"],
        })),
      },
    },
    android: {
      package: "com.symmetrygroup.bakimca",
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
            "Size en yakın kuaför ve güzellik işletmelerini haritada göstermek ve yol tarifi oluşturmak için konumunuz kullanılır.",
        },
      ],
      [
        "expo-camera",
        {
          cameraPermission:
            "Saç modeli, saç rengi ve makyajı canlı denemek için ön kamera kullanılır. Görüntü cihazınızda işlenir; yalnızca yapay zekâ ile denemeyi seçip onay verirseniz çektiğiniz fotoğraf işlenmek üzere gönderilir.",
          microphonePermission: false,
          recordAudioAndroid: false,
        },
      ],
      [
        "expo-image-picker",
        {
          photosPermission:
            "Yorumlarınıza aldığınız hizmetin önce/sonra fotoğraflarını ekleyebilmeniz için galerinize erişilir. Yalnızca seçtiğiniz fotoğraflar yüklenir.",
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
