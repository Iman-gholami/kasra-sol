import Image from 'next/image';
import Link from 'next/link';
import { formatNumber, formatPercent } from '@/lib/format';
import type { LastPiece } from '@/lib/last-pieces';

// About two fifths of the column (home.css), so at most ~200px wide on any screen.
const cardSizes = '(max-width: 480px) 44vw, 200px';

/** One last piece: the photo with its pill on the bottom edge, the name, the colour and size left, and its price
 * (struck original when lowered). Opens the product with this colour and size chosen. */
export function LastPieceCard({ piece }: { piece: LastPiece }) {
  const struck = piece.offer.compareAt !== undefined && piece.offer.compareAt > piece.offer.price;
  return <Link className="last-piece-card" href={piece.href}>
    <span className="last-piece-photo">
      <Image src={piece.image} alt="" fill sizes={cardSizes}/>
      <span className="last-piece-pill">{piece.percent > 0 ? formatPercent(piece.percent) + ' تخفیف' : 'فقط ۱ دونه'}</span>
    </span>
    <span className="last-piece-name">{piece.name}</span>
    <span className="last-piece-variant">
      <span className="last-piece-swatch" style={{ backgroundColor: piece.color.hex }} aria-hidden="true"/>
      {piece.color.name}، سایز {piece.size}
    </span>
    <span className="last-piece-price">
      {struck && <del><span className="sr-only">قیمت پیشین: </span>{formatNumber(piece.offer.compareAt!)} تومان</del>}
      <strong>{formatNumber(piece.offer.price)} تومان</strong>
    </span>
  </Link>;
}
