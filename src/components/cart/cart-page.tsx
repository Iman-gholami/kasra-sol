'use client';

import { useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Info, ShoppingBag, Trash2, Undo2 } from 'lucide-react';
import { categories } from '@/data/facets';
import { LineDetails } from '@/components/cart/line-details';
import { useCartLines } from '@/components/cart/use-cart-lines';
import { QuantityStepper } from '@/components/ui/quantity-stepper';
import { formatNumber, toman } from '@/lib/format';

/** Cart contents. The page heading is server-rendered; until the browser store is read this renders a
 * viewport-tall skeleton with the same structure, so nothing visible shifts when lines appear. */
export function CartPage() {
  const { hydrated, rows, lines, subtotal, savings, units, remove, undo, updateQuantity } = useCartLines();
  const list = useRef<HTMLDivElement>(null);
  const focusIn = (selector: string) => requestAnimationFrame(() => list.current?.querySelector<HTMLElement>(selector)?.focus());

  if (!hydrated) return <CartSkeleton/>;
  if (!rows.length) return <div className="empty-state cart-empty">
    <ShoppingBag size={34} strokeWidth={1.4} aria-hidden="true"/>
    <h2>سبدت هنوز خالیه</h2>
    <p>لباسی که دوستش داری رو پیدا کن؛ رنگ و سایزش رو انتخاب کن و به سبد اضافه‌اش کن.</p>
    <div className="empty-actions">
      <Link className="btn btn-primary" href="/shop">مشاهده محصولات <ArrowLeft size={18} aria-hidden="true"/></Link>
      {categories.map(category => <Link key={category.slug} className="chip" href={'/category/' + category.slug}>{category.title}</Link>)}
    </div>
  </div>;

  return <>
    <p className="cart-summary-line" aria-live="polite">{formatNumber(lines.length)} مدل، {formatNumber(units)} کالا در سبد نمایشی</p>
    <div className="cart-layout">
      <div className="cart-lines" ref={list}>
        <ul>
          {rows.map(row => row.kind === 'line'
            ? <li key={row.key} className="cart-item" data-line={row.key}>
              <Link className="cart-img" href={'/product/' + row.product.slug} tabIndex={-1} aria-hidden="true">
                <Image src={row.product.images[0]} alt="" fill sizes="(max-width: 600px) 96px, 120px"/>
              </Link>
              <div className="cart-item-main">
                <h2 className="cart-item-title"><Link href={'/product/' + row.product.slug}>{row.product.name}</Link></h2>
                <LineDetails item={row.item} product={row.product}/>
                <p className="cart-unit">هر عدد <span className="price">{toman(row.product.price)}</span></p>
                <QuantityStepper value={row.item.quantity} max={row.stock} itemLabel={row.product.name} size="lg"
                  onChange={value => updateQuantity(row.item, value)}/>
              </div>
              <div className="cart-price">
                <strong className="price">{toman(row.product.price * row.item.quantity)}</strong>
                <button type="button" className="link-button cart-remove" aria-label={'حذف ' + row.product.name + ' از سبد'}
                  onClick={() => { remove(row.item); focusIn('[data-undo="' + CSS.escape(row.key) + '"]'); }}>
                  <Trash2 size={17} aria-hidden="true"/> حذف
                </button>
              </div>
            </li>
            : <li key={row.key} className="cart-removed">
              <span>«<span dir="auto">{row.product.name}</span>» از سبد حذف شد.</span>
              <button type="button" className="link-button" data-undo={row.key}
                onClick={() => { undo(row.item); focusIn('[data-line="' + CSS.escape(row.key) + '"] .cart-item-title a'); }}>
                <Undo2 size={16} aria-hidden="true"/> بازگرداندن
              </button>
            </li>)}
        </ul>
        <p className="notice"><Info size={18} aria-hidden="true"/><span>قیمت‌ها و موجودی‌ها نمونه‌اند و به سرور فروشگاه متصل نیستند.</span></p>
        <Link className="text-link" href="/shop">ادامه خرید <ArrowLeft size={18} aria-hidden="true"/></Link>
      </div>
      {lines.length > 0 && <aside className="summary-card" aria-labelledby="cart-summary-title">
        <h2 id="cart-summary-title">خلاصه سفارش نمایشی</h2>
        <dl>
          <div className="summary-row"><dt>جمع اقلام ({formatNumber(units)} کالا)</dt><dd className="price">{toman(subtotal)}</dd></div>
          {savings > 0 && <div className="summary-row"><dt>صرفه‌جویی نمونه</dt><dd className="price">{toman(savings)}</dd></div>}
          <div className="summary-row"><dt>هزینه ارسال</dt><dd>هنوز محاسبه نشده</dd></div>
          <div className="summary-row total"><dt>مبلغ اقلام (بدون ارسال)</dt><dd className="price">{toman(subtotal)}</dd></div>
        </dl>
        <Link href="/checkout" className="btn btn-primary btn-block btn-lg summary-cta">ادامه تا تسویه‌حساب نمایشی <ArrowLeft size={18} aria-hidden="true"/></Link>
        <p>پرداخت واقعی و ثبت سفارش انجام نمی‌شود.</p>
      </aside>}
    </div>
    {lines.length > 0 && <div className="task-bar cart-task-bar">
      <div className="task-bar-total"><span>جمع اقلام</span><strong className="price">{toman(subtotal)}</strong></div>
      <Link href="/checkout" className="btn btn-primary">ادامه تا تسویه‌حساب <ArrowLeft size={18} aria-hidden="true"/></Link>
    </div>}
  </>;
}

function CartSkeleton() {
  return <div className="cart-layout cart-skeleton" role="status" aria-label="در حال بارگذاری سبد خرید">
    <div>
      {[0, 1].map(i => <div key={i} className="cart-item" aria-hidden="true">
        <span className="skeleton cart-img"/>
        <div className="skeleton-lines"><span className="skeleton"/><span className="skeleton"/><span className="skeleton"/></div>
      </div>)}
    </div>
    <span className="skeleton summary-skeleton" aria-hidden="true"/>
  </div>;
}
