import { sql } from 'drizzle-orm';
import { pool } from './db/connection';
import type { LastPieceSetting } from '../../src/lib/last-piece-discount';

type Row = { enabled: boolean; percent: number };
/** A pg pool or client (admin routes), or a Drizzle database or transaction (catalog and orders). */
type Source = { query: (text: string) => Promise<{ rows: unknown[] }> } | { execute: (query: ReturnType<typeof sql>) => Promise<{ rows: unknown[] }> };
const OFF: LastPieceSetting = { enabled: false, percent: 20 };

/** The owner's last-piece discount: on/off and the percent (row 1 of `last_piece_discount`; off when it is missing). */
export async function getLastPieceSetting(source: Source = pool): Promise<LastPieceSetting> {
  const text = 'SELECT enabled, percent FROM last_piece_discount WHERE id = 1';
  const { rows } = 'execute' in source ? await source.execute(sql.raw(text)) : await source.query(text);
  const row = rows[0] as Row | undefined;
  return row ? { enabled: row.enabled, percent: row.percent } : OFF;
}
