import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { shopinoTrackingRoutes, type ShopinoTrackingStore } from '../src/shopino-tracking';

const SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
function setup(token = SECRET) {
  const calls: number[][] = [];
  const store: ShopinoTrackingStore = {
    async get(ids) { calls.push(ids); return new Map([[7, 'POST123'], [9, 'TIPAX456']]); }
  };
  const app = Fastify();
  app.register(shopinoTrackingRoutes, { store, token });
  return { app, calls };
}

describe('Shopino tracking API', () => {
  it('requires a valid bearer token before reading tracking data', async () => {
    const { app, calls } = setup();
    try {
      for (const authorization of ['', 'Basic ' + SECRET, 'Bearer wrong', 'Bearer ' + SECRET + '0']) {
        const response = await app.inject({ method: 'POST', url: '/v1/shopino/tracking',
          headers: { authorization }, payload: { order_ids: [7] } });
        assert.equal(response.statusCode, 401);
      }
      assert.deepEqual(calls, []);
    } finally { await app.close(); }
  });

  it('does not enable tracking if the token is absent or a placeholder', async () => {
    for (const token of ['', 'example-placeholder-secret-must-not-enable-access']) {
      const { app, calls } = setup(token);
      try {
        const response = await app.inject({ method: 'POST', url: '/v1/shopino/tracking',
          headers: { authorization: 'Bearer ' + SECRET }, payload: { order_ids: [7] } });
        assert.equal(response.statusCode, 503);
        assert.deepEqual(calls, []);
      } finally { await app.close(); }
    }
  });

  it('returns codes in the exact requested order, including null and repeated IDs', async () => {
    const { app, calls } = setup();
    try {
      const response = await app.inject({ method: 'POST', url: '/v1/shopino/tracking',
        headers: { authorization: 'Bearer ' + SECRET }, payload: { order_ids: [9, 8, 7, 9] } });
      assert.equal(response.statusCode, 200);
      assert.equal(response.headers['cache-control'], 'no-store');
      assert.deepEqual(response.json(), { codes: ['TIPAX456', null, 'POST123', 'TIPAX456'] });
      assert.deepEqual(calls, [[9, 8, 7, 9]]);
    } finally { await app.close(); }
  });

  it('rejects malformed or unsafe IDs without querying the store', async () => {
    const { app, calls } = setup();
    try {
      for (const payload of [{}, { order_ids: [0] }, { order_ids: [-1] }, { order_ids: [1.5] },
        { order_ids: ['7'] }, { order_ids: [Number.MAX_SAFE_INTEGER + 1] }, { order_ids: [7], extra: true }]) {
        const response = await app.inject({ method: 'POST', url: '/v1/shopino/tracking',
          headers: { authorization: 'Bearer ' + SECRET }, payload });
        assert.equal(response.statusCode, 400, JSON.stringify(payload));
      }
      assert.deepEqual(calls, []);
    } finally { await app.close(); }
  });
});
