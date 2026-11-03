import { z } from 'zod';
export const cartItem = z.object({
  productId: z.string().min(1).max(80),
  colorId: z.string().min(1).max(80),
  size: z.string().min(1).max(20),
  quantity: z.number().int().min(1).max(20)
});
export const cart = z.array(cartItem).min(1).max(30).superRefine((lines, ctx) => {
  const keys = new Set<string>();
  for (const [i, line] of lines.entries()) {
    const key = JSON.stringify([line.productId, line.colorId, line.size]);
    if (keys.has(key)) ctx.addIssue({ code: 'custom', message: 'Duplicate variant', path: [i] });
    keys.add(key);
  }
});
export const address = z.object({
  name: z.string().trim().min(3).max(160),
  mobile: z.string().regex(/^09\d{9}$/),
  province: z.string().trim().min(2).max(80),
  city: z.string().trim().min(2).max(80),
  address: z.string().trim().min(12).max(600),
  postal: z.string().regex(/^\d{10}$/),
  notes: z.string().max(500).default('')
});
export const checkout = z.object({
  items: cart, fields: address,
  shipping: z.enum(['post','express','courier']),
  payment: z.enum(['online','cod']),
  code: z.string().max(32).default(''),
  /** The subtotal the shopper was shown. When it no longer matches (a colour and size reached or left its last unit,
   * or a price was edited since the page loaded), the order is refused with `price_changed` instead of charging a
   * different amount. Optional, so older clients keep working. */
  expectedSubtotal: z.number().int().min(0).optional()
});
export type Checkout = z.infer<typeof checkout>;
