import type { NextConfig } from 'next';

const config: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  allowedDevOrigins: ['192.168.114.227'],
  // next/image keeps its layout features (sizes, lazy loading, preload), but the files are served as stored instead
  // of being resized on every request by /_next/image, which is slow and CPU-hungry on a single VPS. Every photo is
  // already compressed: committed ones are checked by tests-unit/images.test.ts, uploads are re-encoded by the API
  // (backend/src/admin/image-compress.ts).
  images: { unoptimized: true }
};

export default config;
