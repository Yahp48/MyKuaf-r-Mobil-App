import { hash, verify } from "@node-rs/argon2";

// @node-rs/argon2 `Algorithm` bir const enum; verbatimModuleSyntax ile değeri doğrudan yazılır (2 = Argon2id).
const ARGON2ID = 2;

// OWASP önerisi: Argon2id, 19 MiB bellek, 2 tur, paralellik 1
const OPTIONS = { algorithm: ARGON2ID, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export const hashPassword = (plain: string) => hash(plain, OPTIONS);

export async function verifyPassword(stored: string | null | undefined, plain: string): Promise<boolean> {
  if (!stored) {
    // Kullanıcı yokken de aynı süreyi harcayarak e-posta varlığının zamanlamayla anlaşılmasını engelle.
    await hash(plain, OPTIONS);
    return false;
  }
  try {
    return await verify(stored, plain);
  } catch {
    return false;
  }
}
