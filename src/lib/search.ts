import type { Product } from '@/types/store';
import { normalizePersian } from '@/lib/format';
import { allCategories } from '@/data/facets';

/** Pure, server-side catalog search: replace its data source with a search API later. */
export function rankProduct(product: Product, rawQuery: string): number | null {
  const query = normalizePersian(rawQuery);
  if (!query) return null;
  const name = normalizePersian(product.name);
  const category = normalizePersian(allCategories.find(c => c.slug === product.category)?.title ?? '');
  const colors = normalizePersian(product.colors.map(c => c.name).join(' '));
  const metadata = normalizePersian([product.material, product.fit, product.description].join(' '));
  const searchable = [name, category, colors, metadata].join(' ');
  const tokens = query.split(' ').filter(Boolean);
  const dense = searchable.replace(/\s/g, '');
  if (!tokens.every(token => searchable.includes(token) || dense.includes(token))) return null;
  if (name === query) return 0;
  if (name.startsWith(query)) return 10;
  if (name.includes(query) || tokens.every(token => name.includes(token))) return 20;
  if (category.includes(query)) return 30;
  if (tokens.every(token => [category, colors, name].some(part => part.includes(token)))) return 40;
  if (colors.includes(query)) return 45;
  if (tokens.every(token => metadata.includes(token))) return 65;
  return 80;
}
