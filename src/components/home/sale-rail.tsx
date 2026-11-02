import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Price } from '@/components/products/price';
import { SaleRailArrows } from '@/components/home/sale-rail-arrows';
import { formatNumber, formatPercent } from '@/lib/format';
import type { SaleRail as SaleRailData } from '@/lib/sale-rail';

const SALE_HREF = '/shop?sale=1';
const TRACK_ID = 'sale-rail-track';
// A card is about two fifths of the column (clamp in home.css), so at most ~190px wide on any screen.
const cardSizes = '(max-width: 480px) 40vw, 190px';

/** The home page's sale rail: a Kasra-red panel that scrolls sideways. It opens with its own tile (the title, a garment
 * hang tag naming the biggest discount, the count and «مشاهده همه»), then one white card per discounted model and a
 * closing «مشاهده همه» tile. Server-rendered; only the arrows (shown to mouse users) hydrate. */
export function SaleRail({ rail }: { rail: SaleRailData }) {
  return <section className="container section-block sale-rail" aria-labelledby="sale-title">
    <div className="sale-rail-panel">
      <div className="sale-rail-track" id={TRACK_ID}>
        <div className="sale-rail-intro">
          <h2 id="sale-title">تخفیف‌های ویژه</h2>
          <p className="sale-rail-tag">
            <svg viewBox="0 0 64 92" aria-hidden="true" focusable="false">
              <path className="sale-rail-tag-string" d="M32 0 C 24 8, 26 18, 32 25"/>
              <path className="sale-rail-tag-body" fillRule="evenodd"
                d="M29 12.6a5 5 0 0 1 6 0l17.6 13.3A6 6 0 0 1 55 30.7V84a6 6 0 0 1-6 6H15a6 6 0 0 1-6-6V30.7a6 6 0 0 1 2.4-4.8z M32 22.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7z"/>
            </svg>
            <span className="sale-rail-tag-text"><small>تا</small> <strong>{formatPercent(rail.maxPercent)}</strong><span className="sr-only"> تخفیف</span></span>
          </p>
          <p className="sale-rail-lede">{formatNumber(rail.total)} مدل با قیمت کمتر</p>
          <Link className="sale-rail-all" href={SALE_HREF}>مشاهده همه <ArrowLeft size={16} aria-hidden="true"/></Link>
        </div>
        <ul className="sale-rail-list">
          {rail.items.map(item => <li key={item.id}>
            <Link className="sale-card" href={'/product/' + item.slug}>
              <span className="sale-card-photo">
                <Image src={item.image} alt="" fill sizes={cardSizes}/>
                <span className="sale-card-badge">{formatPercent(item.percent)} تخفیف</span>
              </span>
              <h3 className="sale-card-name">{item.name}</h3>
              <Price price={item.price} compareAt={item.compareAt}/>
            </Link>
          </li>)}
          <li>
            <Link className="sale-rail-more" href={SALE_HREF}>
              <span className="sale-rail-more-icon"><ArrowLeft size={22} aria-hidden="true"/></span>
              <span>مشاهده همه</span>
              <small>{formatNumber(rail.total)} مدل</small>
            </Link>
          </li>
        </ul>
      </div>
      <SaleRailArrows trackId={TRACK_ID}/>
    </div>
  </section>;
}
