'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { byId, getVariant } from '@/data/products';
import type { CartItem } from '@/types/store';

type ShopContextValue = {
  cart: CartItem[];
  wishlist: string[];
  hydrated: boolean;
  addToCart: (item: CartItem) => boolean;
  updateQuantity: (item: CartItem, quantity: number) => void;
  removeFromCart: (item: CartItem) => void;
  clearCart: () => void;
  toggleWishlist: (productId: string) => void;
  cartCount: number;
};

const STORAGE_KEY = 'kasra-demo-v1';
const ShopContext = createContext<ShopContextValue | null>(null);
const itemKey = (item: CartItem) => item.productId + ':' + item.colorId + ':' + item.size;

export function ShopProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          const value = parsed as { cart?: unknown; wishlist?: unknown };
          if (Array.isArray(value.cart)) {
            setCart(value.cart.filter((item): item is CartItem => {
              if (!item || typeof item !== 'object') return false;
              const candidate = item as CartItem;
              const product = byId(candidate.productId);
              const stock = product && getVariant(product, candidate.colorId, candidate.size)?.stock;
              return typeof candidate.quantity === 'number' && Number.isInteger(candidate.quantity)
                && candidate.quantity > 0 && Boolean(stock && stock > 0);
            }).map((item) => {
              const product = byId(item.productId)!;
              return { ...item, quantity: Math.min(item.quantity, getVariant(product, item.colorId, item.size)!.stock) };
            }));
          }
          if (Array.isArray(value.wishlist)) {
            setWishlist(value.wishlist.filter((id): id is string => typeof id === 'string' && Boolean(byId(id))));
          }
        }
      }
    } catch { /* Ignore invalid local demo data. */ }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ cart, wishlist })); }
      catch { /* Private browsing or disabled storage: in-memory demo still works. */ }
    }
  }, [cart, wishlist, hydrated]);

  const value = useMemo<ShopContextValue>(() => ({
    cart, wishlist, hydrated,
    cartCount: cart.reduce((sum, item) => sum + item.quantity, 0),
    addToCart: (incoming) => {
      const product = byId(incoming.productId);
      const stock = product && getVariant(product, incoming.colorId, incoming.size)?.stock;
      if (!stock || !Number.isInteger(incoming.quantity) || incoming.quantity < 1) return false;
      setCart((current) => {
        const found = current.find((item) => itemKey(item) === itemKey(incoming));
        if (found) return current.map((item) => itemKey(item) === itemKey(incoming)
          ? { ...item, quantity: Math.min(stock, item.quantity + incoming.quantity) } : item);
        return [...current, { ...incoming, quantity: Math.min(stock, incoming.quantity) }];
      });
      return true;
    },
    updateQuantity: (target, quantity) => setCart((current) => current.map((item) => {
      if (itemKey(item) !== itemKey(target)) return item;
      const product = byId(item.productId);
      const stock = product && getVariant(product, item.colorId, item.size)?.stock || 0;
      return { ...item, quantity: Math.min(stock, Math.max(1, Math.floor(quantity))) };
    })),
    removeFromCart: (target) => setCart((current) => current.filter((item) => itemKey(item) !== itemKey(target))),
    clearCart: () => setCart([]),
    toggleWishlist: (id) => setWishlist((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id])
  }), [cart, wishlist, hydrated]);

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop(): ShopContextValue {
  const context = useContext(ShopContext);
  if (!context) throw new Error('useShop must be used within ShopProvider');
  return context;
}
