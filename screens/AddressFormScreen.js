import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from "react-native";
import { useApp } from "../context/AppContext";
import { userApi } from "../services/api";
import AppHeader from "../components/AppHeader";
import { Button, Checkbox, Field } from "../components/ui";
import { colors } from "../components/theme";

export default function AddressFormScreen({ navigation, route }) {
  const { user } = useApp();
  // Düzenleme: route.params.address ile gelir
  const editing = route?.params?.address ?? null;
  const [form, setForm] = useState({
    title: editing?.title ?? "Ev",
    fullName: editing?.fullName ?? user?.name ?? "",
    phone: editing?.phone ?? user?.phone ?? "",
    city: editing?.city ?? "",
    district: editing?.district ?? "",
    line: editing?.line ?? "",
    postalCode: editing?.postalCode ?? "",
    isDefault: editing ? editing.isDefault : true,
  });
  const [saving, setSaving] = useState(false);
  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    setSaving(true);
    try {
      const { postalCode, ...rest } = form;
      const body = { ...rest, ...(postalCode.trim() ? { postalCode: postalCode.trim() } : {}) };
      if (editing) await userApi.updateAddress(editing.id, body);
      else await userApi.addAddress(body);
      navigation.goBack();
    } catch (e) {
      Alert.alert("Adres kaydedilemedi", e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.container}>
      <AppHeader title={editing ? "Adresi düzenle" : "Yeni adres"} back />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Field label="Adres başlığı" value={form.title} onChangeText={set("title")} placeholder="Ev, İş..." />
        <Field label="Ad Soyad" value={form.fullName} onChangeText={set("fullName")} autoComplete="name" />
        <Field
          label="Cep telefonu"
          value={form.phone}
          onChangeText={set("phone")}
          keyboardType="phone-pad"
          autoComplete="tel"
        />
        <Field label="İl" value={form.city} onChangeText={set("city")} autoComplete="address-line2" />
        <Field label="İlçe" value={form.district} onChangeText={set("district")} />
        <Field
          label="Açık adres"
          value={form.line}
          onChangeText={set("line")}
          placeholder="Mahalle, cadde/sokak, bina ve daire no"
          multiline
          autoComplete="street-address"
        />
        <Field
          label="Posta kodu (isteğe bağlı)"
          value={form.postalCode}
          onChangeText={set("postalCode")}
          keyboardType="number-pad"
          maxLength={5}
          autoComplete="postal-code"
        />
        <Checkbox checked={form.isDefault} onChange={set("isDefault")}>
          <Text style={{ color: colors.text, marginTop: 2 }}>Varsayılan adresim olsun</Text>
        </Checkbox>
        <Button title="Adresi Kaydet" onPress={save} loading={saving} style={{ marginTop: 12 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 20, paddingBottom: 40 },
});
