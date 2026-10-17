import { products } from '@/data/products';
import { toLatinDigits } from '@/lib/format';
import { rankProduct } from '@/lib/search';
import { categories } from '@/data/products';
import { variantMatchesColorFamily } from '@/lib/shop-by-color';
import type { CatalogFilters, CategorySlug, Product } from '@/types/store';

export const PAGE_SIZE = 12;
type SearchParams = Record<string, string | string[] | undefined>;
const one = (value?: string | string[]) => typeof value === 'string' ? value : value?.[0];
const numeric = (value?: string) => {
  if (!value) return undefined;
  const normalized = toLatinDigits(value).replace(/[\s,٬،]/g, '');
  if (!/^\d+$/.test(normalized)) return undefined;
  const n = Number(normalized);
  return Number.isSafeInteger(n) && n >= 0 ? n : undefined;
};

export const parseFilters = (params: SearchParams, category?: CategorySlug): CatalogFilters => {
  const requestedCategory = one(params.category);
  const sort = one(params.sort);
  return {
    category: category ?? (categories.some(c => c.slug === requestedCategory) ? requestedCategory as CategorySlug : undefined),
    q: one(params.q)?.trim().slice(0, 100),
    size: products.some(p => p.sizes.includes(one(params.size) ?? '')) ? one(params.size) : undefined,
    color: products.some(p => p.colors.some(c => (c.familyId ?? c.id) === one(params.color))) ? one(params.color) : undefined,
    min: numeric(one(params.min)),
    max: numeric(one(params.max)),
    inStock: one(params.stock) === '1',
    discounted: one(params.sale) === '1',
    sort: ['newest', 'price-asc', 'price-desc', 'featured'].includes(sort ?? '') ? sort as CatalogFilters['sort'] : 'featured',
    page: Math.min(1000, Math.max(1, Math.floor(numeric(one(params.page)) ?? 1)))
  };
};

/** A server-side adapter boundary. Replace this implementation with a paginated API. */
export async function queryProducts(filters: CatalogFilters): Promise<{ items: Product[]; total: number; page: number; pages: number }> {
  if (process.env.BACKEND_INTERNAL_URL) {
    const params = new URLSearchParams();
    if (filters.category) params.set('category', filters.category);
    if (filters.q) params.set('q', filters.q);
    if (filters.size) params.set('size', filters.size);
    if (filters.color) params.set('color', filters.color);
    if (filters.min !== undefined) params.set('min', String(filters.min));
    if (filters.max !== undefined) params.set('max', String(filters.max));
    if (filters.inStock) params.set('stock', '1');
    if (filters.discounted) params.set('sale', '1');
    if (filters.sort) params.set('sort', filters.sort);
    params.set('page', String(filters.page ?? 1));
    const response = await fetch(process.env.BACKEND_INTERNAL_URL + '/v1/products?' + params, { cache: 'no-store' });
    if (!response.ok) throw new Error('Catalog API unavailable: ' + response.status);
    return response.json() as Promise<{ items: Product[]; total: number; page: number; pages: number }>;
  }
  let result = products.filter((product) => {
    if (filters.category && product.category !== filters.category) return false;
    if (filters.q && rankProduct(product, filters.q) === null) return false;
    if (filters.min !== undefined && product.price < filters.min) return false;
    if (filters.max !== undefined && product.price > filters.max) return false;
    if (filters.discounted && !product.compareAt) return false;
    const variants = product.variants.filter((variant) =>
      (!filters.size || variant.size === filters.size) &&
      (!filters.color || variantMatchesColorFamily(product, variant.colorId, filters.color)));
    if ((filters.size || filters.color) && !variants.length) return false;
    if (filters.inStock && !variants.some((variant) => variant.stock > 0)) return false;
    return true;
  });
  result = [...result].sort((a, b) => {
    if (filters.sort === 'price-asc') return a.price - b.price;
    if (filters.sort === 'price-desc') return b.price - a.price;
    if (filters.sort === 'newest') return b.createdAt.localeCompare(a.createdAt);
    if (filters.q) return (rankProduct(a, filters.q) ?? 999) - (rankProduct(b, filters.q) ?? 999) ||
      Number(b.featured) - Number(a.featured) || b.createdAt.localeCompare(a.createdAt);
    return Number(b.featured) - Number(a.featured) || b.createdAt.localeCompare(a.createdAt);
  });
  const total = result.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(filters.page ?? 1, pages);
  return { items: result.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), total, page, pages };
}
