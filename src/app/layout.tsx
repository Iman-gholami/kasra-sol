import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { ShopProvider } from '@/components/shop-provider';
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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl">
      <body className={estedad.variable}>
        <ShopProvider>
          <div className="site-shell">
            <Header />
            <main id="main-content">{children}</main>
            <Footer />
          </div>
        </ShopProvider>
      </body>
    </html>
  );
}
