'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ShoppingBag, X } from 'lucide-react';
import { toman, formatNumber } from '@/lib/format';
import { byId, getVariant } from '@/data/products';
import type { CartItem } from '@/types/store';

type Snapshot = { cart: CartItem[]; wishlist: string[]; hydrated: boolean };
const EMPTY: Snapshot = { cart: [], wishlist: [], hydrated: false };
const KEY = 'kasra-demo-v1';
let current: Snapshot = EMPTY;
let initialized = false;
const listeners = new Set<() => void>();
const itemKey = (item: CartItem) => item.productId + ':' + item.colorId + ':' + item.size;

function notify(next: Snapshot) {
  current = next;
  listeners.forEach((listener) => listener());
  if (next.hydrated && typeof window !== 'undefined') {
    try { localStorage.setItem(KEY, JSON.stringify({ cart: next.cart, wishlist: next.wishlist })); }
    catch { /* local demo continues in memory */ }
  }
}
function sanitize(value: unknown): Snapshot {
  if (!value || typeof value !== 'object') return { ...EMPTY, hydrated: true };
  const record = value as { cart?: unknown; wishlist?: unknown };
  const cart = Array.isArray(record.cart) ? record.cart.filter((item): item is CartItem => {
    if (!item || typeof item !== 'object') return false;
    const candidate = item as CartItem;
    const product = byId(candidate.productId);
    const stock = product && getVariant(product, candidate.colorId, candidate.size)?.stock;
    return typeof candidate.quantity === 'number' && Number.isInteger(candidate.quantity)
      && candidate.quantity > 0 && Boolean(stock && stock > 0);
  }).map((item) => {
    const product = byId(item.productId)!;
    return { ...item, quantity: Math.min(item.quantity, getVariant(product, item.colorId, item.size)!.stock) };
  }) : [];
  const wishlist = Array.isArray(record.wishlist)
    ? record.wishlist.filter((id): id is string => typeof id === 'string' && Boolean(byId(id))) : [];
  return { cart, wishlist, hydrated: true };
}
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!initialized) {
    initialized = true;
    try { notify(sanitize(JSON.parse(localStorage.getItem(KEY) || '{}'))); }
    catch { notify({ ...EMPTY, hydrated: true }); }
  }
  return () => listeners.delete(listener);
}
const getSnapshot = () => current;
const getServerSnapshot = () => EMPTY;

function addToCart(incoming: CartItem): boolean {
  const product = byId(incoming.productId);
  const stock = product && getVariant(product, incoming.colorId, incoming.size)?.stock;
  if (!stock || !Number.isInteger(incoming.quantity) || incoming.quantity < 1) return false;
  const found = current.cart.find((item) => itemKey(item) === itemKey(incoming));
  const cart = found
    ? current.cart.map((item) => itemKey(item) === itemKey(incoming)
        ? { ...item, quantity: Math.min(stock, item.quantity + incoming.quantity) } : item)
    : [...current.cart, { ...incoming, quantity: Math.min(stock, incoming.quantity) }];
  notify({ ...current, cart });
  return true;
}
function updateQuantity(target: CartItem, quantity: number) {
  const cart = current.cart.map((item) => {
    if (itemKey(item) !== itemKey(target)) return item;
    const product = byId(item.productId);
    const stock = product && getVariant(product, item.colorId, item.size)?.stock || 0;
    return { ...item, quantity: Math.min(stock, Math.max(1, Math.floor(quantity))) };
  });
  notify({ ...current, cart });
}
function removeFromCart(target: CartItem) {
  notify({ ...current, cart: current.cart.filter((item) => itemKey(item) !== itemKey(target)) });
}
function clearCart() { notify({ ...current, cart: [] }); }
function toggleWishlist(id: string) {
  if (!byId(id)) return;
  const wishlist = current.wishlist.includes(id)
    ? current.wishlist.filter((value) => value !== id) : [...current.wishlist, id];
  notify({ ...current, wishlist });
}

type CartUI = { isCartOpen: boolean; openCart: () => void; closeCart: () => void };
const CartUIContext = createContext<CartUI | null>(null);

export function ShopProvider({ children }: { children: React.ReactNode }) {
  const [isCartOpen, setCartOpen] = useState(false);
  const previousFocus = useRef<HTMLElement | null>(null);
  const openCart = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) previousFocus.current = document.activeElement;
    setCartOpen(true);
  }, []);
  const closeCart = useCallback(() => {
    setCartOpen(false);
    // Wait for the native modal to close before returning keyboard focus.
    requestAnimationFrame(() => previousFocus.current?.focus());
  }, []);
  return <CartUIContext.Provider value={{ isCartOpen, openCart, closeCart }}>
    {children}
    <MiniCart />
  </CartUIContext.Provider>;
}

function MiniCart() {
  const { isCartOpen, closeCart } = useCartUI();
  const { cart, hydrated, removeFromCart } = useShop();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (isCartOpen && !node.open) node.showModal();
    if (!isCartOpen && node.open) node.close();
  }, [isCartOpen]);
  useEffect(() => {
    if (!isCartOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [isCartOpen]);
  const lines = cart.flatMap(item => {
    const product = byId(item.productId);
    return product ? [{ item, product }] : [];
  });
  const total = lines.reduce((sum, {item, product}) => sum + product.price * item.quantity, 0);
  function onDialogKey(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeCart();
    }
  }
  return <dialog ref={dialog} className="mini-cart-dialog" aria-label="سبد خرید سریع"
      onKeyDown={onDialogKey} onClose={closeCart}
      onClick={event => { if (event.target === dialog.current) closeCart(); }}>
    <div className="mini-cart-sheet">
      <div className="mini-cart-heading">
        <div><p className="eyebrow">YOUR SELECTION</p><h2>سبد خرید <span>({hydrated ? formatNumber(cart.length) : '۰'})</span></h2></div>
        <button type="button" className="icon-button" onClick={closeCart} aria-label="بستن سبد خرید"><X size={21}/></button>
      </div>
      <p className="mini-cart-demo">سبد نمایشی است؛ هزینه ارسال و پرداخت واقعی در این نسخه وجود ندارد.</p>
      <div className="mini-cart-items">
        {lines.length ? lines.map(({item,product}) => <article className="mini-cart-item" key={item.productId+':'+item.colorId+':'+item.size}>
          <Link href={'/product/'+product.slug} onClick={closeCart} className="mini-cart-thumb">
            <Image src={product.images[0]} alt={'عکس نمایشی '+product.name} fill sizes="80px" />
          </Link>
          <div className="mini-cart-item-info">
            <h3><Link href={'/product/'+product.slug} onClick={closeCart}>{product.name}</Link></h3>
            <p>{product.colors.find(c => c.id===item.colorId)?.name} · {item.size} · {formatNumber(item.quantity)} عدد</p>
            <strong>{toman(product.price*item.quantity)}</strong>
            <button type="button" className="link-button" onClick={()=>removeFromCart(item)}>حذف</button>
          </div>
        </article>) :
          <div className="mini-cart-empty"><ShoppingBag size={29} strokeWidth={1.5}/><p>سبدت هنوز خالیه.</p>
            <button type="button" className="btn btn-outline" onClick={closeCart}>ادامه دیدن لباس‌ها</button></div>}
      </div>
      {lines.length > 0 && <div className="mini-cart-footer">
        <div className="mini-cart-subtotal"><span>جمع اقلام، بدون ارسال</span><strong>{toman(total)}</strong></div>
        <Link href="/cart" className="btn btn-dark" onClick={closeCart}>بررسی سبد خرید</Link>
        <Link href="/checkout" className="mini-cart-checkout" onClick={closeCart}>ادامه تا تسویه‌حساب نمایشی ←</Link>
        <button type="button" className="mini-cart-continue" onClick={closeCart}>ادامه خرید</button>
      </div>}
    </div>
  </dialog>;
}
function useCartUI(): CartUI {
  const value = useContext(CartUIContext);
  if (!value) throw new Error('ShopProvider is missing');
  return value;
}

export function useShop() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const ui = useCartUI();
  return {
    ...snapshot,
    cartCount: snapshot.cart.reduce((sum, item) => sum + item.quantity, 0),
    addToCart, updateQuantity, removeFromCart, clearCart, toggleWishlist,
    ...ui
  };
}
