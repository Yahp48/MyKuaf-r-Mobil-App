import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { notificationApi } from "./api";

let registeredToken = null;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Bildirim izni ister ve Expo push token'ını sunucuya kaydeder.
 * Simülatörde, izin reddedildiğinde veya EAS projectId yoksa sessizce vazgeçer.
 */
export async function registerForPush() {
  if (!Device.isDevice) return null;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Genel",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const current = await Notifications.getPermissionsAsync();
  const status = current.granted ? "granted" : (await Notifications.requestPermissionsAsync()).status;
  if (status !== "granted") return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return null;

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
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
