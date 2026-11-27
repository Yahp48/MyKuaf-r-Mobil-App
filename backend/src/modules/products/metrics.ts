import { prisma } from "../../lib/prisma.ts";
import { env } from "../../config/env.ts";

/**
 * Ürün rozetleri yalnızca gerçek verilerden hesaplanır:
 *  - Çok satan: son 30 günde ödenmiş siparişlerde en çok satılan ilk 10 ürün (en az 3 adet)
 *  - Çok tercih edilen: en çok favoriye eklenen ilk 10 ürün (en az 3 kişi)
 *  - Yeni: son 14 günde eklenen ürün
 * Sonuçlar kısa süre önbelleğe alınır (testlerde kapalı).
 */
export const BADGE_RULES = { bestSellerMin: 3, favoriteMin: 3, top: 10, newDays: 14 } as const;
const TTL_MS = env.NODE_ENV === "test" ? 0 : 5 * 60_000;
const PAID = ["PAID", "PREPARING", "SHIPPED", "DELIVERED"] as const;

type Metrics = { at: number; sold: Map<string, number>; best: Set<string>; fav: Set<string> };
let cache: Metrics | null = null;

export async function productMetrics(): Promise<Metrics> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache;
  const since = new Date(Date.now() - 30 * 86_400_000);
  const [sold, favs] = await Promise.all([
    prisma.orderItem.groupBy({
      by: ["productId"],
      where: { order: { status: { in: [...PAID] }, paidAt: { gte: since } } },
      _sum: { quantity: true },
    }),
    prisma.favoriteProduct.groupBy({ by: ["productId"], _count: { productId: true } }),
  ]);
  const soldMap = new Map(sold.map((s) => [s.productId, s._sum.quantity ?? 0]));
  const best = new Set(
    [...soldMap.entries()]
      .filter(([, q]) => q >= BADGE_RULES.bestSellerMin)
      .sort((a, b) => b[1] - a[1])
      .slice(0, BADGE_RULES.top)
      .map(([id]) => id),
  );
  const fav = new Set(
    favs
      .filter((f) => f._count.productId >= BADGE_RULES.favoriteMin)
      .sort((a, b) => b._count.productId - a._count.productId)
      .slice(0, BADGE_RULES.top)
      .map((f) => f.productId),
  );
  cache = { at: Date.now(), sold: soldMap, best, fav };
  return cache;
}

export type Badge = { key: "bestseller" | "favorite" | "new"; label: string };

export function badgesFor(p: { id: string; createdAt: Date }, m: Metrics): Badge[] {
  const out: Badge[] = [];
  if (m.best.has(p.id)) out.push({ key: "bestseller", label: "Çok satan" });
  if (m.fav.has(p.id)) out.push({ key: "favorite", label: "Çok tercih edilen" });
  if (Date.now() - p.createdAt.getTime() < BADGE_RULES.newDays * 86_400_000) out.push({ key: "new", label: "Yeni" });
  return out;
}
