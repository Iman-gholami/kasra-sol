import type { MetadataRoute } from 'next';
import { categories } from '@/data/products';
import { getCatalogProducts } from '@/lib/backend-products';
import { siteUrl } from '@/lib/seo';

const INFO_PAGES = ['/about', '/contact', '/faq', '/shipping-and-returns', '/size-guide'];

// Built on every request from the live catalog: published products only, so new products appear and archived ones
// disappear without a release. robots.txt points search engines here only once indexing is switched on.
export const dynamic = 'force-dynamic';
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const products = await getCatalogProducts();
  return [
    { url: base, changeFrequency: 'daily', priority: 1 },
    { url: base + '/shop', changeFrequency: 'daily', priority: 0.9 },
    ...categories.map(item => ({ url: base + '/category/' + item.slug, changeFrequency: 'daily' as const, priority: 0.8 })),
    ...products.map(item => ({ url: base + '/product/' + encodeURIComponent(item.slug), priority: 0.7,
      images: item.images.slice(0, 1).map(image => new URL(image, base + '/').href) })),
    ...INFO_PAGES.map(path => ({ url: base + path, changeFrequency: 'monthly' as const, priority: 0.3 }))
  ];
}
