import type { MetadataRoute } from 'next';
import { categories, products } from '@/data/products';
export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  return [
    { url: base, priority: 1 },
    { url: base + '/shop', priority: 0.9 },
    ...categories.map((item) => ({ url: base + '/category/' + item.slug, priority: 0.8 })),
    ...products.map((item) => ({ url: base + '/product/' + item.slug, priority: 0.6 }))
  ];
}
