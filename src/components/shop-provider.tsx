'use client';

import { useSyncExternalStore } from 'react';
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

export function ShopProvider({ children }: { children: React.ReactNode }) { return <>{children}</>; }

export function useShop() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return {
    ...snapshot,
    cartCount: snapshot.cart.reduce((sum, item) => sum + item.quantity, 0),
    addToCart, updateQuantity, removeFromCart, clearCart, toggleWishlist
  };
}
