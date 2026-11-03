# Last-piece discount («تخفیف آخرین دونه‌ها») — design

Status: **waiting for the owner's approval**. No code is written until it is approved.

## Goal

Models that are down to their very last unit sell faster when they are cheaper. The owner turns one discount on or
off in the back office and sets its percentage; every model whose stock adds up to exactly one unit then carries that
discount on the website, in the cart and in the order total, and loses it again when it is restocked or sold.

## Decisions

The owner was asked about each of these and left them open, so the recommended option was taken. Each can change
before implementation.

| Question | Decision |
| --- | --- |
| Automatic rule or a discount set by hand per product | **Automatic**: one setting (on/off, percent) for all last pieces |
| Also at the shop counter (`صندوق فروش حضوری`) | **No, website only.** The counter keeps the catalog price, which is the price on the printed labels |
| A last piece that is already on sale | **The bigger discount wins**; the two never stack |

## The rule

One pure function, `src/lib/last-piece-discount.ts`, used by the storefront (demo mode) and the API alike, as
`backend/src/pricing.ts` already uses `src/lib/format.ts`:

```ts
type LastPieceDiscount = { enabled: boolean; percent: number };
/** The price a model sells at, and the price shown struck through. */
function lastPiecePrice(price: number, compareAt: number | undefined, totalStock: number, setting: LastPieceDiscount):
  { price: number; compareAt: number | undefined }
```

- It applies only when `setting.enabled` and `totalStock === 1` (stock over every colour and size, the same test as
  `lastPieceOf` in `src/lib/last-pieces.ts`). Otherwise the price and compare-at price pass through unchanged.
- `original` = `compareAt` when it is above `price`, else `price`.
- `discounted` = `original × (100 − percent) / 100`, rounded to the nearest 1,000 toman.
- The model sells at `min(price, discounted)`: an existing sale that is already deeper is kept (no stacking).
- When the price changes, `compareAt` becomes `original`, so the struck price and the «٪ تخفیف» tag show the full
  saving. A result that would not lower the price (very small prices) changes nothing.

Examples at 20%: 718,000 with no sale → **574,000** (struck 718,000). 589,000 on sale from 710,000 → 710,000 × 0.8 =
**568,000** (struck 710,000). At 10% the same product stays at 589,000, its own sale being deeper.

## Data

Migration `backend/sql/011_last_piece_discount.sql`, additive (the previous release ignores it, so a rollback is
safe):

```sql
CREATE TABLE IF NOT EXISTS last_piece_discount (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled boolean NOT NULL DEFAULT false,
  percent smallint NOT NULL DEFAULT 20 CHECK (percent BETWEEN 5 AND 70),
  updated_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO last_piece_discount(id) VALUES (1) ON CONFLICT DO NOTHING;
```

It starts **off**: deploying changes no price until the owner turns it on.

## Where the API applies it

- **Product data** (`hydrate` in `backend/src/catalog.ts`): the list, a single product, the cart lookup and the home
  slider all pass each product through `lastPiecePrice` with the product's total stock and the current setting. The
  storefront (cards, product page, cart, checkout summary, «آخرین دونه‌ها») therefore shows the discounted price
  without its own logic.
- **Orders** (`resolveCart` in `backend/src/orders.ts`): the quote and the order price every line with the same
  function, reading each product's total stock in the same transaction. `unit_price` stores the discounted price and
  totals are computed from it, so the customer pays what the page showed. If the model is restocked between the cart
  and the order, the order uses the price at that moment (the quote shows it before placing, as for any price change).
- **The «تخفیف‌دارها» filter** (`sale=1`): includes last pieces whose price the setting lowers, using the same formula
  in SQL, so the filter and the tags agree.
- **Not applied**: the shop counter and its labels, the back office's product editor and lists (they show and edit the
  catalog price), and the price range filter and price sorts (they keep using the catalog price; a last piece may
  sort a little higher than its discounted price — accepted, rare).
- **Cache**: every stock change already bumps the catalog revision (orders, counter sales, receiving, product edits,
  returns), so a model gains or loses the discount with its stock. Saving the setting bumps it too.

## Back office

A new section «تخفیف آخرین دونه‌ها» in the admin navigation (`components/admin/last-piece-discount.tsx`):

- An on/off switch, the percent (5–70, Persian digits accepted), and «ذخیره». Unsaved changes warn on leaving, like
  the other sections.
- A live list of the models it applies to now: photo, name, the remaining colour and size, catalog price →
  discounted price (or «تخفیف خودش بیشتر است» when its own sale wins). Empty state: «الان محصولی تک‌دونه نیست.»
- Viewing needs `products:read`; saving needs `products:price` (the existing price permission). Without it the form is
  read-only with a short note.
- API: `GET /v1/admin/last-piece-discount` → `{ enabled, percent, updatedAt, items }`;
  `PUT /v1/admin/last-piece-discount` with `{ enabled, percent }` (zod; 400 on bad input, 403 without
  `products:price`). The update writes one row, records `products.last_piece_discount` with `{ from, to }` in the
  activity log, and bumps the catalog revision.

## Storefront

- No new public endpoint: prices arrive already discounted.
- «آخرین دونه‌ها»: when a card is discounted, its price shows struck and red as elsewhere; the line becomes
  «از هر کدوم فقط یکی مونده، با تا X٪ تخفیف؛ مال کسیه که زودتر برسه.» with X the largest discount among the cards
  (unchanged when none is discounted).
- Catalog cards already show «X٪ تخفیف» from `compareAt`.
- **Demo mode** (no API, no back office): a fixed `{ enabled: true, percent: 20 }` is applied to the demo products, so
  the five demo last pieces show the discount and the demo cart totals use it.

## Testing

- **Unit** (`tests-unit/last-piece-discount.test.ts`): applies only at total stock 1 and when enabled; rounding to
  1,000; the bigger discount wins; a no-op when it would not lower the price; the demo catalog's five last pieces are
  20% off.
- **Backend unit**: the admin input schema (percent bounds, types).
- **Backend integration** (real PostgreSQL, `tests/integration/`): with the setting on, a product at total stock 1 is
  listed at the discounted price and `sale=1` includes it; at stock 2 it is back to the catalog price; a COD order of
  the last piece stores the discounted `unit_price` and totals; `PUT` without `products:price` is 403, with it saves,
  audits and changes the public price.
- **E2E**: the home rail and the cart show the discounted price in demo mode; the admin E2E turns the setting on,
  sees the public price change, and turns it off again.

## Out of scope

Per-product overrides or exclusions, a different percent per category, a countdown or end date, and the counter.
