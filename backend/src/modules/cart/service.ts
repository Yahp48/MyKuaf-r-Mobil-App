import { env } from "../../config/env.ts";
import { toTL } from "../../lib/money.ts";
import type { Tx } from "../../lib/prisma.ts";
import { prisma } from "../../lib/prisma.ts";
import { productInclude, serializeProduct } from "../products/serialize.ts";

export const MAX_QTY_PER_ITEM = 20;

export function shippingFor(subtotalCents: number) {
  if (subtotalCents === 0) return 0;
  return subtotalCents >= env.FREE_SHIPPING_THRESHOLD_CENTS ? 0 : env.SHIPPING_FEE_CENTS;
}

export async function loadCart(userId: string, db: Tx | typeof prisma = prisma) {
  return db.cartItem.findMany({
    where: { userId },
    include: { product: { include: productInclude } },
    orderBy: { createdAt: "asc" },
  });
}

type CartRows = Awaited<ReturnType<typeof loadCart>>;

/** Sepet özeti; satılamayacak satırlar (pasif ürün, stok yetersiz) uyarı olarak işaretlenir. */
export function summarizeCart(rows: CartRows) {
  const warnings: { productId: string; message: string }[] = [];
  let subtotalCents = 0;
  let itemCount = 0;

  const items = rows.map((row) => {
    const p = row.product;
    let purchasable = true;
    if (!p.isActive) {
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
      subtotalCents += lineTotalCents;
      itemCount += row.quantity;
    }
    return {
      product: serializeProduct(p),
      quantity: row.quantity,
      lineTotal: toTL(lineTotalCents),
      purchasable,
    };
  });

  const shippingCents = shippingFor(subtotalCents);
  return {
    items,
    warnings,
    summary: {
      itemCount,
      subtotal: toTL(subtotalCents),
      shipping: toTL(shippingCents),
      total: toTL(subtotalCents + shippingCents),
      freeShippingThreshold: toTL(env.FREE_SHIPPING_THRESHOLD_CENTS),
      remainingForFreeShipping: toTL(Math.max(0, env.FREE_SHIPPING_THRESHOLD_CENTS - subtotalCents)),
    },
    totals: { subtotalCents, shippingCents, totalCents: subtotalCents + shippingCents },
  };
}
