import { count } from 'drizzle-orm';
import { db, pool } from './connection';
import { products as productTable, variants as variantTable } from './schema';
import { products as demoProducts } from '../../../src/data/products';
import { normalizeSearch } from '../search';

async function main() {
  await db.transaction(async tx => {
    await tx.execute('SELECT pg_advisory_xact_lock(490202602)');
    const [{ total }] = await tx.select({ total: count() }).from(productTable);
    if (total > 0) { console.log('Seed skipped: existing products retained'); return; }
    for (const product of demoProducts) {
      await tx.insert(productTable).values({
        id: product.id, slug: product.slug, name: product.name, category: product.category,
        description: product.description, price: product.price, compareAt: product.compareAt ?? null,
        images: product.images, colors: product.colors, sizes: product.sizes, material: product.material,
        fit: product.fit, care: product.care, featured: product.featured,
        searchText: normalizeSearch(product.name + ' ' + product.description),
        createdAt: new Date(product.createdAt)
      });
      await tx.insert(variantTable).values(product.variants.map(v => ({
        productId: product.id, colorId: v.colorId, size: v.size, stock: v.stock
      })));
    }
    console.log('Seeded ' + demoProducts.length + ' DEMO products; replace before launch');
  });
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => pool.end());
