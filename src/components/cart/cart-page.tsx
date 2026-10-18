'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Heart, Info, ShoppingBag, Trash2, Undo2 } from 'lucide-react';
import { categories } from '@/data/facets';
import { LineDetails } from '@/components/cart/line-details';
import { useCartLines } from '@/components/cart/use-cart-lines';
import { FreeShippingMeter } from '@/components/cart/free-shipping-meter';
import { Breakdown } from '@/components/checkout/order-summary';
import { DiscountField } from '@/components/checkout/discount-field';
import { FlowSteps } from '@/components/checkout/flow-chrome';
import { loadDraft, saveCode } from '@/components/checkout/checkout-storage';
import { QuantityStepper } from '@/components/ui/quantity-stepper';
import { useBottomBar } from '@/components/ui/document-flags';
import { applyDiscount, freeShippingProgress, shippingMethods } from '@/lib/checkout';
import { formatNumber, toman } from '@/lib/format';

const cheapestShipping = Math.min(...shippingMethods.map(method => method.price));
const LOW_STOCK = 3;

/** Cart contents, laid out as step one of the purchase flow: steps, free-shipping progress, compact lines,
 * the discount code, the summary and one large call to action. The page heading is server-rendered; until
 * the browser store is read this renders a viewport-tall skeleton, so nothing visible shifts. */
export function CartPage() {
  const { hydrated, catalogError, rows, lines, subtotal, original, savings, units, remove, undo, updateQuantity } = useCartLines();
  // The code lives in the checkout draft (sessionStorage). Only read on the client: before the store
  // hydrates this component renders the skeleton, so the value never reaches the server markup.
  const [code, setCode] = useState(() => loadDraft().code);
  const [ctaVisible, setCtaVisible] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const cta = useRef<HTMLAnchorElement>(null);
  const hasLines = hydrated && lines.length > 0;
  useBottomBar('cart', hasLines);
  const focusIn = (selector: string) => requestAnimationFrame(() => list.current?.querySelector<HTMLElement>(selector)?.focus());

  // Phones get a floating total + action bar only while the large button under the summary is off-screen.
  useEffect(() => {
    const button = cta.current;
    if (!hasLines || !button || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setCtaVisible(entry.isIntersecting), { threshold: 0.6 });
    observer.observe(button);
    return () => observer.disconnect();
  }, [hasLines]);

  if (!hydrated) return <CartSkeleton/>;
  if (catalogError) return <div className="empty-state" role="alert">اطلاعات به‌روز محصولات در دسترس نیست. سبد خرید محفوظ است؛ صفحه را تازه کنید.</div>;
  if (!rows.length) return <div className="empty-state cart-empty">
    <ShoppingBag size={34} strokeWidth={1.4} aria-hidden="true"/>
    <h2>سبدت هنوز خالیه</h2>
    <p>لباسی که دوستش داری رو پیدا کن؛ رنگ و سایزش رو انتخاب کن و به سبد اضافه‌اش کن.</p>
    <div className="empty-actions">
      <Link className="btn btn-primary" href="/shop">مشاهده محصولات <ArrowLeft size={18} aria-hidden="true"/></Link>
      {categories.map(category => <Link key={category.slug} className="chip" href={'/category/' + category.slug}>{category.title}</Link>)}
    </div>
  </div>;

  const discount = code ? applyDiscount(code, subtotal) : null;
  const discountAmount = discount?.ok ? discount.amount : 0;
  const total = subtotal - discountAmount;
  const freeShipping = freeShippingProgress(subtotal).reached;
  const changeCode = (next: string) => { setCode(next); saveCode(next); };

  return <>
    {lines.length > 0 && <FlowSteps current={1}/>}
    {lines.length > 0 && <FreeShippingMeter subtotal={subtotal}/>}
    <p className="cart-summary-line" aria-live="polite">{formatNumber(lines.length)} مدل، {formatNumber(units)} کالا در سبد خرید</p>
    <div className="cart-layout">
      <div className="cart-lines" ref={list}>
        <ul>
          {rows.map(row => row.kind === 'line'
            ? <li key={row.key} className="cart-item" data-line={row.key}>
              <Link className="cart-img" href={'/product/' + row.product.slug} tabIndex={-1} aria-hidden="true">
                <Image src={row.product.images[0]} alt="" fill sizes="(max-width: 600px) 80px, 120px"/>
              </Link>
              <div className="cart-item-main">
                <h2 className="cart-item-title"><Link href={'/product/' + row.product.slug}>{row.product.name}</Link></h2>
                <LineDetails item={row.item} product={row.product}/>
                <p className="cart-unit">
                  <span>قیمت واحد:</span>
                  {row.product.compareAt && row.product.compareAt > row.product.price && <del className="price">
                    <span className="sr-only">قیمت پیشین: </span>{toman(row.product.compareAt)}
                  </del>}
                  <strong className="price">{toman(row.product.price)}</strong>
                </p>
                {row.item.quantity >= row.stock
                  ? <p className="cart-stock-note">همه موجودی این رنگ و سایز در سبد توست.</p>
                  : row.stock <= LOW_STOCK && <p className="cart-stock-note">از این رنگ و سایز {formatNumber(row.stock)} عدد موجود است.</p>}
              </div>
              <div className="cart-item-controls">
                <span className="cart-qty-label" aria-hidden="true">تعداد:</span>
                <QuantityStepper value={row.item.quantity} max={row.stock} itemLabel={row.product.name}
                  onChange={value => updateQuantity(row.item, value)}/>
                {row.item.quantity > 1 && <span className="cart-line-total">جمع: <strong className="price">{toman(row.product.price * row.item.quantity)}</strong></span>}
                <div className="cart-line-actions">
                  <button type="button" className="icon-button cart-save" aria-label={'ذخیره برای بعد، ' + row.product.name}
                    onClick={() => { remove(row.item, true); focusIn('[data-undo="' + CSS.escape(row.key) + '"]'); }}>
                    <Heart size={20} aria-hidden="true"/>
                  </button>
                  <button type="button" className="icon-button cart-remove" aria-label={'حذف ' + row.product.name + ' از سبد'}
                    onClick={() => { remove(row.item); focusIn('[data-undo="' + CSS.escape(row.key) + '"]'); }}>
                    <Trash2 size={20} aria-hidden="true"/>
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
        <Link className="text-link cart-continue" href="/shop">ادامه خرید <ArrowLeft size={18} aria-hidden="true"/></Link>
      </div>
      {lines.length > 0 && <aside className="cart-aside" aria-labelledby="cart-summary-title">
        <DiscountField applied={code} subtotal={subtotal} onChange={changeCode}/>
        <div className="summary-card">
          <h2 id="cart-summary-title">خلاصه سفارش</h2>
          <Breakdown totals={{ units, original, savings, discount: discountAmount }} code={code} total={total} totalLabel="جمع سبد خرید"
            shipping={{ value: freeShipping ? 'رایگان با پست پیشتاز' : 'از ' + toman(cheapestShipping) + '، در مرحله بعد' }}/>
        </div>
        <Link ref={cta} href="/checkout" className="btn btn-primary btn-block btn-lg summary-cta">ادامه فرایند خرید <ArrowLeft size={18} aria-hidden="true"/></Link>
        <p className="cart-reserve-note"><Info size={15} aria-hidden="true"/>
          <span>افزودن به سبد، کالا را برایت رزرو نمی‌کند؛ موجودی تا ثبت سفارش ممکن است تغییر کند.</span></p>
      </aside>}
    </div>
    {lines.length > 0 && <div className={'task-bar cart-task-bar' + (ctaVisible ? ' is-hidden' : '')} aria-hidden={ctaVisible} inert={ctaVisible}>
      <div className="task-bar-total"><span>جمع سبد خرید</span><strong className="price">{toman(total)}</strong></div>
      <Link href="/checkout" className="btn btn-primary">ادامه فرایند خرید <ArrowLeft size={18} aria-hidden="true"/></Link>
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
