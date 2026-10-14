import { formatNumber } from '@/lib/format';

/** Toman price with proportional Persian digits (tabular figures pad the "٬" separator in Estedad). */
export function Price({ price, compareAt, size = 'md' }: { price: number; compareAt?: number; size?: 'md' | 'lg' }) {
  return <div className={'price-line' + (size === 'lg' ? ' price-line-lg' : '')}>
    <strong className="price">{formatNumber(price)}{' '}<span className="currency">تومان</span></strong>
    {compareAt && compareAt > price && <del className="price">
      <span className="sr-only">قیمت پیشین: </span>{formatNumber(compareAt)}{' '}<span className="currency">تومان</span>
    </del>}
  </div>;
}
