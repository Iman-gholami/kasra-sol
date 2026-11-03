# Last-piece discount («تخفیف آخرین دونه‌ها») — design, revision 2

Status: **waiting for the owner's approval**. No code is written until it is approved.

Revision 2 (owner's request): the discount is decided **per variant** (one colour in one size), not per product.

## Goal

A colour-and-size combination that is down to its very last unit sells faster when it is cheaper. The owner turns one
discount on or off in the back office and sets its percentage. Every variant whose own stock is exactly one unit then
sells at that discount on the website, in the cart and in the order total, whatever the stock of the product's other
variants, and loses it again when that variant is restocked or sold out.

## Decisions

| Question | Decision |
| --- | --- |
| What qualifies | **A variant (colour + size) with stock exactly 1**, judged on its own. The product's total stock and its other variants do not matter. Stock 0 or 2+ never qualifies. |
| How it is set | **Automatically**, from one setting (on/off, percent) for the whole store |
| Shop counter (`صندوق فروش حضوری`) | **Not applied**: the counter keeps the catalog price printed on the labels |
| A variant that is already on sale | **The bigger discount wins**; the two never stack |
| The home «آخرین دونه‌ها» rail and `last=1` | **Open, see below** |

## The rule

The catalog has one base price per product (`price`, optionally `compareAt`); variants have no price of their own.
The discount therefore produces at most one discounted price per product, which applies to exactly those variants
whose stock is 1.

Pure functions in `src/lib/last-piece-discount.ts`, used by the storefront (demo mode) and the API alike, as
`backend/src/pricing.ts` already uses `src/lib/format.ts`:

```ts
type LastPieceSetting = { enabled: boolean; percent: number };
type Offer = { price: number; compareAt?: number };
/** What a variant sells at. `stock` is that variant's own stock. */
function variantOffer(product: { price: number; compareAt?: number }, stock: number, setting: LastPieceSetting): Offer
```

- It changes the price only when `setting.enabled` and `stock === 1`. Otherwise it returns the product's own price
  and compare-at price unchanged.
- `original` = `compareAt` when it is above `price`, else `price`.
- `discounted` = `original × (100 − percent) / 100`, rounded to the nearest 1,000 toman.
- The variant sells at `min(price, discounted)`: a product sale that is already deeper is kept (no stacking).
- When the price changes, the variant's `compareAt` is `original`, so its struck price shows the full saving. A result
  that would not lower the price (very small prices) changes nothing.

Examples at 20%:

| Product | Variant stock | Variant price |
| --- | --- | --- |
| 718,000, no sale | 1 | **574,000** (struck 718,000) |
| 718,000, no sale | 0, 2 or more | 718,000 |
| 437,000 on sale from 530,000 | 1 | 530,000 × 0.8 = **424,000** (struck 530,000) |
| 437,000 on sale from 530,000, at 10% | 1 | 477,000 would be dearer, so **437,000** (struck 530,000) |

## Product data (API contract)

Product-level `price` and `compareAt` stay the catalog prices. Each variant gains two optional fields, present only
when the discount changes that variant's price:

```ts
type ProductVariant = { colorId: string; size: string; stock: number; price?: number; compareAt?: number };
```

The change is additive: clients that ignore the new fields still work. A shared helper reads it everywhere on the
storefront:

```ts
/** The price of one colour in one size: the variant's own offer when it has one, else the product's. */
function offerFor(product: Product, colorId: string, size: string): Offer
/** For listings: the deepest last-piece discount among a product's variants, and whether it covers every variant
 * that can still be bought. null when no variant qualifies. */
function lastPieceDeal(product: Product): { percent: number; everyVariant: boolean } | null
```

## Where the API applies it

- **Product data** (`hydrate` in `backend/src/catalog.ts`): the list, a single product, the cart lookup and the home
  slider fill in `price`/`compareAt` on each variant with stock 1 when the setting is on and the result lowers the
  price.
- **Orders** (`resolveCart` in `backend/src/orders.ts`): the quote and the order price every line with
  `variantOffer`, using the stock of **that line's variant row**, which the order already reads (and, for cash on
  delivery, locks `FOR UPDATE` in the same transaction). `unit_price` stores the variant's price, and totals are
  computed from it, so the customer pays exactly what the page showed for that colour and size. If the variant is
  restocked between the cart and the order, the order uses the price at that moment; the quote shows it before
  placing, as for any price change. A variant at stock 1 can only be ordered once (quantity 1), and a second order for
  it fails on stock as today.
- **The «تخفیف‌دارها» filter** (`sale=1`): includes a product when it has its own sale **or** the setting is on and at
  least one of its variants has stock 1 and the discounted price is below the product's price (the same formula in
  SQL: `EXISTS (variant with stock = 1)` and `round(original × (100 − percent) / 100000) × 1000 < price`).
- **Not applied**: the shop counter and its labels; the back office's product editor and lists (they show and edit the
  catalog price); the price range filter and price sorts (they keep the catalog price — accepted, rare);
  structured data for search engines (the offer stays the catalog price, which is the price a product page shows
  before a colour and size are chosen).
- **Cache**: every stock change already bumps the catalog revision (orders, counter sales, receiving, product edits,
  returns), so a variant gains or loses the discount with its own stock. Saving the setting bumps it too.

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

## Storefront

**Product page.** The price above the buy box follows the selection: the price block becomes part of the buy box's
client component (`purchase-panel.tsx`), so it reads the chosen colour and size.

- Before a colour and size are chosen: the catalog price, as today, plus a line under it when any variant qualifies:
  «تا ۲۰٪ تخفیف روی رنگ و سایزهای تک‌دونه».
- Once a colour is chosen, each size that qualifies carries a small «٪» mark, and its accessible name adds «با تخفیف
  آخرین دونه».
- Once a colour and size are chosen: that variant's price, immediately (no request). A qualifying variant shows its
  struck price and «۲۰٪ تخفیف آخرین دونه»; any other variant shows the catalog price. The phone purchase bar shows the
  same price.

**Cart, added-to-cart sheet and checkout.** Each line's unit price, struck price and line total come from
`offerFor(product, colorId, size)`; the totals (`orderTotals` in `src/lib/checkout.ts`) use it too, so «سود تو از
تخفیف کالاها» includes the last-piece saving. The server's quote and order agree with these numbers.

**Listings** (product cards in the shop, search, shop by colour and the home grids), from `lastPieceDeal`:

- No variant qualifies: unchanged.
- **Some** of the variants that can be bought qualify: the card keeps the catalog price (and its own sale tag, if any)
  and adds a line under the price: «تا ۲۰٪ تخفیف روی رنگ و سایزهای تک‌دونه». It never shows a struck price for the
  whole product.
- **Every** variant that can still be bought qualifies (for example a product with one variant left): the card shows
  the discounted price struck as for any sale, with the «۲۰٪ تخفیف» tag, which is then true of every choice.
- The home cover slider's tag and the search suggestions keep the catalog price and add nothing: they are too small
  for the line, and the catalog price is never wrong for them (it is what most combinations cost).

**Demo mode** (no API, no back office): a fixed `{ enabled: true, percent: 20 }` is applied to the demo products.
Demo stock gets these combinations (models no test uses today), so each case can be seen and tested:

| Demo product | Stock | Case |
| --- | --- | --- |
| shomiz-04, shomiz-07, manto-06, manto-11, tshirt-08 | one variant at 1, every other at 0 (as now) | every buyable variant qualifies |
| shomiz-06 | second colour in L at 1, the rest unchanged | some variants qualify |
| manto-08 | first colour in S and third colour in XL at 1, the rest unchanged | two combinations of one product |
| tshirt-05 (own 18% sale, 437,000 from 530,000) | first colour in M at 1, the rest unchanged | the bigger discount wins (424,000) |

## Open decision: the home «آخرین دونه‌ها» rail and `/shop?last=1`

Today they show models whose **total** stock is one. With a per-variant discount, two options:

- **A (recommended) — per variant.** The rail shows one card per qualifying colour and size (newest product first, at
  most ten cards): the photo, «فقط ۱ دونه», the colour and size, and that variant's price. A card opens the product
  page with that colour and size already chosen (`?color=…&size=…`). `/shop?last=1` lists products with at least one
  variant at stock 1. The rail then promotes exactly the pieces that are discounted. With a real inventory it may fill
  up quickly; it still shows at most ten cards.
- **B — keep it per product.** The rail stays «models down to their last unit»; their one variant is discounted as
  above, but a product with, say, M at 1 and L at 5 is discounted in M without appearing in the rail.

## Back office

A new section «تخفیف آخرین دونه‌ها» in the admin navigation (`components/admin/last-piece-discount.tsx`):

- An on/off switch, the percent (5–70, Persian digits accepted) and «ذخیره». Unsaved changes warn on leaving, like the
  other sections.
- A live list of the **variants** it applies to now: photo, product name, colour and size, catalog price →
  discounted price, or «تخفیف خود محصول بیشتر است» when the product's own sale wins. Empty state: «الان هیچ رنگ و
  سایزی تک‌دونه نیست.»
- Viewing needs `products:read`; saving needs `products:price` (the existing price permission). Without it the form is
  read-only with a short note.
- API: `GET /v1/admin/last-piece-discount` → `{ enabled, percent, updatedAt, variants }`;
  `PUT /v1/admin/last-piece-discount` with `{ enabled, percent }` (zod; 400 on bad input, 403 without
  `products:price`). The update writes one row, records `products.last_piece_discount` with `{ from, to }` in the
  activity log, and bumps the catalog revision.

## Testing

Stock combinations are the core of the tests. In the tables, `M:1 L:5` means size M of one colour has one unit and L
has five.

**Unit — `variantOffer` and the helpers** (`tests-unit/last-piece-discount.test.ts`):

| Case | Stock | Expected |
| --- | --- | --- |
| The only variant left | cream M:1, all others 0 | cream M discounted; `lastPieceDeal` = 20%, every variant |
| One size of many | cream M:1, cream L:5 | M discounted, L at the catalog price; `lastPieceDeal` = 20%, not every variant |
| Two combinations at 1 (total 2) | cream M:1, black L:1 | both discounted, though the product's total is 2 |
| Same size, other colour | cream M:1, black M:3 | only cream M |
| Two units | cream M:2 | nothing discounted; `lastPieceDeal` = null |
| Sold out | all 0 | nothing discounted |
| Setting off | cream M:1 | nothing discounted |
| A deeper product sale | 18% sale, M:1, at 10% | M keeps the product's sale price |
| A shallower product sale | 18% sale, M:1, at 20% | M at 424,000, struck 530,000 |
| Rounding | 718,000 at 20% | 574,000 |
| Restocked / sold | M:1 → M:3, M:1 → M:0 | the discount is gone in both |

Also: `offerFor` falls back to the product price for an unknown colour or size; `orderTotals` charges the variant
price and counts its saving; the demo filter `sale=1` includes shomiz-06 (one variant at 1) and not a product with no
sale and no variant at 1.

**Backend unit**: the admin input schema (percent bounds, types); the API's variant prices for a product row with
mixed stock.

**Backend integration** (real PostgreSQL, `tests/integration/`), on a test product in black M and L, setting on at 20%:

| Stock | Expected |
| --- | --- |
| M:1, L:5 | the product API gives M the discounted price and L none; a COD order of M stores the discounted `unit_price` and totals; an order of L is at the catalog price; `sale=1` lists the product |
| M:1, L:1 | both variants discounted; one order with both lines charges both at the discounted price |
| M:2, L:0 | no discount; `sale=1` does not list it (no own sale) |
| M:1 → 3 | after restocking, the API and a new order use the catalog price |
| setting off | M:1 is at the catalog price |

Plus: `PUT` without `products:price` is 403; with it, it saves, is in the activity log and changes the public price.

**End to end** (demo mode):

- shomiz-06: before choosing, the catalog price and the «تخفیف روی رنگ و سایزهای تک‌دونه» line; choosing the second
  colour marks L with «٪»; choosing L shows the discounted, struck price at once; switching to M shows the catalog
  price again; the phone bar agrees.
- Adding L and M of shomiz-06 to the cart: the L line is discounted, the M line is not, and the cart and checkout
  totals equal the sum of the two.
- The shop: shomiz-06's card shows the catalog price with the «some combinations» line (no struck price); shomiz-04's
  card (its only variant left) shows the discounted price struck; `?sale=1` includes both.
- tshirt-05 in its first colour and M shows 424,000 struck 530,000.
- Back office (admin E2E, real API): turn it on at 20%, see a variant's public price change and its line in the live
  list, turn it off and see the catalog price back.

## Out of scope

Per-product or per-variant overrides and exclusions, a different percent per category, a countdown or end date,
prices per variant other than this discount, and the shop counter.
