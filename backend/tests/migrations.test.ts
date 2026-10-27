import { it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

const listed = [...readFileSync('src/db/migrate.ts', 'utf8').matchAll(/'(\d{3}_[a-z_]+)'/g)].map(match => match[1]);
const files = readdirSync('sql').filter(file => file.endsWith('.sql')).map(file => file.replace(/\.sql$/, ''));

it('applies every SQL file in sql/, each once and in numeric order', () => {
  assert.deepEqual(listed, [...files].sort(), 'a migration file is missing from src/db/migrate.ts (or listed out of order)');
  assert.equal(new Set(listed).size, listed.length);
});
it('numbers migrations without gaps or duplicates', () => {
  assert.deepEqual(listed.map(version => Number(version.slice(0, 3))), listed.map((_, index) => index + 1));
});
