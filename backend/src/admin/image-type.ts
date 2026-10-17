export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

/** Image type from the file signature (magic bytes), never from the name or the claimed MIME type. */
export function detectImage(bytes: Buffer): 'png' | 'jpg' | 'webp' | null {
  if (bytes.length > MAX_IMAGE_BYTES || bytes.length < 16) return null;
  if (bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'png';
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'jpg';
  if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}
