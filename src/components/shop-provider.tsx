'use client';

import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore } from 'react';
import { byId, getVariant } from '@/data/products';
import { lineLimit, MAX_CART_LINES } from '@/lib/checkout';
import type { CartItem, Product } from '@/types/store';

type Snapshot = { cart: CartItem[]; wishlist: string[]; hydrated: boolean; catalogError: boolean };
const EMPTY: Snapshot = { cart: [], wishlist: [], hydrated: false, catalogError: false };
const KEY = 'kasra-demo-v1';
const backendEnabled = process.env.NEXT_PUBLIC_BACKEND_ENABLED === 'true';
let current: Snapshot = EMPTY;
let initialized = false;
const registry = new Map<string, Product>();
const listeners = new Set<() => void>();
const itemKey = (item: CartItem) => item.productId + ':' + item.colorId + ':' + item.size;

export function getShopProduct(id: string): Product | undefined {
  return registry.get(id) ?? byId(id);
}
function notify(next: Snapshot) {
  current = next;
  listeners.forEach(listener => listener());
  if (next.hydrated && !next.catalogError && typeof window !== 'undefined') {
    try { localStorage.setItem(KEY, JSON.stringify({ cart: next.cart, wishlist: next.wishlist })); }
    catch { /* private browsing still works in memory */ }
  }
}
function rawStore(value: unknown) {
  if (!value || typeof value !== 'object') return { cart: [] as CartItem[], wishlist: [] as string[] };
  const record = value as { cart?: unknown; wishlist?: unknown };
  const validId = (s: unknown): s is string => typeof s === 'string' &&
    /^[a-z0-9][a-z0-9-]{1,78}$/.test(s);
  const cart = Array.isArray(record.cart) ? record.cart.filter((item): item is CartItem => {
    if (!item || typeof item !== 'object') return false;
    const obj = item as CartItem;
    return validId(obj.productId) && typeof obj.colorId === 'string' && obj.colorId.length <= 80 &&
      typeof obj.size === 'string' && obj.size.length <= 20 &&
      Number.isInteger(obj.quantity) && obj.quantity > 0 && obj.quantity <= 1000000;
  }).slice(0, 80) : [];
  const wishlist = Array.isArray(record.wishlist) ? record.wishlist.filter(validId).slice(0, 80) : [];
  return { cart, wishlist: [...new Set(wishlist)] };
}
async function fetchProducts(ids: string[]): Promise<Product[]> {
  if (!ids.length) return [];
  const result = await fetch('/api/catalog/lookup?ids=' + encodeURIComponent([...new Set(ids)].join(',')), {
    cache: 'no-store'
  });
  if (!result.ok) throw new Error('catalog lookup unavailable');
  const data = await result.json() as { items: Product[] };
  return data.items;
}
export async function ensureShopProducts(ids: string[]) {
  if (!backendEnabled) return;
  const missing = [...new Set(ids)].filter(id => !registry.has(id));
  if (!missing.length) return;
  try {
    const received = await fetchProducts(missing);
    for (const item of received) registry.set(item.id, item);
    const available = new Set(received.map(item => item.id));
    // An archived or deleted product should no longer be shown as a perpetual wishlist spinner.
    notify({ ...current, wishlist: current.wishlist.filter(id => !missing.includes(id) || available.has(id)),
      catalogError: false });
  } catch {
    notify({ ...current, catalogError: true });
  }
}
export function registerShopProduct(product: Product) {
  if (registry.get(product.id) === product) return;
  registry.set(product.id, product);
  notify({ ...current });
}
function sanitizeCart(cart: CartItem[], wishlist: string[]) {
  const sanitized = cart.flatMap(item => {
    const product = backendEnabled ? registry.get(item.productId) : getShopProduct(item.productId);
    const stock = product && getVariant(product, item.colorId, item.size)?.stock;
    return stock && stock > 0 ? [{ ...item, quantity: Math.min(item.quantity, lineLimit(stock)) }] : [];
  }).slice(0, MAX_CART_LINES);
  const savedWishlist = wishlist.filter(id => Boolean(backendEnabled ? registry.get(id) : getShopProduct(id)));
  return { cart: sanitized, wishlist: savedWishlist };
}
async function hydrate() {
  let saved: unknown = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); }
  catch { /* invalid saved data */ }
  const { cart, wishlist } = rawStore(saved);
  if (backendEnabled) {
    try {
      for (const product of await fetchProducts([...cart.map(i => i.productId), ...wishlist]))
        registry.set(product.id, product);
    } catch {
      // Do not erase the persisted cart on a transient API outage.
      notify({ cart, wishlist, hydrated: true, catalogError: true });
      return;
    }
  }
  notify({ ...sanitizeCart(cart, wishlist), hydrated: true, catalogError: false });
}
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!initialized) {
    initialized = true;
    void hydrate();
  }
  return () => listeners.delete(listener);
}
const getSnapshot = () => current;
const getServerSnapshot = () => EMPTY;

function addToCart(incoming: CartItem, productOverride?: Product): boolean {
  if (productOverride) registerShopProduct(productOverride);
  const product = getShopProduct(incoming.productId);
  const stock = product && getVariant(product, incoming.colorId, incoming.size)?.stock;
  if (!stock || !Number.isInteger(incoming.quantity) || incoming.quantity < 1) return false;
  const found = current.cart.find(item => itemKey(item) === itemKey(incoming));
  // One order holds at most MAX_CART_LINES lines; a new line beyond that would be refused at checkout.
  if (!found && current.cart.length >= MAX_CART_LINES) return false;
  const limit = lineLimit(stock);
  const cart = found
    ? current.cart.map(item => itemKey(item) === itemKey(incoming)
        ? { ...item, quantity: Math.min(limit, item.quantity + incoming.quantity) } : item)
    : [...current.cart, { ...incoming, quantity: Math.min(limit, incoming.quantity) }];
  notify({ ...current, cart });
  return true;
}
function updateQuantity(target: CartItem, quantity: number) {
  const cart = current.cart.map(item => {
    if (itemKey(item) !== itemKey(target)) return item;
    const product = getShopProduct(item.productId);
    const stock = product && getVariant(product, item.colorId, item.size)?.stock || 0;
    return { ...item, quantity: Math.min(lineLimit(stock), Math.max(1, Math.floor(quantity))) };
  });
  notify({ ...current, cart });
}
function removeFromCart(target: CartItem) {
  notify({ ...current, cart: current.cart.filter(item => itemKey(item) !== itemKey(target)) });
}
function clearCart() { notify({ ...current, cart: [] }); }
function toggleWishlist(id: string) {
  if (backendEnabled ? !/^[a-z0-9][a-z0-9-]{1,78}$/.test(id) : !byId(id)) return;
  const wishlist = current.wishlist.includes(id)
    ? current.wishlist.filter(value => value !== id) : [...current.wishlist, id];
  notify({ ...current, wishlist });
}

export type AddedItem = CartItem & { path: string };
type CartUI = { added: AddedItem | null; showAdded: (item: CartItem) => void; dismissAdded: () => void };
const CartUIContext = createContext<CartUI | null>(null);

export function ShopProvider({ children }: { children: React.ReactNode }) {
  const [added, setAdded] = useState<AddedItem | null>(null);
  const showAdded = useCallback((item: CartItem) => setAdded({ ...item, path: window.location.pathname }), []);
  const dismissAdded = useCallback(() => setAdded(null), []);
  const ui = useMemo(() => ({ added, showAdded, dismissAdded }), [added, showAdded, dismissAdded]);
  return <CartUIContext.Provider value={ui}>{children}</CartUIContext.Provider>;
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
    ensureProducts: ensureShopProducts,
    ...ui
  };
}
