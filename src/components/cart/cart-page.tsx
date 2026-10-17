'use client';

import { useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Heart, ShoppingBag, Trash2, Undo2 } from 'lucide-react';
import { categories } from '@/data/facets';
import { LineDetails } from '@/components/cart/line-details';
import { useCartLines } from '@/components/cart/use-cart-lines';
import { FreeShippingMeter } from '@/components/cart/free-shipping-meter';
import { Breakdown } from '@/components/checkout/order-summary';
import { QuantityStepper } from '@/components/ui/quantity-stepper';
import { useBottomBar } from '@/components/ui/document-flags';
import { freeShippingProgress, shippingMethods } from '@/lib/checkout';
import { formatNumber, toman } from '@/lib/format';

const cheapestShipping = Math.min(...shippingMethods.map(method => method.price));
const LOW_STOCK = 3;

/** Cart contents. The page heading is server-rendered; until the browser store is read this renders a
 * viewport-tall skeleton with the same structure, so nothing visible shifts when lines appear. */
export function CartPage() {
  const { hydrated, rows, lines, subtotal, original, savings, units, remove, undo, updateQuantity } = useCartLines();
  const list = useRef<HTMLDivElement>(null);
  useBottomBar('cart', hydrated && lines.length > 0);
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

  const freeShipping = freeShippingProgress(subtotal).reached;

  return <>
    <p className="cart-summary-line" aria-live="polite">{formatNumber(lines.length)} مدل، {formatNumber(units)} کالا در سبد خرید</p>
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
                {row.item.quantity >= row.stock
                  ? <p className="cart-stock-note">همه موجودی این رنگ و سایز در سبد توست.</p>
                  : row.stock <= LOW_STOCK && <p className="cart-stock-note">از این رنگ و سایز {formatNumber(row.stock)} عدد موجود است.</p>}
              </div>
              <div className="cart-price">
                <strong className="price">{toman(row.product.price * row.item.quantity)}</strong>
                <div className="cart-line-actions">
                  <button type="button" className="link-button cart-save" aria-label={'ذخیره برای بعد، ' + row.product.name}
                    onClick={() => { remove(row.item, true); focusIn('[data-undo="' + CSS.escape(row.key) + '"]'); }}>
                    <Heart size={17} aria-hidden="true"/> ذخیره برای بعد
                  </button>
                  <button type="button" className="link-button cart-remove" aria-label={'حذف ' + row.product.name + ' از سبد'}
                    onClick={() => { remove(row.item); focusIn('[data-undo="' + CSS.escape(row.key) + '"]'); }}>
                    <Trash2 size={17} aria-hidden="true"/> حذف
                  </button>
                </div>
              </div>
            </li>
            : <li key={row.key} className="cart-removed">
              <p>«<span dir="auto">{row.product.name}</span>» {row.moved
                ? <>به <Link href="/wishlist" className="subtle-link">علاقه‌مندی‌ها</Link> منتقل شد.</>
                : 'از سبد حذف شد.'}</p>
              <button type="button" className="link-button" data-undo={row.key}
                onClick={() => { undo(row.item); focusIn('[data-line="' + CSS.escape(row.key) + '"] .cart-item-title a'); }}>
                <Undo2 size={16} aria-hidden="true"/> بازگرداندن
              </button>
            </li>)}
        </ul>
        <Link className="text-link" href="/shop">ادامه خرید <ArrowLeft size={18} aria-hidden="true"/></Link>
      </div>
      {lines.length > 0 && <aside className="summary-card" aria-labelledby="cart-summary-title">
        <h2 id="cart-summary-title">خلاصه سفارش</h2>
        <FreeShippingMeter subtotal={subtotal}/>
        <Breakdown totals={{ units, original, savings }} total={subtotal} totalLabel="جمع سبد خرید"
          shipping={{ value: freeShipping ? 'رایگان با پست پیشتاز' : 'از ' + toman(cheapestShipping) + '، در مرحله بعد' }}/>
        <Link href="/checkout" className="btn btn-primary btn-block btn-lg summary-cta">ثبت سفارش <ArrowLeft size={18} aria-hidden="true"/></Link>
        <p>روش ارسال، روش پرداخت و کد تخفیف را در مرحله بعد انتخاب می‌کنی.</p>
      </aside>}
    </div>
    {lines.length > 0 && <div className="task-bar cart-task-bar">
      <div className="task-bar-total"><span>جمع سبد خرید</span><strong className="price">{toman(subtotal)}</strong></div>
      <Link href="/checkout" className="btn btn-primary">ثبت سفارش <ArrowLeft size={18} aria-hidden="true"/></Link>
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
