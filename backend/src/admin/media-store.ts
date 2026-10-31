import { mkdir, open, readFile, readdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { AwsClient } from 'aws4fetch';
import { recompressStored } from './image-compress';

/** Uploaded product photos: `<uuid>.<extension>`, addressed by the storefront as /api/media/<name>. */
export const MEDIA_FILE = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(png|jpg|webp)$/;
export const MEDIA_TYPE: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' };
const TIMEOUT_MS = 8000;
/** How long a read waits for the bucket before using the local copy. The storefront's /api/media proxy gives the API
 * 8 s, so a bucket that stalls (rather than refusing) must leave time for the local copy and the answer. */
export const READ_TIMEOUT_MS = 2500;

export type BucketConfig = { endpoint: string; bucket: string; region: string; accessKeyId: string; secretAccessKey: string };

/** The S3 bucket from S3_* settings (the Garage container in Compose, or later an external provider), or null when the
 * API runs without one (plain `npm run dev`, unit tests): photos are then kept in MEDIA_DIR only. */
export function bucketFromEnv(env: NodeJS.ProcessEnv = process.env): BucketConfig | null {
  const { S3_ENDPOINT: endpoint, S3_BUCKET: bucket, S3_ACCESS_KEY_ID: accessKeyId, S3_SECRET_ACCESS_KEY: secretAccessKey } = env;
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null;
  return { endpoint: endpoint.replace(/\/+$/, ''), bucket, region: env.S3_REGION || 'garage', accessKeyId, secretAccessKey };
}

export const mediaDirectory = (env: NodeJS.ProcessEnv = process.env) => resolve(env.MEDIA_DIR ?? join(process.cwd(), 'uploads'));

export class StorageUnavailable extends Error {}

/** Photos live in the object storage bucket. While the bucket is on this server, every photo is also written to
 * MEDIA_DIR: the nightly backup archives that folder, an older release (rollback) reads it, and it answers when the
 * bucket does not. Without a bucket, MEDIA_DIR is the only store. */
export class MediaStore {
  private readonly client: AwsClient | null;
  private readonly readTimeoutMs: number;
  constructor(readonly bucket: BucketConfig | null, readonly directory: string,
              { readTimeoutMs = READ_TIMEOUT_MS }: { readTimeoutMs?: number } = {}) {
    this.readTimeoutMs = readTimeoutMs;
    // One quick retry of a 5xx answer (aws4fetch's default backs off ten times, up to a minute): an admin waits for
    // the upload, and a visitor's photo is read from the local copy instead.
    this.client = bucket && new AwsClient({ accessKeyId: bucket.accessKeyId, secretAccessKey: bucket.secretAccessKey,
      service: 's3', region: bucket.region, retries: 1 });
  }

  static fromEnv(env: NodeJS.ProcessEnv = process.env) { return new MediaStore(bucketFromEnv(env), mediaDirectory(env)); }

  private url(name = '') { return this.bucket!.endpoint + '/' + encodeURIComponent(this.bucket!.bucket) + '/' + name; }

  private async s3(url: string, init: RequestInit = {}, timeoutMs = TIMEOUT_MS) {
    return this.client!.fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  }

  /** Stores a new photo under a fresh name; never overwrites one. Throws StorageUnavailable when the bucket refuses. */
  async put(name: string, bytes: Buffer) {
    const extension = MEDIA_FILE.exec(name)?.[2];
    if (!extension) throw new Error('not a media file name: ' + name);
    await mkdir(this.directory, { recursive: true });
    const file = join(this.directory, name);
    const fd = await open(file, 'wx', 0o600);
    try { await fd.writeFile(bytes); } finally { await fd.close(); }
    if (!this.client) return;
    try { await this.upload(name, bytes); }
    catch (error) {
      // No orphan copy for a photo the admin was told did not upload.
      await rm(file, { force: true });
      throw error;
    }
  }

  private async upload(name: string, bytes: Buffer) {
    const response = await this.s3(this.url(name), { method: 'PUT', body: new Uint8Array(bytes), headers: {
      'Content-Type': MEDIA_TYPE[MEDIA_FILE.exec(name)![2]], 'Cache-Control': 'public,max-age=31536000,immutable' } })
      .catch(() => null);
    if (!response?.ok) throw new StorageUnavailable('object storage refused ' + name + ': ' + (response?.status ?? 'unreachable'));
  }

  /** The photo's bytes from the bucket, else from MEDIA_DIR; null when neither has it. */
  async get(name: string): Promise<Buffer | null> {
    if (this.client) {
      try {
        // The deadline covers the body too: a transfer that stalls halfway also falls back to the local copy.
        const response = await this.s3(this.url(name), {}, this.readTimeoutMs);
        if (response.ok) return Buffer.from(await response.arrayBuffer());
      } catch { /* unreachable, refused or too slow: the local copy answers */ }
    }
    try { return await readFile(join(this.directory, name)); }
    catch (error) {
      if ((error as { code?: string }).code === 'ENOENT') return null;
      throw error;
    }
  }

  /** Every object name in the bucket (ListObjectsV2, 1000 per page). */
  async listBucket(): Promise<Set<string>> {
    const names = new Set<string>();
    let token = '';
    do {
      const response = await this.s3(this.url('?list-type=2' + (token ? '&continuation-token=' + encodeURIComponent(token) : '')));
      if (!response.ok) throw new StorageUnavailable('cannot list the bucket: ' + response.status);
      const xml = await response.text();
      for (const [, key] of xml.matchAll(/<Key>([^<]+)<\/Key>/g)) names.add(key);
      token = /<IsTruncated>true<\/IsTruncated>/.test(xml) ? (/<NextContinuationToken>([^<]+)</.exec(xml)?.[1] ?? '') : '';
    } while (token);
    return names;
  }

  /** Copies the photos of MEDIA_DIR that the bucket lacks into it: once when the bucket is introduced, and after a
   * media backup was restored into the folder. Photos stored before uploads were compressed are compressed on the
   * way, in their own format, so their addresses stay valid. */
  async syncToBucket(): Promise<{ copied: number; savedBytes: number }> {
    if (!this.client) return { copied: 0, savedBytes: 0 };
    const present = await this.listBucket();
    let names: string[] = [];
    try { names = (await readdir(this.directory)).filter(name => MEDIA_FILE.test(name) && !present.has(name)); }
    catch (error) { if ((error as { code?: string }).code !== 'ENOENT') throw error; }
    let savedBytes = 0;
    for (const name of names) {
      const original = await readFile(join(this.directory, name));
      const compressed = await recompressStored(original, MEDIA_FILE.exec(name)![2] as 'jpg' | 'png' | 'webp')
        .catch(() => original);
      await this.upload(name, compressed);
      savedBytes += original.length - compressed.length;
    }
    return { copied: names.length, savedBytes };
  }
}
