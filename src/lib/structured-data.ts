import type { Product } from '@/types/store';
import { SITE_NAME } from '@/lib/seo';

const SCHEMA = 'https://schema.org/';
/** Prices are kept in toman; schema.org needs an ISO 4217 currency, and the toman has none: 1 toman = 10 rial (IRR). */
const rial = (toman: number) => toman * 10;

/** schema.org Product with its Offer, built from the product the page shows (the API's data, or the demo catalog),
 * for Google's product results. Only facts the store holds: no ratings, shipping or return terms it does not have. */
export function productJsonLd(product: Product, base: string, categoryTitle?: string) {
  const url = base + '/product/' + encodeURIComponent(product.slug);
  const price = { '@type': 'UnitPriceSpecification', price: rial(product.price), priceCurrency: 'IRR' };
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': url + '#product',
    url,
    name: product.name,
    description: product.description,
    sku: product.id,
    image: product.images.map(src => new URL(src, base + '/').href),
    brand: { '@type': 'Brand', name: SITE_NAME },
    ...(categoryTitle ? { category: categoryTitle } : {}),
    ...(product.material ? { material: product.material } : {}),
    ...(product.colors.length ? { color: product.colors.map(color => color.name).join('، ') } : {}),
    ...(product.sizes.length ? { size: product.sizes.join('، ') } : {}),
    offers: {
      '@type': 'Offer',
      url,
      price: rial(product.price),
      priceCurrency: 'IRR',
      // In stock while any colour and size has units left (the same rule as the buy box).
      availability: SCHEMA + (product.variants.some(variant => variant.stock > 0) ? 'InStock' : 'OutOfStock'),
      itemCondition: SCHEMA + 'NewCondition',
      seller: { '@type': 'Organization', name: SITE_NAME },
      // The crossed-out price of a discount, as Google reads it.
      ...(product.compareAt && product.compareAt > product.price ? { priceSpecification: [price,
        { ...price, priceType: SCHEMA + 'StrikethroughPrice', price: rial(product.compareAt) }] } : {})
    }
  };
}

/** JSON for a <script type="application/ld+json">: `<` is escaped, so text such as a product name containing
 * "</script>" cannot end the script element. */
export const jsonLd = (data: unknown) => JSON.stringify(data).replace(/</g, '\\u003c');
