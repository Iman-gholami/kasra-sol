import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { ShopProvider } from '@/components/shop-provider';
import { MiniCart } from '@/components/cart/mini-cart';
import { BottomNav } from '@/components/layout/bottom-nav';
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
  themeColor: '#faf8f5'
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
            <div className="site-shell">
              <Header />
              <main id="main-content" tabIndex={-1}>{children}</main>
              <Footer />
            </div>
            <BottomNav />
            <MiniCart />
          </ToastProvider>
        </ShopProvider>
      </body>
    </html>
  );
}
