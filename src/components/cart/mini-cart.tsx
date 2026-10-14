'use client';

import { useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, ShoppingBag, Trash2, Undo2, X } from 'lucide-react';
import { useShop } from '@/components/shop-provider';
import { Sheet, useMountedOnce } from '@/components/ui/sheet';
import { LineDetails } from '@/components/cart/line-details';
import { useCartLines } from '@/components/cart/use-cart-lines';
import { formatNumber, toman } from '@/lib/format';

/** Quick cart drawer: opens from the cart icon's side (inline end), never blocks the page it came from. */
export function MiniCart() {
  const { isCartOpen, closeCart } = useShop();
  const mounted = useMountedOnce(isCartOpen);
  if (!mounted) return null;
  return <Sheet open={isCartOpen} onClose={closeCart} label="سبد خرید سریع" className="sheet-end mini-cart-dialog" swipe="end">
    <MiniCartContent onClose={closeCart}/>
  </Sheet>;
}

function MiniCartContent({ onClose }: { onClose: () => void }) {
  const { rows, lines, subtotal, units, remove, undo } = useCartLines();
  const list = useRef<HTMLDivElement>(null);
  const focusUndo = (key: string) => requestAnimationFrame(() =>
    list.current?.querySelector<HTMLElement>('[data-undo="' + CSS.escape(key) + '"]')?.focus());
  const focusLine = (key: string) => requestAnimationFrame(() =>
    list.current?.querySelector<HTMLElement>('[data-line="' + CSS.escape(key) + '"] a')?.focus());

  return <div className="sheet-inner mini-cart-sheet">
    <div className="sheet-header">
      <div>
        <h2 className="sheet-title">سبد خرید <span className="mini-cart-count">({formatNumber(units)} کالا)</span></h2>
        <p className="sheet-subtitle">سبد نمایشی است؛ هزینه ارسال و پرداخت واقعی وجود ندارد.</p>
      </div>
      <button type="button" className="icon-button" onClick={onClose} aria-label="بستن سبد خرید"><X size={22} aria-hidden="true"/></button>
    </div>
    <div className="sheet-body mini-cart-items" ref={list}>
      {rows.length ? <ul>
        {rows.map(row => row.kind === 'line'
          ? <li className="mini-cart-item" key={row.key} data-line={row.key}>
            <Link href={'/product/' + row.product.slug} onClick={onClose} className="mini-cart-thumb" tabIndex={-1} aria-hidden="true">
              <Image src={row.product.images[0]} alt="" fill sizes="80px"/>
            </Link>
            <div className="mini-cart-item-info">
              <h3><Link href={'/product/' + row.product.slug} onClick={onClose}>{row.product.name}</Link></h3>
              <LineDetails item={row.item} product={row.product} showQuantity/>
              <strong className="price">{toman(row.product.price * row.item.quantity)}</strong>
            </div>
            <button type="button" className="icon-button mini-cart-remove" aria-label={'حذف ' + row.product.name + ' از سبد'}
              onClick={() => { remove(row.item); focusUndo(row.key); }}><Trash2 size={19} aria-hidden="true"/></button>
          </li>
          : <li className="cart-removed" key={row.key}>
            <span><span dir="auto">{row.product.name}</span> از سبد حذف شد.</span>
            <button type="button" className="link-button" data-undo={row.key}
              onClick={() => { undo(row.item); focusLine(row.key); }}><Undo2 size={16} aria-hidden="true"/> بازگرداندن</button>
          </li>)}
      </ul> : <div className="mini-cart-empty">
        <ShoppingBag size={30} strokeWidth={1.5} aria-hidden="true"/>
        <p>سبدت هنوز خالیه.</p>
        <button type="button" className="btn btn-secondary" onClick={onClose}>ادامه دیدن لباس‌ها</button>
      </div>}
    </div>
    {lines.length > 0 && <div className="sheet-footer mini-cart-footer">
      <div className="mini-cart-subtotal"><span>جمع اقلام، بدون ارسال</span><strong className="price">{toman(subtotal)}</strong></div>
      <Link href="/cart" className="btn btn-primary btn-block" onClick={onClose}>بررسی سبد خرید</Link>
      <div className="mini-cart-secondary">
        <button type="button" className="link-button" onClick={onClose}>ادامه خرید</button>
        <Link href="/checkout" className="link-button" onClick={onClose}>ادامه تا تسویه‌حساب نمایشی <ArrowLeft size={16} aria-hidden="true"/></Link>
      </div>
    </div>}
  </div>;
}
