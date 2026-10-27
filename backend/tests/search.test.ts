import { it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSearch } from '../src/search';

it('unifies Arabic letters, drops diacritics and treats the zero-width non-joiner as a space', () => {
  assert.equal(normalizeSearch('  شوميز   كتان‌آبی  '), 'شومیز کتان آبی');
  assert.equal(normalizeSearch('سَلام'), 'سلام');
  assert.equal(normalizeSearch('ي ى'), 'ی ی');
});
it('lower-cases Latin text and collapses whitespace', () => {
  assert.equal(normalizeSearch(' Linen\t  SHIRT\n'), 'linen shirt');
  assert.equal(normalizeSearch('   '), '');
});
it('normalizes stored search text and queries the same way, so either spelling finds the product', () => {
  const stored = normalizeSearch('شومیز کتان آبی');
  for (const typed of ['شوميز', 'كتان', 'كتان‌آبی']) assert.ok(stored.includes(normalizeSearch(typed)), typed);
});
