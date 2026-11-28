import React, { useEffect, useState } from "react";
import { Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { metaApi } from "../services/api";
import { colors } from "./theme";

/**
 * Platformu işleten şirketin yasal bilgileri (sunucudaki COMPANY_* ayarlarından).
 * Ayarlanmamışsa null döner ve hiçbir şey gösterilmez — uydurma bilgi gösterilmez.
 */
let cache;
export function useCompany() {
  const [company, setCompany] = useState(cache ?? null);
  useEffect(() => {
    if (cache !== undefined) return;
    let alive = true;
    metaApi
      .company()
      .then((r) => {
        cache = r.company ?? null;
        if (alive) setCompany(cache);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return company;
}

export function CompanyCard({ company }) {
  const rows = [
    ["Ticari unvan", company.legalName],
    ["Adres", company.address],
    ["Vergi dairesi / no", [company.taxOffice, company.taxNumber].filter(Boolean).join(" / ") || null],
    ["MERSİS no", company.mersisNo],
    ["KEP adresi", company.kep],
    ["E-posta", company.email, company.email && `mailto:${company.email}`],
    ["Telefon", company.phone, company.phone && `tel:${company.phone.replace(/\s/g, "")}`],
  ].filter(([, v]) => v);
  return (
    <View style={styles.card}>
      {rows.map(([label, value, href], i) => {
        const Body = href ? TouchableOpacity : View;
        return (
          <Body
            key={label}
            style={[styles.row, i > 0 && styles.border]}
            {...(href ? { onPress: () => Linking.openURL(href).catch(() => {}), accessibilityRole: "link" } : null)}
          >
            <Text style={styles.label}>{label}</Text>
            <Text style={[styles.value, href && { color: colors.primary }]} selectable>
              {value}
            </Text>
          </Body>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.background, borderRadius: 14, paddingHorizontal: 16 },
  row: { paddingVertical: 11 },
  border: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  label: { fontSize: 12, color: colors.muted, marginBottom: 2 },
  value: { fontSize: 14.5, color: colors.text, lineHeight: 20 },
});
