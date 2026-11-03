import type { FastifyInstance } from 'fastify';
import { pool } from '../db/connection';
import { recordAudit } from './audit';
import { lastPieceInput } from './product-schema';
import type { Guard } from './identity';
import { variantOffer } from '../../../src/lib/last-piece-discount';

type SettingRow = { enabled: boolean; percent: number; updatedAt: Date };
type PieceRow = { productId: string; slug: string; name: string; image: string | null; price: number; compareAt: number | null;
  colors: { id: string; name: string }[]; sizes: string[]; colorId: string; size: string };

/** «تخفیف آخرین دونه‌ها»: the owner's on/off switch and percent for variants at exactly one unit, with the variants it
 * applies to now. Reading needs products:read; changing it changes prices, so it needs products:price. */
export async function lastPieceAdminRoutes(app: FastifyInstance, check: Guard, opts: { invalidateCatalog?: () => Promise<void> }) {
  app.get('/v1/admin/last-piece-discount', async (req, reply) => {
    if (!await check(req, reply, 'products:read')) return;
    const [setting, pieces] = await Promise.all([
      pool.query<SettingRow>('SELECT enabled, percent, updated_at AS "updatedAt" FROM last_piece_discount WHERE id = 1'),
      pool.query<PieceRow>('SELECT p.id AS "productId", p.slug, p.name, p.images->>0 AS image, p.price, p.compare_at AS "compareAt", ' +
        'p.colors, p.sizes, v.color_id AS "colorId", v.size FROM product_variants v JOIN products p ON p.id = v.product_id ' +
        'WHERE p.active AND v.stock = 1 ORDER BY p.created_at DESC, p.id')
    ]);
    const { enabled = false, percent = 20, updatedAt = null } = setting.rows[0] ?? {};
    // What each piece sells at with the saved percent (also while it is off, as a preview).
    // Newest product first (the query), then the product's own colour and size order. A colour since removed from the
    // product is not on sale, so its stale variant row is left out.
    const keyed = pieces.rows.flatMap(row => {
      const color = row.colors.find(entry => entry.id === row.colorId);
      if (!color) return [];
      const offer = variantOffer({ price: row.price, compareAt: row.compareAt ?? undefined }, 1, { enabled: true, percent });
      return [{ key: [row.colors.indexOf(color), row.sizes.indexOf(row.size)], item: { productId: row.productId, slug: row.slug,
        name: row.name, image: row.image, colorId: row.colorId, colorName: color.name, size: row.size, price: row.price,
        compareAt: row.compareAt, offerPrice: offer.price, ownSaleWins: offer.price === row.price } }];
    });
    keyed.sort((a, b) => a.item.productId === b.item.productId ? a.key[0] - b.key[0] || a.key[1] - b.key[1] : 0);
    const variants = keyed.map(entry => entry.item);
    return reply.header('Cache-Control', 'no-store').send({ enabled, percent, updatedAt, variants });
  });

  app.put('/v1/admin/last-piece-discount', async (req, reply) => {
    const actor = await check(req, reply, 'products:price');
    if (!actor) return;
    const parsed = lastPieceInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_payload' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const before = await client.query<{ enabled: boolean; percent: number }>(
        'SELECT enabled, percent FROM last_piece_discount WHERE id = 1 FOR UPDATE');
      await client.query('UPDATE last_piece_discount SET enabled = $1, percent = $2, updated_by = $3, updated_at = now() WHERE id = 1',
        [parsed.data.enabled, parsed.data.percent, actor.id]);
      await recordAudit(client, actor.id, 'products.last_piece_discount', 'last-piece', { from: before.rows[0] ?? null, to: parsed.data });
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    await opts.invalidateCatalog?.();
    return reply.header('Cache-Control', 'no-store').send(parsed.data);
  });
}
