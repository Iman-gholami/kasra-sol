import { it } from 'node:test';
import assert from 'node:assert/strict';
import { assertProductionDatabaseUrl, isUsableSecret, requireSecret, trustProxySetting } from '../src/config';

it('rejects short, missing and .env.example placeholder secrets', () => {
  assert.equal(isUsableSecret(undefined), false);
  assert.equal(isUsableSecret('x'.repeat(31)), false);
  assert.equal(isUsableSecret('replace-this-with-a-random-64-char-secret-before-deployment'), false);
  assert.equal(isUsableSecret('REPLACE_WITH_A_RANDOM_SECRET_AT_LEAST_32_CHARACTERS'), false);
  assert.equal(isUsableSecret('change-me-to-strong-url-safe-password-value'), false);
  assert.equal(isUsableSecret('0f9c3a7e51d24b6a8c9e0f1a2b3c4d5e6f708192a3b4c5d6'), true);
  assert.throws(() => requireSecret('ORDER_TOKEN_SECRET', 'replace-this-with-a-random-64-char-secret-before-deployment'));
});

it('parses the trusted proxy setting without trusting by default', () => {
  assert.equal(trustProxySetting(undefined), false);
  assert.equal(trustProxySetting('false'), false);
  assert.equal(trustProxySetting('true'), true);
  assert.equal(trustProxySetting('172.16.0.0/12,127.0.0.1'), '172.16.0.0/12,127.0.0.1');
});

it('rejects the example database password', () => {
  assert.throws(() => assertProductionDatabaseUrl('postgres://kasra:change-me-to-strong-url-safe-password@postgres:5432/kasra'));
  assert.doesNotThrow(() => assertProductionDatabaseUrl('postgres://kasra:9f2c41d0b7e6a5c3@postgres:5432/kasra'));
});

it('returns a usable secret unchanged', () => {
  const secret = '0f9c3a7e51d24b6a8c9e0f1a2b3c4d5e6f708192a3b4c5d6';
  assert.equal(requireSecret('ORDER_TOKEN_SECRET', secret), secret);
  assert.throws(() => requireSecret('ORDER_TOKEN_SECRET', undefined), /ORDER_TOKEN_SECRET/);
});

it('ignores a missing or unparsable database URL and decodes encoded passwords', () => {
  assert.doesNotThrow(() => assertProductionDatabaseUrl(undefined));
  assert.doesNotThrow(() => assertProductionDatabaseUrl('not a url'));
  assert.throws(() => assertProductionDatabaseUrl('postgres://kasra:%63hange-me@db/kasra'));
});

it('trims the trusted proxy setting', () => {
  assert.equal(trustProxySetting('  true '), true);
  assert.equal(trustProxySetting('   '), false);
});
