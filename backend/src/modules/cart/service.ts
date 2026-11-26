import { toTL } from "../../lib/money.ts";
import type { Tx } from "../../lib/prisma.ts";
import { prisma } from "../../lib/prisma.ts";
import { productInclude, serializeProduct } from "../products/serialize.ts";

export const MAX_QTY_PER_ITEM = 20;

export function shippingFor(
  subtotalCents: number,
  seller: { shippingFeeCents: number; freeShippingThresholdCents: number },
) {
  if (subtotalCents === 0) return 0;
  return subtotalCents >= seller.freeShippingThresholdCents ? 0 : seller.shippingFeeCents;
}

export async function loadCart(userId: string, db: Tx | typeof prisma = prisma) {
  return db.cartItem.findMany({
    where: { userId },
    include: {
      product: {
        include: { ...productInclude, seller: { select: { ...productInclude.seller.select, status: true } } },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

type CartRows = Awaited<ReturnType<typeof loadCart>>;
type CartRow = CartRows[number];

/**
 * Sepet özeti. Her satıcı kendi kargosunu gönderdiği için kargo satıcı bazında hesaplanır;
 * ödeme sırasında sepet satıcı başına siparişe bölünür. Satılamayacak satırlar uyarı olarak döner.
 */
export function summarizeCart(rows: CartRows) {
  const warnings: { productId: string; message: string }[] = [];
  const groups = new Map<string, { seller: CartRow["product"]["seller"]; rows: CartRow[]; subtotalCents: number }>();

  const items = rows.map((row) => {
    const p = row.product;
    let purchasable = true;
    if (!p.isActive || p.seller.status !== "ACTIVE") {
      purchasable = false;
      warnings.push({ productId: p.id, message: `${p.name} artık satışta değil` });
    } else if (p.stock < row.quantity) {
      purchasable = false;
      warnings.push({
        productId: p.id,
        message: p.stock === 0 ? `${p.name} tükendi` : `${p.name} için en fazla ${p.stock} adet alabilirsiniz`,
      });
    }
    const lineTotalCents = p.priceCents * row.quantity;
    if (purchasable) {
      const g = groups.get(p.sellerId) ?? { seller: p.seller, rows: [], subtotalCents: 0 };
      g.rows.push(row);
      g.subtotalCents += lineTotalCents;
      groups.set(p.sellerId, g);
    }
    return { product: serializeProduct(p), quantity: row.quantity, lineTotal: toTL(lineTotalCents), purchasable };
  });

  const sellerGroups = [...groups.values()].map((g) => ({
    ...g,
    shippingCents: shippingFor(g.subtotalCents, g.seller),
  }));
  const subtotalCents = sellerGroups.reduce((n, g) => n + g.subtotalCents, 0);
  const shippingCents = sellerGroups.reduce((n, g) => n + g.shippingCents, 0);
  const itemCount = sellerGroups.reduce((n, g) => n + g.rows.reduce((m, r) => m + r.quantity, 0), 0);
  const single = sellerGroups.length === 1 ? sellerGroups[0]! : undefined;

  return {
    items,
    warnings,
    summary: {
      itemCount,
      subtotal: toTL(subtotalCents),
      shipping: toTL(shippingCents),
      total: toTL(subtotalCents + shippingCents),
      sellers: sellerGroups.map((g) => ({
        id: g.seller.id,
        name: g.seller.displayName,
        subtotal: toTL(g.subtotalCents),
        shipping: toTL(g.shippingCents),
        remainingForFreeShipping: toTL(Math.max(0, g.seller.freeShippingThresholdCents - g.subtotalCents)),
      })),
      // Tek satıcılı sepette "X TL daha ekleyin, kargo bedava" ipucu
      freeShippingThreshold: single ? toTL(single.seller.freeShippingThresholdCents) : null,
      remainingForFreeShipping: single
        ? toTL(Math.max(0, single.seller.freeShippingThresholdCents - single.subtotalCents))
        : 0,
    },
    groups: sellerGroups,
    totals: { subtotalCents, shippingCents, totalCents: subtotalCents + shippingCents },
  };
}
