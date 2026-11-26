import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useApp } from "../context/AppContext";
import { userApi } from "../services/api";
import AppHeader from "../components/AppHeader";
import { Button, Field } from "../components/ui";
import { colors } from "../components/theme";

export default function AccountSettingsScreen({ navigation }) {
  const { user, actions } = useApp();
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      const { user: updated } = await userApi.update({ name: name.trim(), phone: phone.trim() ? phone : null });
      actions.setUser(updated);
      Alert.alert("Kaydedildi", "Profil bilgileriniz güncellendi.");
    } catch (e) {
      Alert.alert("Hata", e.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async () => {
    if (!currentPassword || !newPassword) {
      Alert.alert("Eksik bilgi", "Mevcut ve yeni şifrenizi girin.");
      return;
    }
    setSavingPassword(true);
    try {
      const res = await userApi.changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      Alert.alert("Şifre güncellendi", res.message);
    } catch (e) {
      Alert.alert("Hata", e.message);
    } finally {
      setSavingPassword(false);
    }
  };

  const confirmLogout = () =>
    Alert.alert("Çıkış yap", "Hesabınızdan çıkış yapmak istiyor musunuz?", [
      { text: "Vazgeç", style: "cancel" },
      { text: "Çıkış yap", style: "destructive", onPress: () => actions.signOut() },
    ]);

  // Hesap silme: App Store ve Google Play şartı. Geri alınamaz, iki kez onay alınır.
  const confirmDelete = () => {
    if (!deletePassword) {
      Alert.alert("Şifre gerekli", "Hesabınızı silmek için şifrenizi girin.");
      return;
    }
    Alert.alert(
      "Hesabınız kalıcı olarak silinecek",
      "Profiliniz, adresleriniz, favorileriniz, sepetiniz ve bildirimleriniz silinir; gelecekteki randevularınız iptal edilir. " +
        "Yasal olarak saklanması gereken fatura/sipariş kayıtları kimliğinizden ayrılarak tutulur. Bu işlem geri alınamaz.",
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Hesabımı sil",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await actions.deleteAccount(deletePassword);
              Alert.alert("Hesabınız silindi", "MyKuaför'ü kullandığınız için teşekkür ederiz.");
            } catch (e) {
              setDeleting(false);
              Alert.alert("Hesap silinemedi", e.message);
            }
          },
        },
      ],
    );
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.container}>
      <AppHeader title="Hesap Ayarları" back />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.section}>Profil</Text>
        <Field label="E-posta" value={user?.email ?? ""} editable={false} />
        <Field label="Ad Soyad" value={name} onChangeText={setName} autoComplete="name" />
        <Field label="Cep telefonu" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" />
        <Button title="Bilgileri Kaydet" onPress={saveProfile} loading={savingProfile} />

        <Text style={styles.section}>Şifre değiştir</Text>
        <Field
          label="Mevcut şifre"
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
          autoComplete="current-password"
        />
        <Field
          label="Yeni şifre"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          autoComplete="new-password"
          placeholder="En az 8 karakter, harf ve rakam"
        />
        <Button title="Şifreyi Güncelle" onPress={changePassword} loading={savingPassword} />

        <Button title="Çıkış Yap" variant="outline" onPress={confirmLogout} style={{ marginTop: 28 }} />

        <View style={styles.dangerZone}>
          <Text style={styles.dangerTitle}>Hesabı sil</Text>
          <Text style={styles.dangerText}>
            Hesabınızı ve kişisel verilerinizi kalıcı olarak silebilirsiniz. Cüzdanınızda bakiye varsa önce iade için
            Destek'e yazın.
          </Text>
          <Field
            placeholder="Onay için şifreniz"
            value={deletePassword}
            onChangeText={setDeletePassword}
            secureTextEntry
            autoComplete="current-password"
            accessibilityLabel="Hesap silme onayı için şifre"
          />
          <Button title="Hesabımı Kalıcı Olarak Sil" variant="danger" onPress={confirmDelete} loading={deleting} />
          <Button
            title="Destek'e yaz"
            variant="outline"
            onPress={() => navigation.navigate("Support")}
            style={{ marginTop: 10 }}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 20, paddingBottom: 48 },
  section: { fontSize: 17, fontWeight: "bold", color: colors.primary, marginTop: 20, marginBottom: 12 },
  dangerZone: {
    marginTop: 36,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#f5c2c7",
    backgroundColor: "#fff5f5",
  },
  dangerTitle: { fontSize: 16, fontWeight: "bold", color: colors.danger, marginBottom: 6 },
  dangerText: { fontSize: 13, color: colors.text, marginBottom: 12, lineHeight: 19 },
});
