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
import './globals.css';

const estedad = localFont({
  src: '../fonts/Estedad-VF.woff2',
  variable: '--font-estedad',
  weight: '100 900',
  style: 'normal',
  display: 'swap',
  preload: true
});

// Display face for large editorial headings only (Persian subset, see src/fonts/README.md). Not preloaded: a
// preload from the root layout would fetch it on every route ahead of the LCP image; pages that set display text
// request it when they render it, and `swap` shows Estedad meanwhile. The layout metrics are overridden to Estedad's
// (ascent 102.5%, descent 50%), so swapping between the two moves nothing; the taller Amiri glyphs still paint in
// full. The Arial-based stand-in is off: Arial has no Persian glyphs.
const amiri = localFont({
  src: '../fonts/Amiri-Regular-fa.woff2',
  variable: '--font-amiri',
  weight: '400',
  style: 'normal',
  display: 'swap',
  preload: false,
  adjustFontFallback: false,
  declarations: [
    { prop: 'ascent-override', value: '102.5%' },
    { prop: 'descent-override', value: '50%' },
    { prop: 'line-gap-override', value: '0%' }
  ]
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: 'کسری بوتیک | استایل هر روزت', template: '%s | کسری بوتیک' },
  description: 'مجموعه‌ای نمایشی از شومیز، مانتو و تیشرت زنانه؛ طراحی مینیمال و خرید آسان.',
  applicationName: 'Kasra Boutique',
  robots: { index: false, follow: false }
};

// `viewport-fit=cover` makes env(safe-area-inset-*) real on notched phones; bars pad themselves with it.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f5f0e8'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // The font variables live on <html> so :root tokens (--font-sans, --font-display) can resolve them. The data attribute
    // lets Next.js switch off CSS smooth scrolling during route changes (new pages start at the top and
    // Back restores the exact position instead of animating).
    <html lang="fa" dir="rtl" className={estedad.variable + ' ' + amiri.variable} data-scroll-behavior="smooth">
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
