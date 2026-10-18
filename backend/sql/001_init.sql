CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE TABLE IF NOT EXISTS products (
 id varchar(80) PRIMARY KEY, slug varchar(100) NOT NULL UNIQUE,
 name text NOT NULL, category varchar(40) NOT NULL, description text NOT NULL,
 price integer NOT NULL CHECK(price >= 0), compare_at integer CHECK(compare_at >= 0),
 images jsonb NOT NULL, colors jsonb NOT NULL, sizes jsonb NOT NULL,
 material text NOT NULL, fit text NOT NULL, care text NOT NULL,
 featured boolean NOT NULL DEFAULT false, search_text text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS products_category_created_idx ON products(category, created_at);
CREATE INDEX IF NOT EXISTS products_price_idx ON products(price);
CREATE INDEX IF NOT EXISTS products_search_trgm_idx ON products USING gin(search_text gin_trgm_ops);
CREATE TABLE IF NOT EXISTS product_variants (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 product_id varchar(80) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
 color_id varchar(80) NOT NULL, size varchar(20) NOT NULL,
 stock integer NOT NULL DEFAULT 0 CHECK(stock >= 0),
 CONSTRAINT variant_identity_idx UNIQUE(product_id,color_id,size)
);
CREATE INDEX IF NOT EXISTS variants_product_idx ON product_variants(product_id);
CREATE TABLE IF NOT EXISTS orders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 idempotency_key varchar(100) NOT NULL UNIQUE,
 request_hash varchar(64) NOT NULL,
 address jsonb NOT NULL, shipping varchar(20) NOT NULL, payment varchar(20) NOT NULL,
 status varchar(30) NOT NULL, code varchar(60),
 subtotal integer NOT NULL CHECK(subtotal >= 0), discount integer NOT NULL CHECK(discount >= 0),
 shipping_cost integer NOT NULL CHECK(shipping_cost >= 0), total integer NOT NULL CHECK(total >= 0),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orders_created_idx ON orders(created_at);
CREATE TABLE IF NOT EXISTS order_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
 product_id varchar(80) NOT NULL,
 name text NOT NULL, color_id varchar(80) NOT NULL, size varchar(20) NOT NULL,
 quantity integer NOT NULL CHECK(quantity > 0), unit_price integer NOT NULL CHECK(unit_price >= 0)
);
CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items(order_id);
