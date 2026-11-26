import { toTL } from "../../lib/money.ts";

export function serializeUser(u: {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: string;
  walletBalanceCents: number;
  marketingOptIn: boolean;
  createdAt: Date;
}) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    phone: u.phone,
    role: u.role,
    walletBalance: toTL(u.walletBalanceCents),
    marketingOptIn: u.marketingOptIn,
    createdAt: u.createdAt.toISOString(),
  };
}
