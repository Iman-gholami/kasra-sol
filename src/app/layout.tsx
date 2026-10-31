import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { ShopProvider } from '@/components/shop-provider';
import { AddedToCart } from '@/components/cart/added-to-cart';
import { BottomNav } from '@/components/layout/bottom-nav';
import { SiteShell } from '@/components/layout/site-shell';
import { StoreChrome } from '@/components/layout/store-chrome';
import { PageViewBeacon } from '@/components/layout/page-view-beacon';
import { ToastProvider } from '@/components/ui/toast';
import { robotsMeta, siteUrl } from '@/lib/seo';
import './globals.css';

// The Persian subset (derived from the verified upstream file, see src/fonts/README.md) is 40 KB lighter, which
// matters on phones: the font is preloaded and shares the first seconds of bandwidth with the LCP image.
const estedad = localFont({
  src: '../fonts/Estedad-VF-fa.woff2',
  variable: '--font-estedad',
  weight: '100 900',
  style: 'normal',
  display: 'swap',
  preload: true
});

export async function generateMetadata(): Promise<Metadata> {
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: 'کسری بوتیک | استایل هر روزت', template: '%s | کسری بوتیک' },
    description: 'مجموعه‌ای نمایشی از شومیز، مانتو و تیشرت زنانه؛ طراحی مینیمال و خرید آسان.',
    applicationName: 'Kasra Boutique',
    // The launch switch (src/lib/seo.ts); robots.txt follows the same one. Private pages stay noindex on their own.
    robots: robotsMeta()
  };
}

// `viewport-fit=cover` makes env(safe-area-inset-*) real on notched phones; bars pad themselves with it.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#FFFFFF'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // The font variable lives on <html> so :root tokens (--font-sans) can resolve it. The data attribute
    // lets Next.js switch off CSS smooth scrolling during route changes (new pages start at the top and
    // Back restores the exact position instead of animating).
    <html lang="fa" dir="rtl" className={estedad.variable} data-scroll-behavior="smooth">
      <body>
        <ShopProvider>
          <ToastProvider>
            <SiteShell>
              <StoreChrome><Header /></StoreChrome>
              <main id="main-content" tabIndex={-1}>{children}</main>
              <StoreChrome><Footer /></StoreChrome>
            </SiteShell>
            <StoreChrome><BottomNav /><AddedToCart /><PageViewBeacon /></StoreChrome>
          </ToastProvider>
        </ShopProvider>
      </body>
    </html>
  );
}
