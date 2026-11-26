// Para her yerde kuruş (tam sayı) olarak işlenir; API'de TL cinsinden ondalık sayı olarak sunulur.

export const toTL = (cents: number): number => Math.round(cents) / 100;

export const fromTL = (tl: number): number => Math.round(tl * 100);

export function formatTL(cents: number): string {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(cents / 100);
}
