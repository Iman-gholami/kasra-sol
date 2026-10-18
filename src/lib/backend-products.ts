import { cache } from 'react';
import { headers } from 'next/headers';
import { bySlug, products as demoProducts } from '@/data/products';
import { forwardedFor } from '@/lib/backend-proxy';
import type { Product } from '@/types/store';

const base = process.env.BACKEND_INTERNAL_URL;
/** Server-rendered pages call the API on the visitor's behalf; pass their address on for per-visitor rate limits. */
export async function visitorHeaders(): Promise<Record<string, string>> {
  try { return forwardedFor(await headers()); } catch { return {}; }
}
export const getProductBySlug = cache(async (slug: string): Promise<Product | undefined> => {
  if (!base) return bySlug(slug);
  const response = await fetch(base + '/v1/products/' + encodeURIComponent(slug),
    { cache: 'no-store', headers: await visitorHeaders() });
  if (response.status === 404) return undefined;
  if (!response.ok) throw new Error('Product API unavailable: ' + response.status);
  return response.json() as Promise<Product>;
});
export const getHomeProducts = cache(async (): Promise<Product[]> => {
  if (!base) return demoProducts;
  const response = await fetch(base + '/v1/products?limit=48&sort=newest', { cache: 'no-store', headers: await visitorHeaders() });
  if (!response.ok) throw new Error('Catalog API unavailable: ' + response.status);
  const result = await response.json() as { items: Product[] };
  return result.items;
});
