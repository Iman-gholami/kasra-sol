import { it } from 'node:test';
import assert from 'node:assert/strict';
import './support/fake-db';

const { ORDER_STATUSES, nextStatuses } = await import('../src/admin/order-routes');

it('walks a cash-on-delivery order through preparation, shipping and delivery, with no skipped steps', () => {
  assert.deepEqual(nextStatuses('cod', 'confirmed_cod'), ['preparing', 'cancelled']);
  assert.deepEqual(nextStatuses('cod', 'preparing'), ['shipped', 'cancelled']);
  assert.deepEqual(nextStatuses('cod', 'shipped'), ['delivered']);
});
it('lets an unpaid online order only be cancelled: nothing can send it to fulfilment', () => {
  assert.deepEqual(nextStatuses('online', 'pending_payment'), ['cancelled']);
  for (const status of ORDER_STATUSES)
    for (const next of nextStatuses('online', status))
      assert.equal(next, 'cancelled', 'online ' + status + ' → ' + next);
});
it('ends at delivered and cancelled', () => {
  for (const payment of ['cod', 'online'])
    for (const status of ['delivered', 'cancelled']) assert.deepEqual(nextStatuses(payment, status), [], payment + ' ' + status);
});
it('offers nothing for unknown payments or statuses', () => {
  assert.deepEqual(nextStatuses('crypto', 'confirmed_cod'), []);
  assert.deepEqual(nextStatuses('cod', 'paid'), []);
  assert.deepEqual(nextStatuses('cod', 'pending_payment'), [], 'a COD order is never awaiting payment');
});
it('only ever moves to known statuses, and never back to an earlier one', () => {
  const rank = new Map(ORDER_STATUSES.map((status, index) => [status, index]));
  for (const payment of ['cod', 'online'])
    for (const status of ORDER_STATUSES)
      for (const next of nextStatuses(payment, status)) {
        assert.ok(rank.has(next as never), next);
        assert.ok(rank.get(next as never)! > rank.get(status)!, payment + ': ' + status + ' → ' + next);
      }
});
