// The `storage-init` Compose service: prepares the Garage object storage (skipped when GARAGE_ADMIN_URL is empty, i.e.
// the bucket is at an external provider), then copies photos that are only in MEDIA_DIR into the bucket: all of them
// the first time, the restored ones after a media restore. Exits when done.
import { garageSettingsFromEnv, setupGarage, waitForGarage } from './garage-admin';
import { MediaStore } from './media-store';

if (process.env.GARAGE_ADMIN_URL) {
  const settings = garageSettingsFromEnv();
  const changed = await setupGarage(settings, await waitForGarage(settings));
  console.log(changed.length ? 'Object storage prepared: ' + changed.join(', ') : 'Object storage already prepared');
}

const store = MediaStore.fromEnv();
if (!store.bucket) throw new Error('Set S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY');
const { copied, savedBytes } = await store.syncToBucket();
console.log(copied ? 'Copied ' + copied + ' photo(s) from ' + store.directory + ' into the bucket, ' +
  Math.round(savedBytes / 1024) + ' KB smaller after compression' : 'Every photo of ' + store.directory + ' is in the bucket');
