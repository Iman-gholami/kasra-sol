import type { NextConfig } from 'next';

const config: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  // AVIF first: about a fifth smaller than WebP for the photographs; browsers without it still get WebP.
  images: { formats: ['image/avif', 'image/webp'] },
  allowedDevOrigins: ['192.168.114.227']
};

export default config;
