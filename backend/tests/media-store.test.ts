// Where uploaded photos live: the object storage bucket, with a local copy (MEDIA_DIR) that backups and rollbacks use.
// The bucket is a stand-in here (global fetch); backend/tests/integration/media.integration.mjs uses a real Garage.
import { describe, it, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { bucketFromEnv, MediaStore, StorageUnavailable } from '../src/admin/media-store';

const NAME = '0b6f3c7e-1d2a-4b5c-8d9e-0f1a2b3c4d5e.webp';
const OTHER = '1b6f3c7e-1d2a-4b5c-8d9e-0f1a2b3c4d5e.jpg';
const bucket = { endpoint: 'http://storage:3900', bucket: 'kasra-media', region: 'garage',
  accessKeyId: 'GK' + 'a'.repeat(24), secretAccessKey: 'b'.repeat(64) };
const folder = () => mkdtemp(join(tmpdir(), 'kasra-media-store-'));

type Call = { method: string; url: string; headers: Headers; body: Buffer };
/** A bucket in memory behind global fetch; `fail` makes it refuse (status) or be unreachable ('down'). */
function fakeBucket(t: TestContext, objects = new Map<string, Buffer>(), options: { fail?: number | 'down'; pageSize?: number } = {}) {
  const calls: Call[] = [];
  t.mock.method(globalThis, 'fetch', async (input: Request) => {
    const url = new URL(input.url);
    const call = { method: input.method, url: input.url, headers: input.headers, body: Buffer.from(await input.arrayBuffer()) };
    calls.push(call);
    if (options.fail === 'down') throw new TypeError('fetch failed');
    if (options.fail) return new Response('', { status: options.fail });
    const key = decodeURIComponent(url.pathname.split('/').slice(2).join('/'));
    if (call.method === 'PUT') { objects.set(key, call.body); return new Response(''); }
    if (url.searchParams.get('list-type') === '2') {
      const keys = [...objects.keys()].sort();
      const start = Number(url.searchParams.get('continuation-token') ?? 0), size = options.pageSize ?? 1000;
      const page = keys.slice(start, start + size), more = start + size < keys.length;
      return new Response('<ListBucketResult>' + page.map(k => '<Contents><Key>' + k + '</Key></Contents>').join('') +
        '<IsTruncated>' + more + '</IsTruncated>' + (more ? '<NextContinuationToken>' + (start + size) + '</NextContinuationToken>' : '') +
        '</ListBucketResult>');
    }
    const object = objects.get(key);
    return object ? new Response(new Uint8Array(object)) : new Response('', { status: 404 });
  });
  return { calls, objects };
}

describe('the S3 settings', () => {
  it('need an endpoint, a bucket and both key halves; anything less means no bucket', () => {
    const env = { S3_ENDPOINT: 'http://storage:3900/', S3_BUCKET: 'kasra-media', S3_ACCESS_KEY_ID: bucket.accessKeyId,
      S3_SECRET_ACCESS_KEY: bucket.secretAccessKey };
    assert.deepEqual(bucketFromEnv(env), { ...bucket, endpoint: 'http://storage:3900' });
    assert.equal(bucketFromEnv({ ...env, S3_REGION: 'ir-thr-at1' })?.region, 'ir-thr-at1');
    for (const key of Object.keys(env)) assert.equal(bucketFromEnv({ ...env, [key]: '' }), null, key);
  });
});

describe('without a bucket (local development)', () => {
  it('keeps photos in MEDIA_DIR, readable only by the API user, and never overwrites one', async () => {
    const store = new MediaStore(null, await folder());
    await store.put(NAME, Buffer.from('photo'));
    assert.equal((await stat(join(store.directory, NAME))).mode & 0o777, 0o600);
    assert.deepEqual(await store.get(NAME), Buffer.from('photo'));
    await assert.rejects(store.put(NAME, Buffer.from('other')));
    assert.equal(await store.get(OTHER), null);
    await assert.rejects(store.put('../escape.webp', Buffer.from('x')), /not a media file name/);
  });
});

describe('with the object storage bucket', () => {
  it('uploads each photo with an AWS signature and keeps a local copy', async t => {
    const { calls, objects } = fakeBucket(t);
    const store = new MediaStore(bucket, await folder());
    await store.put(NAME, Buffer.from('photo'));
    assert.equal(calls.length, 1);
    assert.equal(calls[0].method, 'PUT');
    assert.equal(calls[0].url, 'http://storage:3900/kasra-media/' + NAME);
    assert.match(calls[0].headers.get('authorization') ?? '', /^AWS4-HMAC-SHA256 Credential=GKa{24}\/\d{8}\/garage\/s3\/aws4_request/);
    assert.equal(calls[0].headers.get('content-type'), 'image/webp');
    assert.equal(calls[0].headers.get('cache-control'), 'public,max-age=31536000,immutable');
    assert.deepEqual(objects.get(NAME), Buffer.from('photo'));
    assert.deepEqual(await readFile(join(store.directory, NAME)), Buffer.from('photo'));
  });

  for (const fail of [503, 'down'] as const) {
    it('refuses an upload when the bucket is ' + (fail === 'down' ? 'unreachable' : 'failing') + ', leaving no local copy', async t => {
      fakeBucket(t, new Map(), { fail });
      const store = new MediaStore(bucket, await folder());
      await assert.rejects(store.put(NAME, Buffer.from('photo')), StorageUnavailable);
      assert.deepEqual(await readdir(store.directory), []);
    });
  }

  it('reads from the bucket first', async t => {
    fakeBucket(t, new Map([[NAME, Buffer.from('from the bucket')]]));
    const store = new MediaStore(bucket, await folder());
    await writeFile(join(store.directory, NAME), 'local copy');
    assert.deepEqual(await store.get(NAME), Buffer.from('from the bucket'));
  });

  for (const fail of [undefined, 500, 'down'] as const) {
    it('falls back to the local copy when the bucket ' + (fail === undefined ? 'lacks the photo' : 'fails (' + fail + ')'), async t => {
      fakeBucket(t, new Map(), { fail });
      const store = new MediaStore(bucket, await folder());
      await writeFile(join(store.directory, NAME), 'local copy');
      assert.deepEqual(await store.get(NAME), Buffer.from('local copy'));
      assert.equal(await store.get(OTHER), null);
    });
  }

  it('copies only the missing photos into the bucket, compressing old uploads in their own format', async t => {
    const legacy = await sharp({ create: { width: 2400, height: 3200, channels: 3, background: '#a08070',
      noise: { type: 'gaussian', mean: 128, sigma: 6 } } }).jpeg({ quality: 95 }).toBuffer();
    const { calls, objects } = fakeBucket(t, new Map([['a.webp', Buffer.from('x')], ['b.webp', Buffer.from('y')], [NAME, Buffer.from('z')]]),
      { pageSize: 2 });
    const store = new MediaStore(bucket, await folder());
    await writeFile(join(store.directory, NAME), 'already in the bucket');
    await writeFile(join(store.directory, OTHER), legacy);
    await writeFile(join(store.directory, 'notes.txt'), 'not a photo');

    const result = await store.syncToBucket();
    assert.equal(result.copied, 1);
    assert.ok(result.savedBytes > 0);
    assert.equal(calls.filter(call => call.method === 'GET').length, 2, 'the listing was read page by page');
    assert.deepEqual(calls.filter(call => call.method === 'PUT').map(call => call.url), ['http://storage:3900/kasra-media/' + OTHER]);
    const copied = await sharp(objects.get(OTHER)).metadata();
    assert.deepEqual([copied.format, copied.width, copied.height], ['jpeg', 1200, 1600]);
    assert.deepEqual(await readFile(join(store.directory, OTHER)), legacy, 'the local copy keeps the original');

    assert.deepEqual(await store.syncToBucket(), { copied: 0, savedBytes: 0 }, 'a second run has nothing to do');
  });

  it('does nothing to sync without a bucket', async () => {
    assert.deepEqual(await new MediaStore(null, await folder()).syncToBucket(), { copied: 0, savedBytes: 0 });
  });
});
