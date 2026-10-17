import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pool } from './connection';

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(490202601)');
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (version varchar(64) PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    const version = '001_init';
    const applied = await client.query('SELECT 1 FROM schema_migrations WHERE version=$1', [version]);
    if (!applied.rowCount) {
      await client.query(readFileSync(resolve(process.cwd(), 'sql/001_init.sql'), 'utf8'));
      await client.query('INSERT INTO schema_migrations(version) VALUES($1)', [version]);
    }
    await client.query('COMMIT');
    console.log('Database migrations applied');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
