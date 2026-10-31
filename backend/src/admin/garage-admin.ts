/** Setup of the single-node Garage object storage (https://garagehq.deuxfleurs.fr) through its admin API v2, run by
 * the one-shot `storage-init` Compose service at every start. Each step checks first, so running it again changes
 * nothing. Only Garage needs this: an external S3 provider is set up in its own console. */
export type GarageSettings = {
  adminUrl: string; adminToken: string; bucket: string; accessKeyId: string; secretAccessKey: string;
};

// Garage only imports keys in its own format: "GK" + 24 hex characters, and a 64-character hex secret.
const KEY_ID = /^GK[0-9a-f]{24}$/;
const SECRET = /^[0-9a-f]{64}$/;

export function garageSettingsFromEnv(env: NodeJS.ProcessEnv = process.env): GarageSettings {
  const settings = { adminUrl: env.GARAGE_ADMIN_URL ?? '', adminToken: env.GARAGE_ADMIN_TOKEN ?? '', bucket: env.S3_BUCKET ?? '',
    accessKeyId: env.S3_ACCESS_KEY_ID ?? '', secretAccessKey: env.S3_SECRET_ACCESS_KEY ?? '' };
  if (!/^https?:\/\//.test(settings.adminUrl)) throw new Error('Set GARAGE_ADMIN_URL, e.g. http://storage:3903');
  if (settings.adminToken.length < 32) throw new Error('Set GARAGE_ADMIN_TOKEN to a random secret (openssl rand -hex 32)');
  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(settings.bucket)) throw new Error('Set S3_BUCKET to a bucket name such as kasra-media');
  if (!KEY_ID.test(settings.accessKeyId)) throw new Error('S3_ACCESS_KEY_ID must be GK + 24 hex characters (GK$(openssl rand -hex 12))');
  if (!SECRET.test(settings.secretAccessKey)) throw new Error('S3_SECRET_ACCESS_KEY must be 64 hex characters (openssl rand -hex 32)');
  return settings;
}

class GarageError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

function client(settings: GarageSettings) {
  return async <T>(path: string, body?: unknown): Promise<T> => {
    const response = await fetch(settings.adminUrl.replace(/\/+$/, '') + '/v2/' + path, {
      method: body === undefined ? 'GET' : 'POST', signal: AbortSignal.timeout(10_000),
      headers: { Authorization: 'Bearer ' + settings.adminToken, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const text = await response.text();
    // Error bodies name the problem (NoSuchBucket…); they never contain the token or the secret key.
    if (!response.ok) throw new GarageError(response.status, path.split('?')[0] + ': ' + response.status + ' ' + text.slice(0, 200));
    return (text ? JSON.parse(text) : {}) as T;
  };
}

type ClusterStatus = { layoutVersion: number; nodes: { id: string; role: unknown; dataPartition?: { available: number } }[] };

/** Waits until the Garage node answers its admin API (it starts in a second, but Compose starts both together). */
export async function waitForGarage(settings: GarageSettings, attempts = 30, delayMs = 2000) {
  const call = client(settings);
  for (let attempt = 1; ; attempt++) {
    try { return await call<ClusterStatus>('GetClusterStatus'); }
    catch (error) {
      if (error instanceof GarageError && error.status === 403) throw new Error('GARAGE_ADMIN_TOKEN is not the token Garage runs with');
      if (attempt >= attempts) throw error;
      await new Promise(done => setTimeout(done, delayMs));
    }
  }
}

/** Gives the node its storage role, creates the API's key and the bucket, and lets the key read and write it.
 * Returns the steps that changed something (empty when everything was already in place). */
export async function setupGarage(settings: GarageSettings, status?: ClusterStatus): Promise<string[]> {
  const call = client(settings);
  const changed: string[] = [];
  const cluster = status ?? await call<ClusterStatus>('GetClusterStatus');
  const node = cluster.nodes[0];
  if (!node) throw new Error('Garage reports no node');
  if (!node.role) {
    // A single node holds every partition, so its capacity only has to be positive; the free space is a natural value.
    const capacity = Math.max(node.dataPartition?.available ?? 0, 1e9);
    await call('UpdateClusterLayout', { roles: [{ id: node.id, zone: 'kasra', capacity, tags: [] }] });
    await call('ApplyClusterLayout', { version: cluster.layoutVersion + 1 });
    changed.push('layout');
  }

  const missing = (error: unknown) => error instanceof GarageError && error.status === 404;
  try { await call('GetKeyInfo?id=' + settings.accessKeyId); }
  catch (error) {
    if (!missing(error)) throw error;
    await call('ImportKey', { accessKeyId: settings.accessKeyId, secretAccessKey: settings.secretAccessKey, name: 'kasra-backend' });
    changed.push('key');
  }

  let bucket: { id: string; keys: { accessKeyId: string; permissions: { read: boolean; write: boolean } }[] };
  try { bucket = await call('GetBucketInfo?globalAlias=' + encodeURIComponent(settings.bucket)); }
  catch (error) {
    if (!missing(error)) throw error;
    bucket = { ...await call<{ id: string }>('CreateBucket', { globalAlias: settings.bucket }), keys: [] };
    changed.push('bucket');
  }
  const grant = bucket.keys.find(key => key.accessKeyId === settings.accessKeyId)?.permissions;
  if (!grant?.read || !grant.write) {
    await call('AllowBucketKey', { bucketId: bucket.id, accessKeyId: settings.accessKeyId,
      permissions: { read: true, write: true, owner: false } });
    changed.push('grant');
  }
  return changed;
}
