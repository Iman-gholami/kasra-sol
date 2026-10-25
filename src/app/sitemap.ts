import type { MetadataRoute } from 'next';
import { products } from '@/data/products';
import { allCategories } from '@/data/facets';
export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  return [
    { url: base, priority: 1 },
    { url: base + '/shop', priority: 0.9 },
    ...allCategories.map((item) => ({ url: base + '/category/' + item.slug, priority: 0.8 })),
    ...products.map((item) => ({ url: base + '/product/' + item.slug, priority: 0.6 }))
  ];
}
