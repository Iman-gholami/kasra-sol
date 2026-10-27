// Replaces the shared pg pool with an in-memory stand-in, so route handlers can be exercised with Fastify's
// inject() without PostgreSQL. Import this module before any module that opens the pool.
process.env.DATABASE_URL ??= 'postgres://unit:test@127.0.0.1:1/never-connected';
const { pool } = await import('../../src/db/connection');

export type Query = { text: string; values: unknown[] };
export type Answer = { rows: unknown[]; rowCount?: number };
type Responder = (query: Query) => Answer | Promise<Answer>;

const NOT_STUBBED: Responder = query => { throw new Error('Unexpected database query: ' + query.text.slice(0, 80)); };
let responder: Responder = NOT_STUBBED;
export const queries: Query[] = [];

async function run(text: string | { text: string; values?: unknown[] }, values?: unknown[]) {
  const query = typeof text === 'string' ? { text, values: values ?? [] } : { text: text.text, values: text.values ?? [] };
  queries.push(query);
  const answer = await responder(query);
  return { rows: answer.rows, rowCount: answer.rowCount ?? answer.rows.length };
}
Object.assign(pool, { query: run, connect: async () => ({ query: run, release() {} }) });

/** Answers every query with `respond` (default: fail the test on any query) and forgets earlier queries. */
export function database(respond: Responder = NOT_STUBBED) {
  responder = respond;
  queries.length = 0;
}
