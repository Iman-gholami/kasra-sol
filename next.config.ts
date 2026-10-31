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
  images: { unoptimized: true },
  // Link-preview fetchers (Telegram, Bale, WhatsApp, Eitaa, Rubika…) and plain HTTP clients get the page's metadata in
  // <head>; Next.js would otherwise stream it into <body> for any agent missing from its built-in bot list (which lacks
  // the Iranian messengers), and many previewers read only <head>. Browsers keep the streamed page.
  htmlLimitedBots: /bot|crawl|spider|slurp|preview|scrap|fetch|facebookexternalhit|whatsapp|telegram|bale|eitaa|rubika|soroush|igap|okhttp|go-http-client|java\/|python|curl|wget|axios|node|undici|dart|http/i,
  // Written into the code at build time, also where pages are rendered per request (Next.js leaves NEXT_PUBLIC_*
  // variables to the runtime environment on the server): the address and the search-engine switch are the build's,
  // so robots.txt and every page agree (src/lib/seo.ts).
  env: {
    KASRA_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? '',
    KASRA_SITE_INDEXABLE: process.env.NEXT_PUBLIC_SITE_INDEXABLE === 'true' ? 'true' : 'false'
  }
};

export default config;
