import { randomBytes, randomInt, createHash } from "node:crypto";

// Karışabilecek karakterler (0/O, 1/I/L) çıkarıldı: kullanıcı telefonda okuyabilsin.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** İnsan tarafından okunabilir benzersiz kod, ör. "RV-7K3MQ9XH" */
export function humanCode(prefix: string, length = 8): string {
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return `${prefix}-${out}`;
}

export function numericCode(digits = 6): string {
  return String(randomInt(0, 10 ** digits)).padStart(digits, "0");
}

export function randomToken(bytes = 48): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
