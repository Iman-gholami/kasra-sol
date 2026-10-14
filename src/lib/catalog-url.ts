import type { CatalogFilters } from '@/types/store';

/** Client-safe builder for the existing catalog query contract
 * (category, q, size, color, min, max, stock=1, sale=1, sort, page). */
export function catalogHref(action: string, filters: CatalogFilters, fixedCategory = false,
  overrides: Record<string, string | null> = {}): string {
  const params = new URLSearchParams();
  if (filters.category && !fixedCategory) params.set('category', filters.category);
  if (filters.q) params.set('q', filters.q);
  if (filters.size) params.set('size', filters.size);
  if (filters.color) params.set('color', filters.color);
  if (filters.min !== undefined) params.set('min', String(filters.min));
  if (filters.max !== undefined) params.set('max', String(filters.max));
  if (filters.inStock) params.set('stock', '1');
  if (filters.discounted) params.set('sale', '1');
  if (filters.sort && filters.sort !== 'featured') params.set('sort', filters.sort);
  for (const [key, value] of Object.entries(overrides)) {
    if (value === null) params.delete(key); else params.set(key, value);
  }
  const query = params.toString();
  return action + (query ? '?' + query : '');
}

export const sortLabels: Record<NonNullable<CatalogFilters['sort']>, string> = {
  featured: 'پیشنهادی',
  newest: 'تازه‌ترین',
  'price-asc': 'قیمت: کم به زیاد',
  'price-desc': 'قیمت: زیاد به کم'
};
