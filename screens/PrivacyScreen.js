import React, { useState } from "react";
import { Alert, Linking, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useApp } from "../context/AppContext";
import { userApi } from "../services/api";
import AppHeader from "../components/AppHeader";
import { colors } from "../components/theme";
import { useCompany } from "../components/CompanyInfo";

// Not: Metin genel çerçevedir; yayından önce hukukçuya gözden geçirtilmeli (bkz. CLAUDE.md "Bilinen eksikler").
const SECTIONS = [
  {
    title: "Hangi verileri işliyoruz?",
    body:
      "Ad soyad, e-posta, cep telefonu; randevu ve sipariş bilgileri; teslimat adresleri; uygulamayı kullanırken " +
      "konumunuz (yalnızca izin verdiğinizde ve yakın salonları göstermek için) ve bildirim almak üzere cihaz " +
      "anahtarınız. Kart bilgileriniz uygulamaya ve sunucularımıza hiç ulaşmaz; ödeme lisanslı ödeme kuruluşunun " +
      "güvenli sayfasında yapılır.",
  },
  {
    title: "Neden işliyoruz?",
    body:
      "Hesabınızı oluşturmak ve korumak, randevu ve siparişlerinizi ilgili salona/satıcıya iletmek, ödeme ve iadeleri " +
      "yürütmek, size randevu ve sipariş bildirimleri göndermek ve yasal yükümlülüklerimizi (fatura, vergi kayıtları) " +
      "yerine getirmek için. Hukuki sebepler: sözleşmenin kurulması ve ifası, hukuki yükümlülük ve meşru menfaat " +
      "(KVKK md. 5/2-c, ç, f). Pazarlama iletişimi yalnızca açık rızanızla yapılır.",
  },
  {
    title: "Kimlerle paylaşıyoruz?",
    body:
      "Randevu aldığınız salonla adınız ve telefonunuz; sipariş verdiğiniz satıcıyla teslimat adresiniz paylaşılır. " +
      "Ayrıca barındırma, e-posta ve ödeme hizmeti sağlayıcılarımız ile kanunen yetkili kurumlar. Verileriniz " +
      "satılmaz ve reklam amacıyla üçüncü kişilere verilmez.",
  },
  {
    title: "Canlı deneme ve fotoğraflar",
    body:
      "Canlı denemede (saç modeli, renk, makyaj) kamera görüntünüz yalnızca telefonunuzda işlenir; sunucularımıza " +
      "gönderilmez ve kaydedilmez. \"Yapay zekâ ile gerçekçi dene\" özelliğini kullanırsanız, yalnızca açık rızanızla " +
      "çektiğiniz fotoğraf yurt dışındaki görüntü işleme hizmet sağlayıcısına gönderilir (KVKK md. 9); fotoğraf " +
      "saklanmaz, oluşturulan görseller 24 saat sonra silinir. Yorumlara eklediğiniz fotoğraflar salon sayfasında " +
      "herkese açık yayınlanır; yorumunuzu silmek için Müşteri Hizmetleri'ne yazabilirsiniz.",
  },
  {
    title: "Haklarınız",
    body:
      "KVKK md. 11 uyarınca verilerinizin işlenip işlenmediğini öğrenme, düzeltilmesini veya silinmesini isteme, " +
      "işlemeye itiraz etme ve zararın giderilmesini talep etme haklarınız vardır. Hesabınızı uygulama içinden " +
      "kendiniz silebilir, diğer talepleriniz için Müşteri Hizmetleri'ne yazabilirsiniz.",
  },
];

export default function PrivacyScreen({ navigation }) {
  const { user, status, actions } = useApp();
  const company = useCompany();
  const signedIn = status === "signedIn";
  const [marketing, setMarketing] = useState(!!user?.marketingOptIn);
  const [saving, setSaving] = useState(false);

  const toggleMarketing = async (value) => {
    setMarketing(value);
    setSaving(true);
    try {
      const { user: updated } = await userApi.update({ marketingOptIn: value });
      actions.setUser(updated);
    } catch (e) {
      setMarketing(!value);
      Alert.alert("Kaydedilemedi", e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Gizlilik ve KVKK" back />
      <ScrollView contentContainerStyle={styles.scroll}>
        {signedIn ? (
          <>
            <Text style={styles.groupLabel}>İZİNLERİM</Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>Kampanya ve fırsat iletileri</Text>
                  <Text style={styles.rowSub}>E-posta ve SMS ile. İstediğiniz zaman kapatabilirsiniz.</Text>
                </View>
                <Switch
                  value={marketing}
                  onValueChange={toggleMarketing}
                  disabled={saving}
                  trackColor={{ false: "#D8D8DC", true: colors.primary }}
                  thumbColor="#fff"
                  accessibilityLabel="Kampanya ve fırsat iletileri"
                />
              </View>
              <View style={styles.divider} />
              <TouchableOpacity style={styles.row} onPress={() => Linking.openSettings()} accessibilityRole="button">
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>Konum ve bildirim izinleri</Text>
                  <Text style={styles.rowSub}>Telefonunuzun ayarlarından yönetilir.</Text>
                </View>
                <Ionicons name="open-outline" size={18} color={colors.muted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.groupLabel}>VERİLERİM</Text>
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.row}
                onPress={() => navigation.navigate("Support")}
                accessibilityRole="button"
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>Verilerim hakkında talepte bulun</Text>
                  <Text style={styles.rowSub}>Bilgi, düzeltme veya kopya talebi (KVKK md. 11)</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.faint} />
              </TouchableOpacity>
              <View style={styles.divider} />
              <TouchableOpacity
                style={styles.row}
                onPress={() => navigation.navigate("AccountSettings")}
                accessibilityRole="button"
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowTitle, { color: colors.danger }]}>Hesabımı sil</Text>
                  <Text style={styles.rowSub}>Hesap Ayarları'nda şifrenizle onaylayarak</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.faint} />
              </TouchableOpacity>
            </View>
          </>
        ) : null}

        <Text style={styles.groupLabel}>KVKK AYDINLATMA METNİ</Text>
        <View style={[styles.card, styles.textCard]}>
          <Text style={styles.intro}>
            {company
              ? `Veri sorumlusu ${company.legalName}${company.address ? ` (${company.address})` : ""} olarak, MyKuaför uygulamasında kişisel verilerinizi 6698 sayılı Kişisel Verilerin Korunması Kanunu'na uygun şekilde işliyoruz.`
              : "MyKuaför olarak kişisel verilerinizi 6698 sayılı Kişisel Verilerin Korunması Kanunu'na uygun şekilde işliyoruz."}{" "}
            Bu metin, hangi verileri neden işlediğimizi ve haklarınızı özetler.
            {company?.email || company?.kep
              ? ` Başvurularınızı ${[company.email, company.kep && `KEP: ${company.kep}`].filter(Boolean).join(" veya ")} adresine iletebilirsiniz.`
              : ""}
          </Text>
          {SECTIONS.map((s) => (
            <View key={s.title} style={styles.section}>
              <Text style={styles.sectionTitle}>{s.title}</Text>
              <Text style={styles.body}>{s.body}</Text>
            </View>
          ))}
          <Text style={styles.footnote}>
            Mesafeli satış sözleşmesi ve ön bilgilendirme formu her siparişte ödeme adımında ayrıca gösterilir.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  scroll: { padding: 16, paddingBottom: 40 },
  groupLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.muted,
    letterSpacing: 0.8,
    marginTop: 12,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: { backgroundColor: colors.background, borderRadius: 14, overflow: "hidden" },
  textCard: { padding: 18 },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  rowTitle: { fontSize: 16, fontWeight: "500", color: colors.text },
  rowSub: { fontSize: 13, color: colors.muted, marginTop: 2, lineHeight: 18 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: "#DCDCE0", marginLeft: 16 },
  intro: { fontSize: 15, color: colors.text, lineHeight: 22 },
  section: { marginTop: 18 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: 6 },
  body: { fontSize: 14.5, color: colors.muted, lineHeight: 21 },
  footnote: { fontSize: 13, color: colors.faint, marginTop: 18, lineHeight: 19 },
});
