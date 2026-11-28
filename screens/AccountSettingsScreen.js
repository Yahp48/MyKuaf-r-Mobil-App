import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useApp } from "../context/AppContext";
import { userApi } from "../services/api";
import AppHeader from "../components/AppHeader";
import { Button, Field } from "../components/ui";
import { colors } from "../components/theme";
import { confirm, toast } from "../components/Feedback";

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
      toast.success("Kaydedildi", "Profil bilgileriniz güncellendi.");
    } catch (e) {
      toast.error("Hata", e.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async () => {
    if (!currentPassword || !newPassword) {
      toast.error("Eksik bilgi", "Mevcut ve yeni şifrenizi girin.");
      return;
    }
    setSavingPassword(true);
    try {
      const res = await userApi.changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      toast.success("Şifre güncellendi", res.message);
    } catch (e) {
      toast.error("Hata", e.message);
    } finally {
      setSavingPassword(false);
    }
  };

  const confirmLogout = () =>
    confirm({
      title: "Çıkış yap",
      message: "Hesabınızdan çıkış yapmak istiyor musunuz?",
      confirmText: "Çıkış yap",
      destructive: true,
    }).then((ok) => ok && (() => actions.signOut())());

  // Hesap silme: App Store ve Google Play şartı. Geri alınamaz, iki kez onay alınır.
  const confirmDelete = () => {
    if (!deletePassword) {
      toast.error("Şifre gerekli", "Hesabınızı silmek için şifrenizi girin.");
      return;
    }
    confirm({
      title: "Hesabınız kalıcı olarak silinecek",
      message:
        "Profiliniz, adresleriniz, favorileriniz, sepetiniz ve bildirimleriniz silinir; gelecekteki randevularınız iptal edilir. " +
        "Yasal olarak saklanması gereken fatura/sipariş kayıtları kimliğinizden ayrılarak tutulur. Bu işlem geri alınamaz.",
      confirmText: "Hesabımı sil",
      destructive: true,
    }).then(
      (ok) =>
        ok &&
        (async () => {
          setDeleting(true);
          try {
            await actions.deleteAccount(deletePassword);
            toast.success("Hesabınız silindi", "BiBakım'ı kullandığınız için teşekkür ederiz.");
          } catch (e) {
            setDeleting(false);
            toast.error("Hesap silinemedi", e.message);
          }
        })(),
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
