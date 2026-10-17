import { mkdir, open, readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join, resolve } from 'node:path';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Permission } from './permissions';

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const PATH = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(png|jpg|webp)$/;
const mime: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' };
const directory = () => resolve(process.env.MEDIA_DIR ?? join(process.cwd(), 'uploads'));

export function detectImage(bytes: Buffer): 'png' | 'jpg' | 'webp' | null {
  if (bytes.length > MAX_IMAGE_BYTES || bytes.length < 16) return null;
  if (bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'png';
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'jpg';
  if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}
export async function mediaRoutes(app: FastifyInstance, check:
  (req: FastifyRequest, reply: FastifyReply, permission: Permission) => Promise<{id:string}|null>) {
  // Parse only these three types as binary; all other content types remain rejected.
  for (const type of Object.values(mime)) {
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
    if (!extension || req.headers['content-type'] !== mime[extension])
      return reply.code(415).send({ error: 'invalid_image' });
    const filename = randomUUID() + '.' + extension;
    await mkdir(directory(), { recursive: true });
    const fd = await open(join(directory(), filename), 'wx', 0o600);
    try { await fd.writeFile(body); } finally { await fd.close(); }
    await app.log.info({ actor: actor.id, filename }, 'Product image uploaded');
    return reply.code(201).header('Cache-Control', 'no-store')
      .send({ url: '/api/media/' + filename });
  });

  app.get('/v1/media/:file', { config: { rateLimit: false } }, async (req, reply) => {
    const name = (req.params as { file: string }).file;
    const match = PATH.exec(name);
    if (!match) return reply.code(404).send({ error: 'not_found' });
    let bytes: Buffer;
    try { bytes = await readFile(join(directory(), name)); }
    catch (error) {
      if ((error as {code?: string}).code === 'ENOENT') return reply.code(404).send({ error: 'not_found' });
      throw error;
    }
    return reply.type(mime[match[2]]).header('X-Content-Type-Options', 'nosniff')
      .header('Cache-Control', 'public,max-age=31536000,immutable')
      .header('Content-Security-Policy', "default-src 'none'; sandbox").send(bytes);
  });
}
