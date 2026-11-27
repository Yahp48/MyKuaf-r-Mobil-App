import React, { useEffect, useState } from "react";
import { StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "./theme";
import { Bone, SkeletonGroup } from "./Skeleton";
import { cardApi } from "../services/api";

const BRANDS = { VISA: "VISA", MASTER_CARD: "Mastercard", TROY: "TROY", AMERICAN_EXPRESS: "AMEX" };

/**
 * Kartla ödemede kart seçimi: kayıtlı kartlardan biri veya yeni kart (+ "kartımı kaydet").
 * onChange({ savedCardId }) | onChange({ saveCard })
 */
export default function CardPicker({ onChange }) {
  const [cards, setCards] = useState(null);
  const [selected, setSelected] = useState("new");
  const [saveCard, setSaveCard] = useState(false);

  useEffect(() => {
    cardApi
      .list()
      .then(({ items }) => {
        setCards(items);
        const def = items.find((c) => c.isDefault) ?? items[0];
        if (def) setSelected(def.id);
      })
      .catch(() => setCards([]));
  }, []);

  useEffect(() => {
    onChange(selected === "new" ? { saveCard } : { savedCardId: selected });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, saveCard]);

  if (!cards) {
    return (
      <SkeletonGroup style={{ gap: 8, marginTop: 8 }}>
        <Bone h={56} r={12} />
        <Bone h={56} r={12} />
      </SkeletonGroup>
    );
  }

  return (
    <View style={styles.wrap}>
      {cards.map((c) => (
        <Option key={c.id} on={selected === c.id} onPress={() => setSelected(c.id)}>
          <View style={styles.brandBox}>
            <Text style={styles.brandText}>{BRANDS[c.association] ?? "KART"}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{c.alias}</Text>
            <Text style={styles.text}>
              {c.bankName ? `${c.bankName} · ` : ""}•••• {c.last4}
            </Text>
          </View>
        </Option>
      ))}
      <Option on={selected === "new"} onPress={() => setSelected("new")}>
        <View style={[styles.brandBox, { backgroundColor: colors.primarySoft }]}>
          <Ionicons name="add" size={18} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Yeni kart</Text>
          <Text style={styles.text}>Kart bilgilerini güvenli ödeme sayfasında girersiniz</Text>
        </View>
      </Option>
      {selected === "new" && cards.length < 5 ? (
        <View style={styles.saveRow}>
          <Text style={styles.saveText}>Kartımı sonraki ödemeler için kaydet</Text>
          <Switch
            value={saveCard}
            onValueChange={setSaveCard}
            trackColor={{ true: colors.primary, false: "#D1D1D6" }}
            thumbColor="#fff"
            accessibilityLabel="Kartımı kaydet"
          />
        </View>
      ) : null}
    </View>
  );
}

function Option({ on, onPress, children }) {
  return (
    <TouchableOpacity
      style={[styles.option, on && styles.optionOn]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
    >
      {children}
      <Ionicons name={on ? "radio-button-on" : "radio-button-off"} size={22} color={colors.primary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, marginTop: 8 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  optionOn: { borderColor: colors.primary, backgroundColor: "#FFF8FA" },
  brandBox: {
    width: 46,
    height: 32,
    borderRadius: 6,
    backgroundColor: colors.text,
    alignItems: "center",
    justifyContent: "center",
  },
  brandText: { color: "#fff", fontSize: 9.5, fontWeight: "900", fontStyle: "italic" },
  title: { fontSize: 14.5, fontWeight: "700", color: colors.text },
  text: { fontSize: 12.5, color: colors.muted, marginTop: 2 },
  saveRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  saveText: { fontSize: 14, color: colors.text, flex: 1 },
});
