import React from "react";
import { Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CONTACT } from "../config";
import { colors } from "./theme";

const digits = (v) => v.replace(/\D/g, "");

/** .env'de tanımlı iletişim kanalları. Hiçbiri tanımlı değilse null döner (sahte bilgi gösterilmez). */
export function contactItems() {
  const items = [];
  if (CONTACT.phone)
    items.push({ icon: "call-outline", label: "Telefon", value: CONTACT.phone, url: `tel:${digits(CONTACT.phone)}` });
  if (CONTACT.whatsapp)
    items.push({
      icon: "logo-whatsapp",
      label: "WhatsApp",
      value: CONTACT.whatsapp,
      url: `https://wa.me/${digits(CONTACT.whatsapp).replace(/^0/, "90")}`,
    });
  if (CONTACT.email)
    items.push({ icon: "mail-outline", label: "E-posta", value: CONTACT.email, url: `mailto:${CONTACT.email}` });
  if (CONTACT.website)
    items.push({
      icon: "globe-outline",
      label: "Web sitesi",
      value: CONTACT.website.replace(/^https?:\/\//, ""),
      url: CONTACT.website,
    });
  if (CONTACT.instagram)
    items.push({
      icon: "logo-instagram",
      label: "Instagram",
      value: CONTACT.instagram.replace(/^https?:\/\/(www\.)?/, ""),
      url: CONTACT.instagram,
    });
  return items;
}

export default function ContactList() {
  const items = contactItems();
  if (!items.length) return null;
  return (
    <View style={styles.card}>
      {items.map((it, i) => (
        <TouchableOpacity
          key={it.label}
          style={[styles.row, i > 0 && styles.border]}
          onPress={() => Linking.openURL(it.url).catch(() => {})}
          accessibilityRole="link"
          accessibilityLabel={`${it.label}: ${it.value}`}
        >
          <View style={styles.icon}>
            <Ionicons name={it.icon} size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>{it.label}</Text>
            <Text style={styles.value}>{it.value}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.faint} />
        </TouchableOpacity>
      ))}
      {CONTACT.hours ? <Text style={styles.hours}>Çalışma saatleri: {CONTACT.hours}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.background, borderRadius: 14, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  border: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#DCDCE0" },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontSize: 12.5, color: colors.muted },
  value: { fontSize: 15.5, color: colors.text, fontWeight: "500", marginTop: 1 },
  hours: { fontSize: 13, color: colors.muted, paddingHorizontal: 16, paddingBottom: 14, paddingTop: 2 },
});
