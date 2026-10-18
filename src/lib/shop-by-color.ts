import { products } from '@/data/products';
import { palette } from '@/data/facets';
import type { ProductCardData } from '@/components/products/product-card';
import type { Product, ProductColor } from '@/types/store';

export const COLOR_PREVIEW_LIMIT = 4;

export type ColorFamily = {
  slug: string;
  name: string;
  hex: string;
  order: number;
};
export type ShopByColorResult = {
  color: ColorFamily;
  count: number;
  products: ProductCardData[];
};

/** Explicit grouping: a shade can opt into a broader family via ProductColor.familyId.
 * No inference from images or color names. The existing six palette IDs are their own families.
 */
export function colorFamilyId(color: ProductColor): string {
  return color.familyId ?? color.id;
}

/** Use actual variants, never a product's category or photographic hue. */
export function variantMatchesColorFamily(product: Product, variantColorId: string, family: string): boolean {
  return product.colors.some(color => color.id === variantColorId && colorFamilyId(color) === family);
}

export function hasColorFamily(product: Product, family: string): boolean {
  return product.variants.some(variant => variantMatchesColorFamily(product, variant.colorId, family));
}

function previewProduct(product: Product): ProductCardData {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    category: product.category,
    price: product.price,
    compareAt: product.compareAt,
    // ProductCard needs just the hero thumbnail; no full gallery, size or stock tables in client payload.
    images: product.images.slice(0, 1),
    colors: product.colors
  };
}

/** Server-only mock catalog adapter. Returns at most four small product summaries per color.
 * Replace this one function with a batched backend facet+preview query later.
 */
export function getShopByColorResults(catalog: Product[] = products): ShopByColorResult[] {
  const encountered = new Map<string, { color: ColorFamily; products: Product[] }>();
  const configuredOrder = new Map(palette.map((c, index) => [c.id, index]));

  for (const product of catalog) {
    const families = new Set<string>();
    for (const color of product.colors) {
      const slug = colorFamilyId(color);
      if (families.has(slug) || !hasColorFamily(product, slug)) continue;
      families.add(slug);
      if (!encountered.has(slug)) {
        const familyStyle = palette.find(c => c.id === slug);
        encountered.set(slug, {
          color: {
            slug,
            name: familyStyle?.name ?? color.name,
            hex: familyStyle?.hex ?? color.hex,
            order: configuredOrder.get(slug) ?? palette.length + encountered.size
          },
          products: []
        });
      }
      encountered.get(slug)!.products.push(product);
    }
  }

  return [...encountered.values()].map(({color, products: matches}) => ({
    color,
    count: matches.length,
    products: matches
      .sort((a,b) => Number(b.featured) - Number(a.featured) ||
        b.createdAt.localeCompare(a.createdAt))
      .slice(0, COLOR_PREVIEW_LIMIT)
      .map(previewProduct)
  })).sort((a,b) => a.color.order - b.color.order);
}
