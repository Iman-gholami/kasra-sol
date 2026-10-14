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

/** Group shades explicitly using catalog metadata; never infer color from pixels. */
export function colorFamilyId(color: ProductColor): string {
  return color.familyId ?? color.id;
}

/** Return only shades that actually have product variants, including sold-out variants. */
export function matchingColorShades(product: Product, family: string): ProductColor[] {
  const variantColorIds = new Set(product.variants.map(variant => variant.colorId));
  return product.colors.filter(color =>
    colorFamilyId(color) === family && variantColorIds.has(color.id));
}

export function hasColorFamily(product: Product, family: string): boolean {
  return matchingColorShades(product, family).length > 0;
}

/** A lightweight card payload with the selected family's correct shade preview.
 * If the mock data lacks a photo of that shade, leave image undefined instead of
 * showing misleading photography belonging to another color.
 */
export function toColorProductCard(product: Product, family: string): ProductCardData {
  const shades = matchingColorShades(product, family);
  const hasStock = (id: string) =>
    product.variants.some(variant => variant.colorId === id && variant.stock > 0);
  const photoShade = shades.find(color =>
    hasStock(color.id) && product.colorPreviewImages?.[color.id]) ??
    shades.find(color => product.colorPreviewImages?.[color.id]);
  const shade = photoShade ?? shades[0];
  const familyStyle = palette.find(color => color.id === family);
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    category: product.category,
    price: product.price,
    compareAt: product.compareAt,
    images: product.images.slice(0, 1),
    colors: product.colors,
    colorPreview: shade ? {
      slug: family,
      name: familyStyle?.name ?? shade.name,
      hex: familyStyle?.hex ?? shade.hex,
      image: photoShade ? product.colorPreviewImages?.[photoShade.id] : undefined,
      inStock: shades.some(color => hasStock(color.id))
    } : undefined
  };
}

/** Server-side mock adapter: bounded card summaries, never an entire catalog on the client.
 * Later replace the in-memory scan with a faceted query and per-family LIMIT 4.
 */
export function getShopByColorResults(): ShopByColorResult[] {
  const encountered = new Map<string, { color: ColorFamily; products: Product[] }>();
  const configuredOrder = new Map(palette.map((color, index) => [color.id, index]));

  for (const product of products) {
    const presentVariantIds = new Set(product.variants.map(variant => variant.colorId));
    const seen = new Set<string>();
    for (const shade of product.colors) {
      if (!presentVariantIds.has(shade.id)) continue;
      const slug = colorFamilyId(shade);
      if (seen.has(slug)) continue;
      seen.add(slug);
      if (!encountered.has(slug)) {
        const style = palette.find(color => color.id === slug);
        encountered.set(slug, {
          color: {
            slug,
            name: style?.name ?? shade.name,
            hex: style?.hex ?? shade.hex,
            order: configuredOrder.get(slug) ?? palette.length + encountered.size
          },
          products: []
        });
      }
      encountered.get(slug)!.products.push(product);
    }
  }

  return [...encountered.values()].map(({ color, products: matches }) => {
    const candidates = matches.map(product => ({
      product,
      card: toColorProductCard(product, color.slug)
    }));
    candidates.sort((a, b) =>
      Number(Boolean(b.card.colorPreview?.image)) - Number(Boolean(a.card.colorPreview?.image)) ||
      Number(Boolean(b.card.colorPreview?.inStock)) - Number(Boolean(a.card.colorPreview?.inStock)) ||
      Number(b.product.featured) - Number(a.product.featured) ||
      b.product.createdAt.localeCompare(a.product.createdAt));
    return {
      color,
      count: matches.length,
      products: candidates.slice(0, COLOR_PREVIEW_LIMIT).map(candidate => candidate.card)
    };
  }).sort((a, b) => a.color.order - b.color.order);
}
