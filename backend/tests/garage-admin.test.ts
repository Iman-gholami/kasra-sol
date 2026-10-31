// The one-shot setup of the Garage object storage (storage-init). A stand-in admin API here; the real one runs in
// backend CI (tests/integration/media.integration.mjs) and in the deployment test.
import { describe, it, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { garageSettingsFromEnv, setupGarage, waitForGarage } from '../src/admin/garage-admin';

const settings = { adminUrl: 'http://storage:3903', adminToken: 't'.repeat(64), bucket: 'kasra-media',
  accessKeyId: 'GK' + '0123456789abcdef01234567', secretAccessKey: 'f'.repeat(64) };
const NODE = 'fc74f12080ab28dd73ad76d25ccb66210af6ae21146af3a359e518215da1f557';

type State = { role: boolean; key: boolean; bucket: boolean; grant: boolean };
/** Garage's admin API v2 as observed on v2.4.1, holding `state`. */
function fakeGarage(t: TestContext, state: State, token = settings.adminToken) {
  const calls: { path: string; body?: Record<string, unknown> }[] = [];
  t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    const path = url.replace(settings.adminUrl + '/v2/', '');
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ path, body });
    const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
    if ((init.headers as Record<string, string>).Authorization !== 'Bearer ' + token) return json({ code: 'Forbidden' }, 403);
    switch (path.split('?')[0]) {
      case 'GetClusterStatus': return json({ layoutVersion: state.role ? 1 : 0,
        nodes: [{ id: NODE, role: state.role ? { zone: 'kasra' } : null, dataPartition: { available: 30e9 } }] });
      case 'UpdateClusterLayout': return json({});
      case 'ApplyClusterLayout': state.role = true; return json({});
      case 'GetKeyInfo': return state.key ? json({ accessKeyId: settings.accessKeyId }) : json({ code: 'NoSuchAccessKey' }, 404);
      case 'ImportKey': state.key = true; return json({ accessKeyId: settings.accessKeyId });
      case 'GetBucketInfo': return state.bucket ? json({ id: 'b1', keys: state.grant
        ? [{ accessKeyId: settings.accessKeyId, permissions: { read: true, write: true, owner: false } }] : [] })
        : json({ code: 'NoSuchBucket' }, 404);
      case 'CreateBucket': state.bucket = true; return json({ id: 'b1', keys: [] });
      case 'AllowBucketKey': state.grant = true; return json({});
      default: return json({ code: 'NotFound' }, 404);
    }
  });
  return calls;
}

describe('preparing the object storage', () => {
  it('gives a fresh node its role, imports the key, creates the bucket and grants the key read and write', async t => {
    const state = { role: false, key: false, bucket: false, grant: false };
    const calls = fakeGarage(t, state);
    assert.deepEqual(await setupGarage(settings), ['layout', 'key', 'bucket', 'grant']);
    assert.deepEqual(state, { role: true, key: true, bucket: true, grant: true });
    const body = (path: string) => calls.find(call => call.path === path)?.body;
    assert.deepEqual(body('UpdateClusterLayout'), { roles: [{ id: NODE, zone: 'kasra', capacity: 30e9, tags: [] }] });
    assert.deepEqual(body('ApplyClusterLayout'), { version: 1 });
    assert.deepEqual(body('ImportKey'), { accessKeyId: settings.accessKeyId, secretAccessKey: settings.secretAccessKey, name: 'kasra-backend' });
    assert.deepEqual(body('CreateBucket'), { globalAlias: 'kasra-media' });
    assert.deepEqual(body('AllowBucketKey'), { bucketId: 'b1', accessKeyId: settings.accessKeyId,
      permissions: { read: true, write: true, owner: false } });
  });

  it('changes nothing when everything is already in place (it runs at every start)', async t => {
    const calls = fakeGarage(t, { role: true, key: true, bucket: true, grant: true });
    assert.deepEqual(await setupGarage(settings), []);
    assert.deepEqual(calls.map(call => call.path.split('?')[0]), ['GetClusterStatus', 'GetKeyInfo', 'GetBucketInfo']);
  });

  it('waits for Garage to start, and stops at once on a wrong admin token', async t => {
    let refusals = 2;
    const calls = fakeGarage(t, { role: true, key: true, bucket: true, grant: true });
    const real = globalThis.fetch;
    t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
      if (refusals-- > 0) throw new TypeError('fetch failed');
      return real(url, init);
    });
    assert.equal((await waitForGarage(settings, 5, 1)).layoutVersion, 1);
    assert.equal(calls.length, 1);

    fakeGarage(t, { role: true, key: true, bucket: true, grant: true }, 'another-token');
    await assert.rejects(waitForGarage(settings, 5, 1), /GARAGE_ADMIN_TOKEN is not the token Garage runs with/);
  });

  it('needs settings Garage accepts, and says how to make them', () => {
    const env = { GARAGE_ADMIN_URL: settings.adminUrl, GARAGE_ADMIN_TOKEN: settings.adminToken, S3_BUCKET: settings.bucket,
      S3_ACCESS_KEY_ID: settings.accessKeyId, S3_SECRET_ACCESS_KEY: settings.secretAccessKey };
    assert.deepEqual(garageSettingsFromEnv(env), settings);
    for (const [key, value, message] of [['GARAGE_ADMIN_URL', 'storage:3903', /GARAGE_ADMIN_URL/],
      ['GARAGE_ADMIN_TOKEN', 'short', /openssl rand -hex 32/], ['S3_BUCKET', 'Kasra Media', /S3_BUCKET/],
      ['S3_ACCESS_KEY_ID', 'AKIAEXAMPLE', /GK \+ 24 hex/], ['S3_SECRET_ACCESS_KEY', 'replace-me', /64 hex/]] as const)
      assert.throws(() => garageSettingsFromEnv({ ...env, [key]: value }), message, key);
  });
});
