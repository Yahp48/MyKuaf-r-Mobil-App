import { toTL } from "../../lib/money.ts";

export function serializeProduct(
  p: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    brand: string | null;
    priceCents: number;
    compareAtPriceCents: number | null;
    stock: number;
    images: string[];
    features: string[];
    isFeatured: boolean;
    ratingAvg: number;
    ratingCount: number;
    category: { id: string; slug: string; name: string };
  },
  extra: { isFavorite?: boolean } = {},
) {
  const discountPercent =
    p.compareAtPriceCents && p.compareAtPriceCents > p.priceCents
      ? Math.round((1 - p.priceCents / p.compareAtPriceCents) * 100)
      : 0;
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    description: p.description,
    brand: p.brand,
    price: toTL(p.priceCents),
    compareAtPrice: p.compareAtPriceCents ? toTL(p.compareAtPriceCents) : null,
    discountPercent,
    stock: p.stock,
    inStock: p.stock > 0,
    images: p.images,
    image: p.images[0] ?? null,
    features: p.features,
    isFeatured: p.isFeatured,
    rating: Math.round(p.ratingAvg * 10) / 10,
    ratingCount: p.ratingCount,
    category: p.category,
    ...(extra.isFavorite !== undefined ? { isFavorite: extra.isFavorite } : {}),
  };
}

export const productInclude = { category: { select: { id: true, slug: true, name: true } } } as const;
