// Sunucudaki doğrulamaların istemci kopyası: kullanıcı göndermeden önce hatayı görsün.

export function isValidVkn(v: string) {
  if (!/^\d{10}$/.test(v)) return false;
  const d = v.split("").map(Number);
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    const tmp = (d[i]! + 9 - i) % 10;
    let x = (tmp * 2 ** (9 - i)) % 9;
    if (tmp !== 0 && x === 0) x = 9;
    sum += x;
  }
  return (10 - (sum % 10)) % 10 === d[9];
}

export function isValidTckn(v: string) {
  if (!/^[1-9]\d{10}$/.test(v)) return false;
  const d = v.split("").map(Number);
  const odd = d[0]! + d[2]! + d[4]! + d[6]! + d[8]!;
  const even = d[1]! + d[3]! + d[5]! + d[7]!;
  return (((odd * 7 - even) % 10) + 10) % 10 === d[9] && d.slice(0, 10).reduce((a, b) => a + b, 0) % 10 === d[10];
}

export const isValidTaxNumber = (v: string) => (v.length === 10 ? isValidVkn(v) : isValidTckn(v));

export function isValidIban(raw: string) {
  const iban = raw.replace(/\s+/g, "").toUpperCase();
  if (!/^TR\d{24}$/.test(iban)) return false;
  const n = (iban.slice(4) + iban.slice(0, 4)).replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let r = 0;
  for (const ch of n) r = (r * 10 + Number(ch)) % 97;
  return r === 1;
}

export const formatIban = (raw: string) =>
  raw
    .replace(/\s+/g, "")
    .toUpperCase()
    .replace(/(.{4})/g, "$1 ")
    .trim();

export const isEmail = (v: string) => /^\S+@\S+\.\S+$/.test(v.trim());
export const isMobile = (v: string) => /^(\+90|0)?5\d{9}$/.test(v.replace(/[\s()-]/g, ""));
export const isPhone = (v: string) => /^(\+90|0)?[2-5]\d{9}$/.test(v.replace(/[\s()-]/g, ""));
export const isStrongPassword = (v: string) => /^(?=.*[A-Za-zÇĞİÖŞÜçğıöşü])(?=.*\d).{8,128}$/.test(v);
