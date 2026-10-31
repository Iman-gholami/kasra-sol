// Real Garage object storage + running API: uploads land in the bucket (with a local copy), photos are served from the
// bucket, and storage-init copies photos that only exist locally into it, compressed.
// Requires: API at API_BASE started with the S3_* settings and MEDIA_DIR, Garage prepared by dist/admin/storage-setup.js
// (see .github/workflows/backend-ci.yml), and DATABASE_URL for fixtures. Skipped without S3_ENDPOINT.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomBytes, randomUUID, scryptSync } from 'node:crypto';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { AwsClient } from 'aws4fetch';
import pg from 'pg';
import sharp from 'sharp';

const base = process.env.API_BASE ?? 'http://127.0.0.1:4000';
const env = process.env;
const enabled = Boolean(env.S3_ENDPOINT && env.MEDIA_DIR && env.DATABASE_URL);
const s3 = enabled && new AwsClient({ accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  service: 's3', region: env.S3_REGION || 'garage' });
const object = name => s3.fetch(env.S3_ENDPOINT + '/' + env.S3_BUCKET + '/' + name);
let pool, owner;
let clients = 0;
const nextIp = () => '10.88.' + Math.floor(++clients / 250) + '.' + (clients % 250 + 1);
const photo = (width, height, sigma = 6) => sharp({ create: { width, height, channels: 3, background: '#a08070',
  noise: { type: 'gaussian', mean: 128, sigma } } }).jpeg({ quality: 92 }).toBuffer();

describe('photos in the object storage', { skip: !enabled && 'set S3_ENDPOINT, MEDIA_DIR and DATABASE_URL' }, () => {
  before(async () => {
    pool = new pg.Pool({ connectionString: env.DATABASE_URL });
    const username = 'media_' + randomBytes(3).toString('hex'), password = randomBytes(18).toString('hex');
    const salt = randomBytes(16).toString('hex');
    await pool.query("INSERT INTO admin_users(username,display_name,password_hash,role) VALUES($1,'تست تصویر',$2,'owner')",
      [username, 'scrypt$' + salt + '$' + scryptSync(password, salt, 64).toString('hex')]);
    const session = await fetch(base + '/v1/admin/auth/login', { method: 'POST', body: JSON.stringify({ username, password }),
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': nextIp() } });
    assert.equal(session.status, 200);
    owner = (await session.json()).token;
  });
  after(async () => { await pool?.end(); });

  it('stores an upload in the bucket and in MEDIA_DIR, and serves it from the bucket', async () => {
    const original = await photo(2400, 3200);
    assert.ok(original.length < 2 * 1024 * 1024);
    const response = await fetch(base + '/v1/admin/media', { method: 'POST', body: original,
      headers: { 'Content-Type': 'image/jpeg', Authorization: 'Bearer ' + owner, 'X-Forwarded-For': nextIp() } });
    assert.equal(response.status, 201);
    const name = (await response.json()).url.split('/').at(-1);
    assert.match(name, /^[0-9a-f-]{36}\.webp$/);

    const stored = await object(name);
    assert.equal(stored.status, 200, 'the photo is in the bucket');
    const bytes = Buffer.from(await stored.arrayBuffer());
    const meta = await sharp(bytes).metadata();
    assert.deepEqual([meta.format, meta.width, meta.height], ['webp', 1200, 1600]);
    assert.deepEqual(await readFile(join(env.MEDIA_DIR, name)), bytes, 'the local copy is identical');

    // Without the local copy, the API still serves the photo: it reads the bucket.
    await rm(join(env.MEDIA_DIR, name));
    const served = await fetch(base + '/v1/media/' + name);
    assert.equal(served.status, 200);
    assert.equal(served.headers.get('content-type'), 'image/webp');
    assert.deepEqual(Buffer.from(await served.arrayBuffer()), bytes);
  });

  it('copies photos that are only in MEDIA_DIR into the bucket, compressed in their own format', async () => {
    const name = randomUUID() + '.jpg';
    const legacy = await photo(3000, 4000, 10);
    await writeFile(join(env.MEDIA_DIR, name), legacy);
    assert.equal((await object(name)).status, 404);

    const { stdout } = await promisify(execFile)('node', ['dist/admin/storage-setup.js'], { env });
    assert.match(stdout, /Object storage already prepared/);
    assert.match(stdout, /Copied 1 photo/);
    const copied = Buffer.from(await (await object(name)).arrayBuffer());
    const meta = await sharp(copied).metadata();
    assert.deepEqual([meta.format, meta.width, meta.height], ['jpeg', 1200, 1600]);
    assert.ok(copied.length < legacy.length / 4, copied.length + ' bytes from ' + legacy.length);
    assert.equal((await fetch(base + '/v1/media/' + name)).status, 200);
  });
});
