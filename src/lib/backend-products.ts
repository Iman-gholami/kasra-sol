import { cache } from 'react';
import { bySlug, products as demoProducts } from '@/data/products';
import type { Product } from '@/types/store';

const base = process.env.BACKEND_INTERNAL_URL;
export const getProductBySlug = cache(async (slug: string): Promise<Product | undefined> => {
  if (!base) return bySlug(slug);
  const response = await fetch(base + '/v1/products/' + encodeURIComponent(slug), { cache: 'no-store' });
  if (response.status === 404) return undefined;
  if (!response.ok) throw new Error('Product API unavailable: ' + response.status);
  return response.json() as Promise<Product>;
});
export const getHomeProducts = cache(async (): Promise<Product[]> => {
  if (!base) return demoProducts;
  const response = await fetch(base + '/v1/products?limit=48&sort=newest', { cache: 'no-store' });
  if (!response.ok) throw new Error('Catalog API unavailable: ' + response.status);
  const result = await response.json() as { items: Product[] };
  return result.items;
});
