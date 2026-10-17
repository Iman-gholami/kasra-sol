import Image from 'next/image';
import type { ReactNode } from 'react';
import { LineDetails } from '@/components/cart/line-details';
import { formatNumber, toman } from '@/lib/format';
import type { Line } from '@/lib/checkout';

export function SummaryLines({ lines }: { lines: Line[] }) {
  return <ul className="checkout-lines">
    {lines.map(({ item, product }) => <li key={item.productId + ':' + item.colorId + ':' + item.size}>
      <span className="checkout-line-thumb"><Image src={product.images[0]} alt="" fill sizes="56px"/></span>
      <span className="checkout-line-name">{product.name}</span>
      <LineDetails item={item} product={product} showQuantity/>
      <strong className="price">{toman(item.quantity * product.price)}</strong>
    </li>)}
  </ul>;
}

/** Price rows shared by the cart, checkout and confirmation. Reductions are labelled and colored rather
 * than prefixed with a minus sign, which bidi reordering can move to the wrong side of Persian digits. */
export function Breakdown({ totals, code, shipping, total, totalLabel }: {
  totals: { units: number; original: number; savings: number; discount?: number };
  code?: string;
  shipping: { label?: string; value: ReactNode };
  total: number;
  totalLabel: string;
}) {
  return <dl className="price-rows">
    <div className="summary-row"><dt>قیمت کالاها ({formatNumber(totals.units)})</dt><dd className="price">{toman(totals.original)}</dd></div>
    {totals.savings > 0 && <div className="summary-row is-saving">
      <dt>سود تو از تخفیف کالاها</dt><dd className="price">{toman(totals.savings)}</dd>
    </div>}
    {Boolean(totals.discount) && <div className="summary-row is-saving">
      <dt>کد تخفیف {code && <bdi dir="ltr">{code}</bdi>}</dt><dd className="price">{toman(totals.discount!)}</dd>
    </div>}
    <div className="summary-row">
      <dt>هزینه ارسال{shipping.label && <small> ({shipping.label})</small>}</dt><dd>{shipping.value}</dd>
    </div>
    <div className="summary-row total"><dt>{totalLabel}</dt><dd className="price">{toman(total)}</dd></div>
  </dl>;
}
