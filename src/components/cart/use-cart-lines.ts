'use client';

import { useState } from 'react';
import { byId } from '@/data/products';
import { useShop } from '@/components/shop-provider';
import type { CartItem, Product } from '@/types/store';

export const lineKey = (item: CartItem) => item.productId + ':' + item.colorId + ':' + item.size;

export type CartRow =
  | { kind: 'line'; key: string; item: CartItem; product: Product; stock: number }
  | { kind: 'removed'; key: string; item: CartItem; product: Product };

/** Cart lines in a stable on-screen order, with in-place "removed — undo" rows.
 * Uses only the existing store API: removal is immediate (totals and badges stay honest) and
 * undo re-adds the same variant and quantity, which keeps its original position on screen. */
export function useCartLines() {
  const { cart, hydrated, addToCart, removeFromCart, updateQuantity } = useShop();
  const [order, setOrder] = useState<string[]>([]);
  const [removed, setRemoved] = useState<Record<string, CartItem>>({});

  const keys = cart.map(lineKey);
  const merged = [...order.filter(key => keys.includes(key) || removed[key]), ...keys.filter(key => !order.includes(key))];
  if (merged.length !== order.length || merged.some((key, index) => key !== order[index])) setOrder(merged);

  const rows: CartRow[] = merged.flatMap((key): CartRow[] => {
    const item = cart.find(entry => lineKey(entry) === key);
    if (item) {
      const product = byId(item.productId);
      if (!product) return [];
      const stock = product.variants.find(v => v.colorId === item.colorId && v.size === item.size)?.stock ?? 0;
      return [{ kind: 'line', key, item, product, stock }];
    }
    const gone = removed[key];
    const product = gone && byId(gone.productId);
    return gone && product ? [{ kind: 'removed', key, item: gone, product }] : [];
  });
  const lines = rows.filter((row): row is Extract<CartRow, { kind: 'line' }> => row.kind === 'line');
  const subtotal = lines.reduce((sum, { item, product }) => sum + product.price * item.quantity, 0);
  const savings = lines.reduce((sum, { item, product }) => sum + Math.max(0, (product.compareAt ?? product.price) - product.price) * item.quantity, 0);
  const units = lines.reduce((sum, { item }) => sum + item.quantity, 0);

  function remove(item: CartItem) {
    setRemoved(current => ({ ...current, [lineKey(item)]: item }));
    removeFromCart(item);
  }
  function undo(item: CartItem) {
    addToCart({ ...item });
    setRemoved(current => {
      const next = { ...current };
      delete next[lineKey(item)];
      return next;
    });
  }
  function dismiss(item: CartItem) {
    setRemoved(current => {
      const next = { ...current };
      delete next[lineKey(item)];
      return next;
    });
  }

  return { hydrated, rows, lines, subtotal, savings, units, remove, undo, dismiss, updateQuantity };
}
