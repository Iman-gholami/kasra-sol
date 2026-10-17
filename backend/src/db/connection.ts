import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
export const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: Number(process.env.DB_POOL_SIZE ?? 10), idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000 });
export const db = drizzle({ client: pool });
