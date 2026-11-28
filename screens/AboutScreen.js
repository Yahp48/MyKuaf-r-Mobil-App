import React from "react";
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Constants from "expo-constants";
import { Ionicons } from "@expo/vector-icons";
import AppHeader from "../components/AppHeader";
import BottomNav from "../components/BottomNav";
import ContactList, { contactItems } from "../components/ContactList";
import { colors } from "../components/theme";
import { CompanyCard, useCompany } from "../components/CompanyInfo";

const FEATURES = [
  { icon: "map-outline", text: "Yakınınızdaki salonları haritada görün, yol tarifi alın" },
  { icon: "calendar-outline", text: "Personel ve saat seçerek anında randevu alın" },
  { icon: "sparkles-outline", text: "Saç modeli, saç rengi ve makyajı canlı deneyin" },
  { icon: "bag-handle-outline", text: "Salonların kullandığı bakım ürünlerini güvenle satın alın" },
  { icon: "notifications-outline", text: "Randevu ve sipariş durumunuzu anlık takip edin" },
];

export default function AboutScreen({ navigation }) {
  const version = Constants.expoConfig?.version ?? "1.0.0";
  const company = useCompany();
  const build = Constants.expoConfig?.ios?.buildNumber ?? String(Constants.expoConfig?.android?.versionCode ?? "");

  return (
    <View style={styles.container}>
      <AppHeader title="Hakkında" back />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>W</Text>
          </View>
          <Text style={styles.name}>MyKuaför</Text>
          <Text style={styles.tagline}>Woman Hair Design</Text>
          <Text style={styles.version}>
            Sürüm {version}
            {build ? ` (${build})` : ""}
          </Text>
        </View>

        <Text style={styles.groupLabel}>UYGULAMA</Text>
        <View style={styles.card}>
          {FEATURES.map((f, i) => (
            <View key={f.text} style={[styles.feature, i > 0 && styles.border]}>
              <Ionicons name={f.icon} size={20} color={colors.primary} />
              <Text style={styles.featureText}>{f.text}</Text>
            </View>
          ))}
        </View>

        <ContactSection />

        {company ? (
          <>
            <Text style={styles.groupLabel}>HİZMET SAĞLAYICI</Text>
            <CompanyCard company={company} />
          </>
        ) : null}

        <Text style={styles.groupLabel}>YASAL</Text>
        <View style={styles.card}>
          <LinkRow label="Gizlilik ve KVKK aydınlatma metni" onPress={() => navigation.navigate("Privacy")} />
          <LinkRow label="Müşteri hizmetleri" onPress={() => navigation.navigate("Support")} border />
        </View>

        <Text style={styles.groupLabel}>VERİ KAYNAKLARI VE LİSANSLAR</Text>
        <View style={styles.card}>
          <Text style={styles.creditText}>
            Online randevu almayan salonların adres ve iletişim bilgileri © OpenStreetMap katkıda bulunanları tarafından
            Open Database License (ODbL) ile sağlanır.
          </Text>
          <LinkRow
            label="openstreetmap.org/copyright"
            onPress={() => Linking.openURL("https://www.openstreetmap.org/copyright").catch(() => {})}
            border
          />
          <Text style={[styles.creditText, { marginTop: 10 }]}>
            Canlı denemedeki saç modeli katmanları Unsplash lisanslı fotoğraflardan üretilmiştir. Yüz ve saç analizi
            Google MediaPipe (Apache 2.0) ile cihazınızda yapılır.
          </Text>
        </View>

        <Text style={styles.copyright}>© {new Date().getFullYear()} {company?.legalName ?? "MyKuaför"}. Tüm hakları saklıdır.</Text>
      </ScrollView>
      <BottomNav active="Profile" />
    </View>
  );
}

function ContactSection() {
  if (!contactItems().length) return null;
  return (
    <>
      <Text style={styles.groupLabel}>İLETİŞİM</Text>
      <ContactList />
    </>
  );
}

function LinkRow({ label, onPress, border }) {
  return (
    <TouchableOpacity style={[styles.link, border && styles.border]} onPress={onPress} accessibilityRole="button">
      <Text style={styles.linkText}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.faint} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  creditText: { fontSize: 13, color: colors.muted, lineHeight: 19, paddingVertical: 4 },
  container: { flex: 1, backgroundColor: colors.surface },
  scroll: { padding: 16, paddingBottom: 32 },
  hero: { alignItems: "center", paddingVertical: 24 },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: { color: "#fff", fontSize: 34, fontWeight: "800" },
  name: { fontSize: 22, fontWeight: "700", color: colors.text, marginTop: 12 },
  tagline: { fontSize: 13, fontWeight: "600", color: colors.primary, letterSpacing: 1.6, marginTop: 2 },
  version: { fontSize: 13, color: colors.muted, marginTop: 8 },
  groupLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.muted,
    letterSpacing: 0.8,
    marginTop: 16,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: { backgroundColor: colors.background, borderRadius: 14, overflow: "hidden" },
  feature: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  featureText: { flex: 1, fontSize: 15, color: colors.text, lineHeight: 21 },
  border: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#DCDCE0" },
  link: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 15 },
  linkText: { flex: 1, fontSize: 16, color: colors.text },
  copyright: { textAlign: "center", fontSize: 12.5, color: colors.faint, marginTop: 24 },
});
