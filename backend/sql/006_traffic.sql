-- Additive: first-party page-view statistics. No cookies, no IP addresses, no full user agents are stored.
-- `visitor` is a one-way hash with a random salt that exists for one Tehran day only, so a visitor can be
-- counted once per day but never followed across days or turned back into an address.
CREATE TABLE IF NOT EXISTS page_views (
  id bigserial PRIMARY KEY,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  day date NOT NULL,
  path varchar(300) NOT NULL,
  product_slug varchar(100),
  referrer_host varchar(120),
  device varchar(10) NOT NULL CHECK (device IN ('mobile', 'tablet', 'desktop')),
  visitor char(32) NOT NULL
);
CREATE INDEX IF NOT EXISTS page_views_day_idx ON page_views(day);
CREATE INDEX IF NOT EXISTS page_views_viewed_at_idx ON page_views(viewed_at);
CREATE TABLE IF NOT EXISTS analytics_salts (
  day date PRIMARY KEY,
  salt char(64) NOT NULL
);
