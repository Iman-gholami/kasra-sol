import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Price } from '@/components/products/price';
import { LastPiecesArrows } from '@/components/home/last-pieces-arrows';
import { formatNumber } from '@/lib/format';
import type { LastPieces as LastPiecesData } from '@/lib/last-pieces';

const ALL_HREF = '/shop?last=1';
const TRACK_ID = 'last-pieces-track';
// A card is about two fifths of the column (clamp in home.css), so at most ~190px wide on any screen.
const cardSizes = '(max-width: 480px) 40vw, 190px';

/** The home page's «آخرین دونه‌ها»: a Kasra-red panel that scrolls sideways, one card per model down to its very last
 * piece. It opens with its own tile (the title, a hanger with a «۱ دونه» tag, the line and «مشاهده همه»); each card
 * names the colour and size that is left; a closing tile opens them all in the shop. Server-rendered; only the arrows
 * (shown to mouse users) hydrate. */
export function LastPieces({ rail }: { rail: LastPiecesData }) {
  return <section className="container section-block last-pieces" aria-labelledby="last-title">
    <div className="last-pieces-panel">
      <div className="last-pieces-track" id={TRACK_ID}>
        <div className="last-pieces-intro">
          <h2 id="last-title">آخرین دونه‌ها</h2>
          {/* The last piece on the rack: a hanger with one tag. The line below says the same in words. */}
          <div className="last-pieces-icon" aria-hidden="true">
            <svg className="last-pieces-hanger" viewBox="0 0 72 32" focusable="false">
              <path d="M31.5 7a4.5 4.5 0 1 1 4.5 4.5v4M36 15.5L68 30H4Z"/>
            </svg>
            <div className="last-pieces-tag">
              <svg viewBox="0 0 64 92" focusable="false">
                <path className="last-pieces-tag-string" d="M32 0 C 25 8, 27 18, 32 25"/>
                <path className="last-pieces-tag-body" fillRule="evenodd"
                  d="M29 12.6a5 5 0 0 1 6 0l17.6 13.3A6 6 0 0 1 55 30.7V84a6 6 0 0 1-6 6H15a6 6 0 0 1-6-6V30.7a6 6 0 0 1 2.4-4.8z M32 22.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7z"/>
              </svg>
              <span className="last-pieces-tag-text"><strong>۱</strong> <small>دونه</small></span>
            </div>
          </div>
          <p className="last-pieces-lede">از هر کدوم فقط یکی مونده؛ مال کسیه که زودتر برسه.</p>
          <Link className="last-pieces-all" href={ALL_HREF}>مشاهده همه <ArrowLeft size={16} aria-hidden="true"/></Link>
        </div>
        <ul className="last-pieces-list">
          {rail.items.map(item => <li key={item.id}>
            <Link className="last-card" href={'/product/' + item.slug}>
              <span className="last-card-photo">
                <Image src={item.image} alt="" fill sizes={cardSizes}/>
                <span className="last-card-badge">فقط ۱ دونه</span>
              </span>
              <h3 className="last-card-name">{item.name}</h3>
              <p className="last-card-piece">
                <span className="last-card-swatch" style={{ backgroundColor: item.color.hex }} aria-hidden="true"/>
                {item.color.name}، سایز {item.size}
              </p>
              <Price price={item.price} compareAt={item.compareAt}/>
            </Link>
          </li>)}
          <li>
            <Link className="last-pieces-more" href={ALL_HREF}>
              <span className="last-pieces-more-icon"><ArrowLeft size={22} aria-hidden="true"/></span>
              <span>مشاهده همه</span>
              <small>{formatNumber(rail.total)} مدل</small>
            </Link>
          </li>
        </ul>
      </div>
      <LastPiecesArrows trackId={TRACK_ID}/>
    </div>
  </section>;
}
