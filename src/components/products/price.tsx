import { formatNumber } from '@/lib/format';

/** Toman price with proportional Persian digits (tabular figures pad the "٬" separator in Estedad).
 * The struck previous price shows the number only: the current price already names the currency, and a
 * second, crossed-out «تومان» crowded narrow cards onto two lines. Screen readers still hear it. */
export function Price({ price, compareAt, size = 'md' }: { price: number; compareAt?: number; size?: 'md' | 'lg' }) {
  return <div className={'price-line' + (size === 'lg' ? ' price-line-lg' : '')}>
    <strong className="price">{formatNumber(price)}{' '}<span className="currency">تومان</span></strong>
    {compareAt && compareAt > price && <del className="price">
      <span className="sr-only">قیمت پیشین: </span>{formatNumber(compareAt)}<span className="sr-only"> تومان</span>
    </del>}
  </div>;
}
