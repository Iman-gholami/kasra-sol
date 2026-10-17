import Link from 'next/link';
import { Info } from 'lucide-react';
import { ProductGallery } from '@/components/products/product-gallery';
import { PurchasePanel } from '@/components/products/purchase-panel';
import { Price } from '@/components/products/price';
import { discountPercent, formatPercent } from '@/lib/format';
import type { Product } from '@/types/store';

/** Server-rendered product page body. Only the gallery and the purchase panel hydrate.
 * Desktop: gallery + details on one side, a sticky buy column on the other. Phone: one column. */
export function ProductDetail({ product }: { product: Product }) {
  const discount = discountPercent(product.price, product.compareAt);
  return <div className="detail-layout pdp">
    <ProductGallery images={product.images} name={product.name}/>
    <div className="pdp-buy detail-copy">
      <h1>{product.name}</h1>
      <div className="detail-price">
        <Price price={product.price} compareAt={product.compareAt} size="lg"/>
        {discount > 0 && <span className="sale-badge">{formatPercent(discount)} تخفیف</span>}
      </div>
      <PurchasePanel product={product}/>
    </div>
    <div className="pdp-details detail-extras">
      <h2 className="pdp-details-title">درباره این مدل</h2>
      <p className="detail-desc">{product.description}</p>
      <details className="accordion" open>
        <summary>جنس، فرم و نگهداری</summary>
        <div className="accordion-body">
          <dl className="spec-list">
            <div><dt>جنس (نمونه)</dt><dd>{product.material}</dd></div>
            <div><dt>فرم (نمونه)</dt><dd>{product.fit}</dd></div>
            <div><dt>نگهداری</dt><dd>{product.care}</dd></div>
          </dl>
        </div>
      </details>
      <details className="accordion">
        <summary>ارسال و بازگشت</summary>
        <div className="accordion-body">
          <p>شرایط قطعی ارسال و بازگشت هنوز تعیین نشده‌اند و در این نسخه هزینه یا زمان تحویلی وعده داده نمی‌شود.</p>
          <Link className="text-link" href="/shipping-and-returns">توضیحات نمونه ارسال و بازگشت</Link>
        </div>
      </details>
      {process.env.NEXT_PUBLIC_BACKEND_ENABLED !== 'true' && <p className="notice demo-inline-note"><Info size={18} aria-hidden="true"/>
        <span>عکس‌های مدل با هوش مصنوعی ساخته شده‌اند و ممکن است با رنگ و جزئیات این کالا یکسان نباشند؛ قیمت‌ها هم نمایشی‌اند.</span></p>}
    </div>
  </div>;
}
