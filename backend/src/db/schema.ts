import { pgTable, varchar, text, integer, boolean, timestamp, jsonb, uuid, uniqueIndex, index } from 'drizzle-orm/pg-core';

export type Color = { id: string; name: string; hex: string; familyId?: string };
export type Address = { name: string; mobile: string; province: string; city: string; address: string; postal: string; notes: string };

export const products = pgTable('products', {
  id: varchar('id', { length: 80 }).primaryKey(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  name: text('name').notNull(),
  category: varchar('category', { length: 40 }).notNull(),
  description: text('description').notNull(),
  price: integer('price').notNull(),
  compareAt: integer('compare_at'),
  images: jsonb('images').$type<string[]>().notNull(),
  colors: jsonb('colors').$type<Color[]>().notNull(),
  sizes: jsonb('sizes').$type<string[]>().notNull(),
  material: text('material').notNull(),
  fit: text('fit').notNull(),
  care: text('care').notNull(),
  featured: boolean('featured').notNull().default(false),
  active: boolean('active').notNull().default(true),
  searchText: text('search_text').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, t => [index('products_category_created_idx').on(t.category, t.createdAt), index('products_price_idx').on(t.price)]);

export const variants = pgTable('product_variants', {
  id: uuid('id').defaultRandom().primaryKey(),
  productId: varchar('product_id', { length: 80 }).notNull().references(() => products.id, { onDelete: 'cascade' }),
  colorId: varchar('color_id', { length: 80 }).notNull(),
  size: varchar('size', { length: 20 }).notNull(),
  stock: integer('stock').notNull()
}, t => [uniqueIndex('variant_identity_idx').on(t.productId, t.colorId, t.size)]);

export const orders = pgTable('orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  idempotencyKey: varchar('idempotency_key', { length: 100 }).notNull().unique(),
  requestHash: varchar('request_hash', { length: 64 }).notNull(),
  address: jsonb('address').$type<Address>().notNull(),
  shipping: varchar('shipping', { length: 20 }).notNull(),
  payment: varchar('payment', { length: 20 }).notNull(),
  status: varchar('status', { length: 30 }).notNull(),
  paymentStatus: varchar('payment_status', { length: 20 }).notNull().default('unpaid'),
  code: varchar('code', { length: 60 }),
  subtotal: integer('subtotal').notNull(),
  discount: integer('discount').notNull(),
  shippingCost: integer('shipping_cost').notNull(),
  total: integer('total').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, t => [index('orders_created_idx').on(t.createdAt)]);

export const orderItems = pgTable('order_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  productId: varchar('product_id', { length: 80 }).notNull(),
  name: text('name').notNull(),
  colorId: varchar('color_id', { length: 80 }).notNull(),
  size: varchar('size', { length: 20 }).notNull(),
  quantity: integer('quantity').notNull(),
  unitPrice: integer('unit_price').notNull()
}, t => [index('order_items_order_idx').on(t.orderId)]);
