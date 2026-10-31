import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Permission } from './permissions';
import { detectImage, MAX_IMAGE_BYTES } from './image-type';
import { compressUpload } from './image-compress';
import { MEDIA_FILE, MEDIA_TYPE, MediaStore, StorageUnavailable } from './media-store';
import { pool } from '../db/connection';
import { recordAudit } from './audit';

export async function mediaRoutes(app: FastifyInstance, check:
  (req: FastifyRequest, reply: FastifyReply, permission: Permission) => Promise<{id:string}|null>,
  store = MediaStore.fromEnv()) {
  // Parse only these three types as binary; all other content types remain rejected.
  for (const type of Object.values(MEDIA_TYPE)) {
    app.addContentTypeParser(type, { parseAs: 'buffer', bodyLimit: MAX_IMAGE_BYTES },
      (_req, body, done) => done(null, body));
  }

  app.post('/v1/admin/media', {
    bodyLimit: MAX_IMAGE_BYTES,
    config: { rateLimit: { max: 15, timeWindow: '1 minute' } }
  }, async (req, reply) => {
    const actor = await check(req, reply, 'products:write');
    if (!actor) return;
    const body = req.body;
    if (!Buffer.isBuffer(body)) return reply.code(415).send({ error: 'unsupported_media_type' });
    const extension = detectImage(body);
    if (!extension || req.headers['content-type'] !== MEDIA_TYPE[extension])
      return reply.code(415).send({ error: 'invalid_image' });
    // Stored resized and re-encoded: the storefront serves this file as it is (no image optimizer in front of it).
    let stored: Buffer;
    try { stored = await compressUpload(body); }
    catch { return reply.code(415).send({ error: 'invalid_image' }); }
    const filename = randomUUID() + '.webp';
    try { await store.put(filename, stored); }
    catch (error) {
      if (!(error instanceof StorageUnavailable)) throw error;
      app.log.error({ error: error.message }, 'Object storage unavailable; upload refused');
      return reply.code(503).send({ error: 'storage_unavailable' });
    }
    app.log.info({ actor: actor.id, filename }, 'Product image uploaded');
    await recordAudit(pool, actor.id, 'media.uploaded', filename,
      { bytes: body.length, storedBytes: stored.length, type: extension });
    return reply.code(201).header('Cache-Control', 'no-store')
      .send({ url: '/api/media/' + filename });
  });

  app.get('/v1/media/:file', { config: { rateLimit: false } }, async (req, reply) => {
    const name = (req.params as { file: string }).file;
    const match = MEDIA_FILE.exec(name);
    if (!match) return reply.code(404).send({ error: 'not_found' });
    const bytes = await store.get(name);
    if (!bytes) return reply.code(404).send({ error: 'not_found' });
    return reply.type(MEDIA_TYPE[match[2]]).header('X-Content-Type-Options', 'nosniff')
      .header('Cache-Control', 'public,max-age=31536000,immutable')
      .header('Content-Security-Policy', "default-src 'none'; sandbox").send(bytes);
  });
}
