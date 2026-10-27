'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, Heart, Info, Ruler, ShoppingBag, X } from 'lucide-react';
import { getVariant } from '@/data/products';
import { useShop, registerShopProduct } from '@/components/shop-provider';
import { QuantityStepper } from '@/components/ui/quantity-stepper';
import { Sheet, useMountedOnce } from '@/components/ui/sheet';
import { useBottomBar } from '@/components/ui/document-flags';
import { formatNumber, toman } from '@/lib/format';
import { lineLimit, MAX_CART_LINES, MAX_LINE_QUANTITY } from '@/lib/checkout';
import type { Product } from '@/types/store';

type Notice = { text: string; error: boolean; cartLink?: boolean };

/** Buy box: color → size → quantity → add. On phones a compact bar keeps the action in the thumb
 * zone whenever the main button is off-screen; it never covers content (the page reserves its height). */
export function PurchasePanel({ product }: { product: Product }) {
  const { cart, addToCart, showAdded, wishlist, toggleWishlist, hydrated } = useShop();
  const [colorId, setColorId] = useState('');
  const [size, setSize] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [sizeNotice, setSizeNotice] = useState('');
  const [stickyVisible, setStickyVisible] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const guideMounted = useMountedOnce(guideOpen);
  const buyButton = useRef<HTMLButtonElement>(null);
  const stickyBar = useRef<HTMLDivElement>(null);
  const colorOptions = useRef<HTMLDivElement>(null);
  const sizeOptions = useRef<HTMLDivElement>(null);

  const color = product.colors.find(entry => entry.id === colorId);
  const variant = getVariant(product, colorId, size);
  const isFavorite = hydrated && wishlist.includes(product.id);
  // What can still be added: stock (up to what one order may hold) minus what this variant already has in the cart.
  const inCart = cart.find(item => item.productId === product.id && item.colorId === colorId && item.size === size)?.quantity ?? 0;
  const room = variant ? lineLimit(variant.stock) - inCart : 0;
  const ready = Boolean(colorId && size && room >= 1);
  const allInCart = Boolean(colorId && size && variant?.stock && room < 1);
  // Full because one order cannot hold more, not because the stock ran out.
  const atOrderLimit = Boolean(variant && variant.stock > MAX_LINE_QUANTITY && inCart >= MAX_LINE_QUANTITY);
  const fullText = atOrderLimit ? 'حداکثر تعداد مجاز در سبد خریدت' : 'همه موجودی در سبد خریدت';

  useBottomBar('pdp');
  useEffect(() => { registerShopProduct(product); }, [product]);

  // Reserve exactly the bar's height (it grows by one line while confirming an add) so it never covers content.
  useEffect(() => {
    const bar = stickyBar.current;
    if (!bar || typeof ResizeObserver === 'undefined') return;
    const root = document.documentElement;
    const observer = new ResizeObserver(() => {
      if (bar.offsetHeight) root.style.setProperty('--pdp-bar-h', bar.offsetHeight + 'px');
    });
    observer.observe(bar);
    return () => { observer.disconnect(); root.style.removeProperty('--pdp-bar-h'); };
  }, []);

  useEffect(() => {
    const button = buyButton.current;
    if (!button || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setStickyVisible(!entry.isIntersecting), { threshold: 0.45 });
    observer.observe(button);
    return () => observer.disconnect();
  }, []);

  function focusOption(which: 'color' | 'size') {
    const container = which === 'color' ? colorOptions.current : sizeOptions.current;
    const button = container?.querySelector<HTMLButtonElement>('button:not(:disabled)');
    container?.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    button?.focus({ preventScroll: true });
  }

  function chooseColor(id: string) {
    setColorId(id);
    const invalidated = Boolean(size && !getVariant(product, id, size)?.stock);
    if (invalidated) setSize('');
    setSizeNotice(invalidated ? 'سایز قبلی برای این رنگ ناموجود است؛ دوباره سایز انتخاب کن.' : '');
    setQuantity(1);
    setNotice(null);
  }

  function add() {
    if (!hydrated) { setNotice({ text: 'در حال دریافت اطلاعات سبد خرید…', error: true }); return; }
    if (!colorId || !size) {
      const missing = !colorId ? 'color' : 'size';
      setNotice({ text: missing === 'color' ? 'اول رنگ موردنظرت رو انتخاب کن.' : 'برای ادامه یک سایز موجود انتخاب کن.', error: true });
      focusOption(missing);
      return;
    }
    if (!variant?.stock) {
      setNotice({ text: 'این ترکیب ناموجود است؛ رنگ یا سایز دیگری انتخاب کن.', error: true });
      focusOption('size');
      return;
    }
    if (room < 1) {
      setNotice({ text: atOrderLimit
        ? 'از هر رنگ و سایز حداکثر ' + formatNumber(MAX_LINE_QUANTITY) + ' عدد در یک سفارش ثبت می‌شود و همین تعداد در سبد خریدت است.'
        : 'همه موجودی این رنگ و سایز (' + formatNumber(variant.stock) + ' عدد) در سبد خریدت است.', error: true, cartLink: true });
      return;
    }
    if (!inCart && cart.length >= MAX_CART_LINES) {
      setNotice({ text: 'هر سفارش حداکثر ' + formatNumber(MAX_CART_LINES) + ' کالای مختلف دارد؛ برای افزودن این کالا یکی از اقلام سبد خرید را حذف کن.',
        error: true, cartLink: true });
      return;
    }
    const item = { productId: product.id, colorId, size, quantity: Math.min(quantity, room) };
    if (!addToCart(item, product)) {
      setNotice({ text: 'افزودن به سبد خرید ممکن نیست.', error: true });
      return;
    }
    setNotice({ text: 'به سبد خرید اضافه شد.', error: false, cartLink: true });
    setQuantity(1);
    showAdded(item);
  }

  const summary = color ? color.name + (size ? '، سایز ' + size : '') : 'رنگ و سایز انتخاب نشده';
  const stickyLabel = ready ? 'افزودن به سبد خرید از نوار پایین' : allInCart ? fullText + ' از نوار پایین'
    : !colorId ? 'انتخاب رنگ و سایز از نوار پایین' : 'انتخاب سایز از نوار پایین';

  return <>
    <section className="buy-panel" aria-label="انتخاب مشخصات و خرید">
      <div className="variant-group">
        <div className="variant-label" id="pdp-color-label">رنگ <span className="variant-value">{color ? color.name : 'انتخاب کن'}</span></div>
        <div className="swatch-list" ref={colorOptions} role="group" aria-labelledby="pdp-color-label">
          {product.colors.map(entry => {
            const available = product.variants.some(v => v.colorId === entry.id && v.stock > 0);
            return <button key={entry.id} type="button" disabled={!available}
              className={'swatch' + (colorId === entry.id ? ' selected' : '') + (!available ? ' unavailable' : '')}
              aria-label={'رنگ ' + entry.name + (!available ? ' ناموجود' : '')} aria-pressed={colorId === entry.id}
              onClick={() => chooseColor(entry.id)}>
              <span className="swatch-color" style={{ backgroundColor: entry.hex }} aria-hidden="true"/>
              <small aria-hidden="true">{entry.name}</small>
            </button>;
          })}
        </div>
      </div>
      <div className="variant-group">
        <div className="variant-label">
          <span id="pdp-size-label">سایز <span className="variant-value">{size ? <span dir="ltr">{size}</span> : 'انتخاب کن'}</span></span>
        </div>
        <div className="size-list" dir="ltr" ref={sizeOptions} role="group" aria-labelledby="pdp-size-label">
          {product.sizes.map(entry => {
            const available = colorId ? Boolean(getVariant(product, colorId, entry)?.stock) : product.variants.some(v => v.size === entry && v.stock > 0);
            return <button key={entry} type="button" disabled={!available}
              className={'size-option' + (size === entry ? ' selected' : '')} aria-pressed={size === entry}
              aria-label={'سایز ' + entry + (available ? '' : ' ناموجود')}
              onClick={() => { setSize(entry); setSizeNotice(''); setQuantity(1); setNotice(null); }}>
              {entry}
            </button>;
          })}
        </div>
        {sizeNotice && <p className="pdp-size-notice" role="status"><Info size={16} aria-hidden="true"/>{sizeNotice}</p>}
      </div>
      <div className="quantity-row">
        <span className="variant-label">تعداد</span>
        <QuantityStepper value={quantity} max={Math.max(1, room)} onChange={value => setQuantity(Math.max(1, value))}/>
        {/* A word always separates the two numbers so they cannot read as one ("۳، ۱" → "۱،۳"). */}
        {variant?.stock ? <span className="stock-note">{process.env.NEXT_PUBLIC_BACKEND_ENABLED === 'true' ? 'موجودی:' : 'موجودی نمونه:'} {formatNumber(variant.stock)} عدد
          {inCart > 0 && '، ' + formatNumber(inCart) + ' عدد در سبد خریدت'}</span> : null}
      </div>
      {notice && <div role={notice.error ? 'alert' : 'status'} className={'status-message purchase-feedback' + (notice.error ? ' error' : '')}>
        {!notice.error && <Check size={18} aria-hidden="true"/>}
        <span>{notice.text}</span>
        {notice.cartLink && <span className="purchase-feedback-actions">
          <Link className="link-button" href="/cart">مشاهده سبد خرید</Link>
        </span>}
      </div>}
      <div className="purchase-row">
        <button type="button" className="size-guide-trigger" aria-label="راهنمای سایز"
          aria-haspopup="dialog" aria-expanded={guideOpen} onClick={() => setGuideOpen(true)}>
          <Ruler size={19} strokeWidth={1.8} aria-hidden="true"/>
          <span>راهنمای سایز</span>
        </button>
        <button ref={buyButton} type="button" className="btn btn-primary btn-dark btn-lg" onClick={add}>
          <ShoppingBag size={19} aria-hidden="true"/> {ready ? 'افزودن به سبد خرید' : allInCart ? fullText : 'رنگ و سایز رو انتخاب کن'}
        </button>
        <button type="button" className={'btn btn-secondary btn-lg pdp-wishlist' + (isFavorite ? ' is-liked' : '')}
          aria-label={isFavorite ? 'حذف از علاقه‌مندی‌ها' : 'افزودن به علاقه‌مندی‌ها'} aria-pressed={isFavorite}
          onClick={() => toggleWishlist(product.id)}>
          <Heart size={20} fill={isFavorite ? 'currentColor' : 'none'} aria-hidden="true"/>
        </button>
      </div>
      <p className="buy-panel-note"><Info size={15} aria-hidden="true"/> {process.env.NEXT_PUBLIC_BACKEND_ENABLED === 'true'
        ? 'موجودی ممکن است تغییر کند؛ قبل از ثبت سفارش دوباره بررسی می‌شود. درگاه پرداخت آنلاین هنوز فعال نیست.'
        : 'رنگ، سایز، موجودی و قیمت در این نسخه نمایشی‌اند و سفارشی ثبت نمی‌شود.'}</p>
    </section>

    {guideMounted && <Sheet open={guideOpen} onClose={() => setGuideOpen(false)} labelledBy="size-guide-title"
      className="sheet-center size-guide-dialog" swipe="down">
      <div className="sheet-inner">
        <div className="sheet-header" data-sheet-drag>
          <span className="sheet-handle" aria-hidden="true"/>
          <h2 className="sheet-title" id="size-guide-title">راهنمای سایز نمونه</h2>
          <button type="button" className="icon-button" aria-label="بستن راهنمای سایز" onClick={() => setGuideOpen(false)}><X size={22} aria-hidden="true"/></button>
        </div>
        <div className="sheet-body size-guide-body">
          <p>اندازه‌گیری اختصاصی این کالا هنوز ثبت نشده است؛ بدون جدول واقعی، پیشنهاد سایز قطعی نمی‌دهیم.</p>
          <p>برای انتخاب بهتر، دور سینه، کمر و باسن را با متر نرم و بدون کشیدن اندازه بگیر. پیش از خرید واقعی، این اعداد باید با اندازه‌های همین مدل مقایسه شوند.</p>
          <Link href="/size-guide" className="text-link" onClick={() => setGuideOpen(false)}>مطالعه راهنمای عمومی سایز</Link>
        </div>
      </div>
    </Sheet>}

    <div ref={stickyBar} className={'pdp-sticky-bar' + (stickyVisible ? ' is-visible' : '')} aria-hidden={!stickyVisible} inert={!stickyVisible}>
      {notice && !notice.error && <div className="pdp-sticky-confirm" role="status">
        <Check size={16} aria-hidden="true"/><span>به سبد خرید اضافه شد</span><Link href="/cart">مشاهده سبد خرید</Link>
      </div>}
      <div className="pdp-sticky-inner">
        <div className="pdp-sticky-price">
          <strong className="price">{toman(product.price)}</strong>
          <span className={color ? undefined : 'is-empty'}>{summary}</span>
        </div>
        <button type="button" className="btn btn-primary" onClick={add} aria-label={stickyLabel}>
          <ShoppingBag size={18} aria-hidden="true"/>{ready ? 'افزودن به سبد' : allInCart ? 'در سبد خریدت' : (!colorId ? 'انتخاب رنگ و سایز' : 'انتخاب سایز')}
        </button>
      </div>
    </div>
  </>;
}
