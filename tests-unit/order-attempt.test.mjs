import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { orderAttempt, clearOrderAttempt } from '../src/lib/order-attempt.ts';

const values = new Map();
beforeEach(() => {
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key)
  } });
  clearOrderAttempt();
  values.clear();
});

test('reuses the key after a reload with only a digest retained in session storage', async () => {
  const payload = JSON.stringify({ address: 'private-address', quantity: 1 });
  const first = await orderAttempt(payload);
  assert.equal((await orderAttempt(payload)).key, first.key);
  // A fresh module represents the new page's empty in-memory state.
  const reloaded = await import('../src/lib/order-attempt.ts?reload');
  assert.equal((await reloaded.orderAttempt(payload)).key, first.key);
  assert.ok(![...values.values()].join('').includes('private-address'));
  assert.notEqual((await orderAttempt(payload + 'changed')).key, first.key);
});

test('clears a completed attempt so a later intentional purchase gets a fresh key', async () => {
  const first = await orderAttempt('same-cart');
  clearOrderAttempt();
  assert.notEqual((await orderAttempt('same-cart')).key, first.key);
});

test('handles malformed or unavailable session storage without losing same-page retries', async () => {
  values.set('kasra-order-attempt-v1', '{broken');
  const first = await orderAttempt('cart');
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, get() { throw new Error('blocked'); } });
  assert.equal((await orderAttempt('cart')).key, first.key);
});

test('concurrent attempts for the same payload share a key', async () => {
  const attempts = await Promise.all(Array.from({ length: 10 }, () => orderAttempt('cart')));
  assert.equal(new Set(attempts.map(attempt => attempt.key)).size, 1);
});
