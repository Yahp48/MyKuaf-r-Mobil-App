import * as Device from "expo-device";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";
import { notificationApi } from "./api";

let registeredToken = null;
let Notifications = null;

// Expo Go uzaktan push bildirimini desteklemez; orada modül hiç yüklenmez (uygulama içi bildirimler çalışmaya devam eder).
const pushSupported = Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

function notificationsModule() {
  if (!pushSupported) return null;
  if (!Notifications) {
    Notifications = require("expo-notifications");
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  }
  return Notifications;
}

/**
 * Bildirim izni ister ve Expo push token'ını sunucuya kaydeder.
 * Expo Go'da, simülatörde, izin reddedildiğinde veya EAS projectId yoksa sessizce vazgeçer.
 */
export async function registerForPush() {
  const N = notificationsModule();
  if (!N || !Device.isDevice) return null;

  if (Platform.OS === "android") {
    await N.setNotificationChannelAsync("default", {
      name: "Genel",
      importance: N.AndroidImportance.DEFAULT,
    });
  }

  const current = await N.getPermissionsAsync();
  const status = current.granted ? "granted" : (await N.requestPermissionsAsync()).status;
  if (status !== "granted") return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return null;

  const { data: token } = await N.getExpoPushTokenAsync({ projectId });
  await notificationApi.registerPushToken(token, Platform.OS);
  registeredToken = token;
  return token;
}

/** Çıkışta bu cihaz artık o hesabın bildirimlerini almasın. */
export async function unregisterPush() {
  if (!registeredToken) return;
  await notificationApi.unregisterPushToken(registeredToken);
  registeredToken = null;
}
