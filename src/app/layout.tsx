import type { Metadata } from 'next';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { ShopProvider } from '@/components/shop-provider';
import './globals.css';

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
      <body>
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
