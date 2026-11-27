import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "./theme";
import { DEFAULT_FILTERS } from "./useProductList";
import { productApi } from "../services/api";

export const SORTS = [
  ["newest", "En yeni"],
  ["best_selling", "Çok satanlar"],
  ["rating", "En yüksek puan"],
  ["price_asc", "Fiyat: düşükten yükseğe"],
  ["price_desc", "Fiyat: yüksekten düşüğe"],
];
const PRICE_PRESETS = [
  ["", "250", "250 TL altı"],
  ["250", "500", "250–500 TL"],
  ["500", "1000", "500–1.000 TL"],
  ["1000", "", "1.000 TL üstü"],
];

/** Alttan açılan filtre paneli: sıralama, fiyat, marka, stok ve indirim. */
export default function ProductFilterSheet({ visible, value, onApply, onClose, seller }) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState(value);
  const [brands, setBrands] = useState([]);

  useEffect(() => {
    if (visible) setDraft(value);
  }, [visible, value]);

  useEffect(() => {
    if (!visible) return;
    productApi
      .brands(seller)
      .then((r) => setBrands(r.items))
      .catch(() => {});
  }, [visible, seller]);

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const toggleBrand = (name) =>
    set({ brands: draft.brands.includes(name) ? draft.brands.filter((b) => b !== name) : [...draft.brands, name] });
  const onlyDigits = (v) => v.replace(/[^\d]/g, "");

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.backdrop}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} accessibilityLabel="Kapat" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.handle} />
          <View style={styles.head}>
            <Text style={styles.title}>Filtrele ve sırala</Text>
            <TouchableOpacity onPress={() => setDraft({ ...DEFAULT_FILTERS, category: value.category })} hitSlop={8}>
              <Text style={styles.clear}>Temizle</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: 12 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.section}>Sıralama</Text>
            {SORTS.map(([key, label]) => (
              <TouchableOpacity
                key={key}
                style={styles.radioRow}
                onPress={() => set({ sort: key })}
                accessibilityRole="radio"
                accessibilityState={{ selected: draft.sort === key }}
              >
                <Text style={[styles.radioText, draft.sort === key && styles.radioTextOn]}>{label}</Text>
                <Ionicons
                  name={draft.sort === key ? "radio-button-on" : "radio-button-off"}
                  size={20}
                  color={draft.sort === key ? colors.primary : "#C7C7CC"}
                />
              </TouchableOpacity>
            ))}

            <Text style={styles.section}>Fiyat aralığı</Text>
            <View style={styles.priceRow}>
              <TextInput
                style={styles.priceInput}
                value={draft.minPrice}
                onChangeText={(v) => set({ minPrice: onlyDigits(v) })}
                placeholder="En az"
                placeholderTextColor={colors.faint}
                keyboardType="number-pad"
                accessibilityLabel="En düşük fiyat"
              />
              <Text style={styles.dash}>—</Text>
              <TextInput
                style={styles.priceInput}
                value={draft.maxPrice}
                onChangeText={(v) => set({ maxPrice: onlyDigits(v) })}
                placeholder="En çok"
                placeholderTextColor={colors.faint}
                keyboardType="number-pad"
                accessibilityLabel="En yüksek fiyat"
              />
              <Text style={styles.tl}>TL</Text>
            </View>
            <View style={styles.wrap}>
              {PRICE_PRESETS.map(([min, max, label]) => {
                const on = draft.minPrice === min && draft.maxPrice === max;
                return (
                  <Chip
                    key={label}
                    label={label}
                    on={on}
                    onPress={() => set(on ? { minPrice: "", maxPrice: "" } : { minPrice: min, maxPrice: max })}
                  />
                );
              })}
            </View>

            {brands.length ? (
              <>
                <Text style={styles.section}>Marka</Text>
                <View style={styles.wrap}>
                  {brands.map((b) => (
                    <Chip
                      key={b.name}
                      label={`${b.name} (${b.productCount})`}
                      on={draft.brands.includes(b.name)}
                      onPress={() => toggleBrand(b.name)}
                    />
                  ))}
                </View>
              </>
            ) : null}

            <Text style={styles.section}>Diğer</Text>
            <ToggleRow label="Yalnızca stokta olanlar" value={draft.inStock} onChange={(v) => set({ inStock: v })} />
            <ToggleRow label="İndirimli ürünler" value={draft.onSale} onChange={(v) => set({ onSale: v })} />
          </ScrollView>
          <TouchableOpacity style={styles.apply} onPress={() => onApply(draft)} accessibilityRole="button">
            <Text style={styles.applyText}>Sonuçları göster</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Chip({ label, on, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.chip, on && styles.chipOn]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
    >
      {on ? <Ionicons name="checkmark" size={14} color={colors.primary} /> : null}
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </TouchableOpacity>
  );
}

function ToggleRow({ label, value, onChange }) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.radioText}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.primary, false: "#D1D1D6" }}
        thumbColor="#fff"
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    maxHeight: "86%",
  },
  handle: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: "#D1D1D6", marginTop: 10 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14 },
  title: { fontSize: 19, fontWeight: "800", color: colors.text },
  clear: { color: colors.primary, fontWeight: "700", fontSize: 14 },
  section: { fontSize: 13, fontWeight: "800", color: colors.muted, letterSpacing: 0.5, marginTop: 16, marginBottom: 6 },
  radioRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10 },
  radioText: { fontSize: 15, color: colors.text },
  radioTextOn: { fontWeight: "700" },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  priceInput: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    fontSize: 15,
    color: colors.text,
  },
  dash: { color: colors.muted },
  tl: { color: colors.muted, fontWeight: "600" },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    backgroundColor: colors.surface,
  },
  chipOn: { backgroundColor: colors.primarySoft },
  chipText: { fontSize: 13.5, color: colors.text, fontWeight: "600" },
  chipTextOn: { color: colors.primary },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 6 },
  apply: {
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  applyText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
