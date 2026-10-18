import { z } from 'zod';

const ident = z.string().regex(/^[a-z0-9][a-z0-9-]{1,78}$/);
const size = z.string().trim().min(1).max(20);
const color = z.object({
  id: ident, name: z.string().trim().min(1).max(80),
  hex: z.string().regex(/^#[A-Fa-f0-9]{6}$/), familyId: ident.optional()
}).strict();
const variant = z.object({
  colorId: ident, size, stock: z.number().int().min(0).max(1_000_000)
}).strict();
const imagePath = z.string().max(180).refine(value =>
  /^\/api\/media\/[a-f0-9-]{36}\.(png|jpg|webp)$/.test(value) ||
  /^\/images\/[a-zA-Z0-9_./-]+\.(avif|png|jpg|jpeg|webp)$/.test(value) && !value.includes('..'),
  'Only local catalog and uploaded images are permitted');

export const productInput = z.object({
  id: ident,
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,99}$/),
  name: z.string().trim().min(2).max(200),
  category: z.enum(['shomiz', 'manto', 'tshirt']),
  description: z.string().trim().min(10).max(4000),
  price: z.number().int().min(0).max(1_000_000_000),
  compareAt: z.number().int().min(0).max(1_000_000_000).nullable(),
  images: z.array(imagePath).max(8),
  colors: z.array(color).min(1).max(20),
  sizes: z.array(size).min(1).max(20),
  variants: z.array(variant).min(1).max(120),
  material: z.string().trim().min(1).max(200),
  fit: z.string().trim().min(1).max(200),
  care: z.string().trim().min(1).max(1000),
  featured: z.boolean()
}).strict().superRefine((value, ctx) => {
  if (value.compareAt !== null && value.compareAt < value.price)
    ctx.addIssue({ code: 'custom', message: 'Original price must not be below sale price', path: ['compareAt'] });
  const colors = value.colors.map(c => c.id);
  const sizes = value.sizes;
  if (new Set(colors).size !== colors.length)
    ctx.addIssue({ code: 'custom', message: 'Repeated color', path: ['colors'] });
  if (new Set(sizes).size !== sizes.length)
    ctx.addIssue({ code: 'custom', message: 'Repeated size', path: ['sizes'] });
  const seen = new Set<string>();
  for (const [index, row] of value.variants.entries()) {
    const key = JSON.stringify([row.colorId, row.size]);
    if (seen.has(key) || !colors.includes(row.colorId) || !sizes.includes(row.size))
      ctx.addIssue({ code: 'custom', message: 'Variant must have a unique matching color and size', path: ['variants', index] });
    seen.add(key);
  }
});
export type ProductInput = z.infer<typeof productInput>;
export const productIdentity = ident;
