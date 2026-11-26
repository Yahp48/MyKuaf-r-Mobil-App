/** Gizlilik için herkese açık yorumlarda "Ayşe Y." biçiminde kısa ad. */
export function shortName(full: string): string {
  const parts = full.trim().split(/\s+/);
  if (parts.length < 2) return parts[0] || "Anonim";
  return `${parts[0]} ${parts[parts.length - 1]!.charAt(0).toLocaleUpperCase("tr-TR")}.`;
}
