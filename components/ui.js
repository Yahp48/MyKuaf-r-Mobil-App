import React from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { colors } from "./theme";

export function Button({ title, onPress, loading, disabled, variant = "primary", style, accessibilityLabel }) {
  const isDisabled = disabled || loading;
  const variantStyle = variant === "danger" ? styles.danger : variant === "outline" ? styles.outline : styles.primary;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: isDisabled, busy: !!loading }}
      style={[styles.button, variantStyle, isDisabled && styles.disabled, style]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "outline" ? colors.primary : "#fff"} />
      ) : (
        <Text style={[styles.buttonText, variant === "outline" && { color: colors.primary }]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

export function Field({ label, error, icon, right, style, ...inputProps }) {
  return (
    <View style={[styles.fieldWrap, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.inputRow, error && { borderColor: colors.danger }]}>
        {icon ? <MaterialIcons name={icon} size={20} color="#A1A1A6" style={{ marginRight: 8 }} /> : null}
        <TextInput placeholderTextColor="#aaa" style={styles.input} accessibilityLabel={label} {...inputProps} />
        {right}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export function Checkbox({ checked, onChange, children }) {
  return (
    <TouchableOpacity
      style={styles.checkRow}
      onPress={() => onChange(!checked)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
    >
      <MaterialIcons name={checked ? "check-box" : "check-box-outline-blank"} size={24} color={colors.primary} />
      <View style={{ flex: 1, marginLeft: 8 }}>{children}</View>
    </TouchableOpacity>
  );
}

export const Loading = () => (
  <View style={styles.center}>
    <ActivityIndicator size="large" color={colors.primary} />
  </View>
);

export function EmptyState({ icon = "inbox", title, message, actionTitle, onAction }) {
  return (
    <View style={styles.center}>
      <MaterialIcons name={icon} size={56} color="#ddd" />
      <Text style={styles.emptyTitle}>{title}</Text>
      {message ? <Text style={styles.emptyMessage}>{message}</Text> : null}
      {actionTitle ? (
        <Button title={actionTitle} onPress={onAction} style={{ marginTop: 16, alignSelf: "stretch" }} />
      ) : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <EmptyState
      icon="cloud-off"
      title="Bir sorun oluştu"
      message={message}
      actionTitle="Tekrar dene"
      onAction={onRetry}
    />
  );
}

export function StatusPill({ label, color }) {
  return (
    <View style={[styles.pill, { backgroundColor: `${color}1A` }]}>
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  button: { borderRadius: 10, paddingVertical: 15, alignItems: "center", justifyContent: "center", minHeight: 50 },
  primary: { backgroundColor: colors.primary },
  danger: { backgroundColor: colors.danger },
  outline: { borderWidth: 1.5, borderColor: colors.primary, backgroundColor: "#fff" },
  disabled: { opacity: 0.5 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  fieldWrap: { marginBottom: 14 },
  label: { fontSize: 14, color: colors.text, fontWeight: "600", marginBottom: 6 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e3e3e8",
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  input: { flex: 1, minHeight: 48, color: colors.text, fontSize: 16 },
  error: { color: colors.danger, fontSize: 12, marginTop: 4 },
  checkRow: { flexDirection: "row", alignItems: "flex-start", marginVertical: 6 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyTitle: { fontSize: 17, fontWeight: "bold", color: colors.text, marginTop: 12, textAlign: "center" },
  emptyMessage: { fontSize: 14, color: colors.muted, marginTop: 6, textAlign: "center" },
  pill: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  pillText: { fontSize: 12, fontWeight: "bold" },
});
