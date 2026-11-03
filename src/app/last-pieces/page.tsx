import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { LastPieceCard } from '@/components/home/last-piece-card';
import { getCatalogProducts } from '@/lib/backend-products';
import { getLastPieces } from '@/lib/last-pieces';
import { formatNumber } from '@/lib/format';
import { pageMetadata, SITE_NAME } from '@/lib/seo';

const DESCRIPTION = 'از هر کدوم فقط یکی مونده؛ مال کسیه که زودتر برسه.';
export const metadata: Metadata = { title: 'آخرین دونه‌ها',
  ...pageMetadata({ path: '/last-pieces', title: 'آخرین دونه‌ها | ' + SITE_NAME, description: DESCRIPTION }) };
export const dynamic = 'force-dynamic';

/** «مشاهده همه» of the home page's «آخرین دونه‌ها»: every colour and size with one unit left, as the same cards. */
export default async function LastPiecesPage() {
  const { items, total } = getLastPieces(await getCatalogProducts());
  return <div className="container last-pieces-page">
    <Breadcrumbs items={[{ label: 'خانه', href: '/' }, { label: 'آخرین دونه‌ها' }]}/>
    <div className="last-pieces-page-heading">
      <h1>آخرین دونه‌ها</h1>
      <p>{DESCRIPTION}</p>
      {total > 0 && <p className="last-pieces-count">{formatNumber(total)} دونه</p>}
    </div>
    {items.length > 0
      ? <ul className="last-pieces-grid">{items.map(piece => <li key={piece.key}><LastPieceCard piece={piece}/></li>)}</ul>
      : <div className="empty-state">
        <h2>الان هیچ رنگ و سایزی تک‌دونه نیست.</h2>
        <Link className="btn btn-primary" href="/shop">دیدن همه محصولات <ArrowLeft size={18} aria-hidden="true"/></Link>
      </div>}
  </div>;
}
