import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, shadow } from "./theme";

/**
 * Uygulamanın tüm geri bildirimleri (sistemin gri uyarı kutuları yerine):
 *  - toast.success / toast.error / toast.info: üstten kayan, kendiliğinden kapanan kısa bildirim.
 *    İsteğe bağlı tek eylem düğmesi ("Geri al", "Sepete git"…). Akışı durdurmaz.
 *  - confirm({...}): yalnızca geri alınamaz/önemli işlemler için alttan açılan onay penceresi.
 * App kökünde bir kez <FeedbackHost /> bağlanır.
 */

let host = null;

const TONES = {
  success: { icon: "checkmark", color: colors.success, soft: "#E8F5EC", ms: 2600 },
  error: { icon: "alert", color: colors.danger, soft: "#FDECEA", ms: 4200 },
  info: { icon: "information", color: colors.text, soft: colors.surface, ms: 3400 },
};

const show = (tone) => (title, message, opts) => host?.toast({ tone, title, message, ...opts });

export const toast = {
  success: show("success"),
  error: show("error"),
  info: show("info"),
};

/**
 * @param {{title:string, message?:string, confirmText?:string, cancelText?:string, destructive?:boolean, icon?:string}} o
 * @returns {Promise<boolean>}
 */
export function confirm(o) {
  if (!host) return Promise.resolve(false);
  return host.confirm(o);
}

export function FeedbackHost() {
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState(null);
  const [dialog, setDialog] = useState(null);
  const y = useRef(new Animated.Value(-160)).current;
  const timer = useRef(null);

  const hide = useCallback(() => {
    clearTimeout(timer.current);
    Animated.timing(y, { toValue: -160, duration: 180, useNativeDriver: true }).start(() => setCurrent(null));
  }, [y]);

  useEffect(() => {
    host = {
      toast: (t) => {
        clearTimeout(timer.current);
        setCurrent({ ...t, key: Date.now() });
        y.setValue(-160);
        Animated.spring(y, { toValue: 0, friction: 9, tension: 90, useNativeDriver: true }).start();
        timer.current = setTimeout(hide, t.duration ?? TONES[t.tone].ms);
      },
      confirm: (o) => new Promise((resolve) => setDialog({ ...o, resolve })),
    };
    return () => {
      host = null;
      clearTimeout(timer.current);
    };
  }, [hide, y]);

  const close = (value) => {
    dialog?.resolve(value);
    setDialog(null);
  };

  const tone = current ? TONES[current.tone] : null;

  return (
    <>
      {current ? (
        <Animated.View
          style={[styles.toastWrap, { top: insets.top + 8, transform: [{ translateY: y }] }]}
          pointerEvents="box-none"
        >
          <Pressable
            style={styles.toast}
            onPress={hide}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            accessibilityLabel={[current.title, current.message].filter(Boolean).join(". ")}
          >
            <View style={[styles.toastIcon, { backgroundColor: tone.soft }]}>
              <Ionicons name={tone.icon} size={17} color={tone.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.toastTitle} numberOfLines={2}>
                {current.title}
              </Text>
              {current.message ? (
                <Text style={styles.toastMsg} numberOfLines={3}>
                  {current.message}
                </Text>
              ) : null}
            </View>
            {current.action ? (
              <TouchableOpacity
                onPress={() => {
                  hide();
                  current.action.onPress();
                }}
                hitSlop={10}
                accessibilityRole="button"
              >
                <Text style={styles.toastAction}>{current.action.label}</Text>
              </TouchableOpacity>
            ) : null}
          </Pressable>
        </Animated.View>
      ) : null}

      <Modal
        visible={!!dialog}
        transparent
        animationType="fade"
        onRequestClose={() => close(false)}
        statusBarTranslucent
      >
        <Backdrop onPress={() => close(false)} />
        {dialog ? <ConfirmSheet dialog={dialog} onAnswer={close} bottomInset={insets.bottom} /> : null}
      </Modal>
    </>
  );
}

/**
 * Onay penceresinin içeriği. Başka bir Modal'ın içinde (ör. ödeme penceresi) doğrudan da kullanılabilir;
 * iOS iki Modal'ı üst üste açamadığı için orada bu görünüm katman olarak çizilir.
 */
export function ConfirmSheet({ dialog, onAnswer, bottomInset = 0 }) {
  const dTone = dialog.destructive ? colors.danger : colors.primary;
  return (
    <View style={[styles.sheet, { paddingBottom: Math.max(bottomInset, 16) + 8 }]} accessibilityViewIsModal>
      <View style={styles.grip} />
      <View style={[styles.dIcon, { backgroundColor: dialog.destructive ? "#FDECEA" : colors.primarySoft }]}>
        <Ionicons
          name={dialog.icon ?? (dialog.destructive ? "trash-outline" : "help-outline")}
          size={24}
          color={dTone}
        />
      </View>
      <Text style={styles.dTitle}>{dialog.title}</Text>
      {dialog.message ? <Text style={styles.dMsg}>{dialog.message}</Text> : null}
      <TouchableOpacity
        style={[styles.dPrimary, { backgroundColor: dTone }]}
        onPress={() => onAnswer(true)}
        accessibilityRole="button"
      >
        <Text style={styles.dPrimaryText}>{dialog.confirmText ?? "Tamam"}</Text>
      </TouchableOpacity>
      {dialog.cancelText !== null ? (
        <TouchableOpacity style={styles.dSecondary} onPress={() => onAnswer(false)} accessibilityRole="button">
          <Text style={styles.dSecondaryText}>{dialog.cancelText ?? "Vazgeç"}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/** Ekranı karartan arka plan (dokununca kapatır). */
export function Backdrop({ onPress }) {
  return <Pressable style={styles.backdrop} onPress={onPress} accessibilityLabel="Kapat" />;
}

const styles = StyleSheet.create({
  toastWrap: { position: "absolute", left: 12, right: 12, zIndex: 1000, elevation: 30 },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.background,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    ...shadow,
    shadowOpacity: 0.14,
    elevation: 12,
  },
  toastIcon: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  toastTitle: { fontSize: 14.5, fontWeight: "600", color: colors.text },
  toastMsg: { fontSize: 13, color: colors.muted, marginTop: 2, lineHeight: 18 },
  toastAction: { fontSize: 14, fontWeight: "700", color: colors.primary },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.38)" },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 22,
    paddingTop: 10,
    alignItems: "center",
  },
  grip: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 18 },
  dIcon: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  dTitle: { fontSize: 18, fontWeight: "700", color: colors.text, textAlign: "center" },
  dMsg: { fontSize: 14.5, color: colors.muted, textAlign: "center", marginTop: 8, lineHeight: 21 },
  dPrimary: { alignSelf: "stretch", borderRadius: 14, paddingVertical: 15, alignItems: "center", marginTop: 22 },
  dPrimaryText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  dSecondary: { alignSelf: "stretch", paddingVertical: 14, alignItems: "center", marginTop: 4 },
  dSecondaryText: { color: colors.text, fontSize: 15.5, fontWeight: "600" },
});
