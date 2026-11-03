# Last-piece discount («تخفیف آخرین دونه‌ها») — design, revision 4

Status: **waiting for the owner's approval** (with the implementation plan,
`docs/superpowers/plans/2026-11-03-last-piece-discount.md`). No code is written until it is approved.

Revision 2: the discount is decided **per variant** (one colour in one size), not per product.
Revision 3: the home rail is per variant too (one card per qualifying colour and size, opening the product page with
it chosen), «مشاهده همه» opens a page of every qualifying variant, and the section gets its own visual direction
(below) instead of following the reference screenshot's red panel.
Revision 4 (owner): the section follows the owner's reference layout after all (papionlady.com's «آخرین دونه», from
the owner's screenshots), in Kasra red, with the owner's pick of five icon concepts, the discount stamp. Mockups:
the scratchpad's `mockup/final-*.png`, shared in the chat.

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
| The home «آخرین دونه‌ها» rail | **Per variant**: one card per colour and size at stock 1 (owner, revision 3) |
| «مشاهده همه» | **A page of every qualifying variant**, `/last-pieces`; the shop's product-level `last=1` filter is removed |

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
  computed from it, so the customer pays exactly what the page showed for that colour and size. If the variant
  reaches or leaves its last unit (or the setting or a price changes) between loading the page and placing the order,
  the storefront sends the subtotal it showed as `expectedSubtotal` and each line's unit price as `expectedPrice`;
  when the server's subtotal or any line's price differs (two lines can change in opposite directions and keep the
  subtotal), the order is refused with `409 price_changed` (and the new `subtotal`), nothing is stored or decremented, and the checkout reloads
  the cart's products, shows the new prices with «قیمت یکی از اقلام تغییر کرده و مبلغ سفارش به‌روز شد…» and lets the
  shopper place it again. The field is optional, so an older client is still served. A variant at stock 1 can only
  be ordered once (quantity 1), and a second order for it fails on stock as today.
- **Confirmation**: the placed order keeps its lines with each line's unit price (`lines` in the tab's stored order),
  so «اقلام سفارش» shows what was sold, not a re-priced line from the demo catalog.
- **The «تخفیف‌دارها» filter** (`sale=1`): includes a product when it has its own sale **or** the setting is on and at
  least one of its variants has stock 1 and the discounted price is below the product's price (the same formula in
  SQL: `EXISTS (variant with stock = 1)` and `round(original × (100 − percent) / 100000) × 1000 < price`, computed in
  `numeric`: `original × (100 − percent)` overflows a 32-bit integer for prices above about 21,000,000 toman).
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

## The home rail and the «مشاهده همه» page

- **What they list**: every variant with stock exactly 1 of a published product, whose colour is still one of the
  product's colours, newest product first, then in the product's colour order and size order. The home rail shows
  the first ten; `/last-pieces` shows them all. Both are listed with the setting off
  too (they are the last pieces either way); only the price changes with it.
- **A card** (see the visual direction): the photo, the pill («۲۰٪ تخفیف» when its price is lowered, else «فقط ۱
  دونه»), the product name, the colour swatch, colour name and size, and the variant's price (struck original when
  lowered). It opens `/product/<slug>?color=<colorId>&size=<size>`, where the buy
  box starts with that colour and size chosen. Invalid or sold-out choices in the address are ignored.
- **`/last-pieces`**: the title «آخرین دونه‌ها», the line, «X دونه», the same cards in two columns, and an empty state
  «الان هیچ رنگ و سایزی تک‌دونه نیست.» with «دیدن همه محصولات». The shop's `last=1` filter (product-level) is removed
  from the storefront and the API: this page replaces it.

## Visual direction (the section)

The owner's reference (papionlady.com's «آخرین دونه» rail, phone layout), in Kasra's own colours and with Kasra's own
icon. Their artwork is not reused.

- **The band**: Kasra red (`--color-brand`, `#B51F2B`), edge to edge on phones (the column on wider screens), with
  square sides like the other edge-to-edge strips.
- **Title row**: at the inline start the stamp (below) and «آخرین دونه‌ها» in white, Estedad 800 at `1.25rem`; at the
  inline end «مشاهده همه» in white 800 with a chevron (`ChevronLeft`), a 44px target. No tagline in the rail.
- **The stamp** (the owner's pick): a 72px white sticker with a scalloped edge (22 scallops), a dashed Kasra-red inner
  ring and a red centre reading «فقط / ۱ / دونه», popping out of the band's top edge beside the title
  (`aria-hidden`; the title says it). Its edge turns with page scrolling where `animation-timeline: scroll()` is
  supported (no autoplay, so WCAG 2.2.2 holds) and is still otherwise and under reduced motion.
- **Cards**: white, `14px` radius, `10px` padding, about 43% of the column wide (so the next card is visibly cut,
  inviting a swipe), scroll-snapped. Inside: the photo (4:5, studio gray, `10px` radius); the red pill «۲۰٪ تخفیف»
  (or «فقط ۱ دونه» when the price is not lowered) sitting on the photo's bottom edge at the inline start; the name in
  Estedad 800 at 15px, at most two lines; the colour swatch with «مشکی، سایز L»; at the inline end, the struck
  original price with «تومان» and, under it, the price in ink 700.
- **Arrows**: white 44px discs with a chevron, centred on the photos at both ends of the band, on every device (as in
  the reference), the one at the start faded until the rail has moved; disabled at each end and until hydrated; a
  quick double press moves two pages.
- **Motion**: none on its own besides the stamp's scroll-linked turn; pressing a card gives `scale(.98)`. Reduced
  motion: nothing moves, arrows scroll instantly.

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
| price 30,000,000, M:1 | `sale=1` answers 200 and lists it (no integer overflow) |
| M:1, order sent with `expectedSubtotal` = the catalog price | `409 price_changed` with the discounted `subtotal`; no order, stock still 1; resent with the discounted subtotal it is placed |
| M:1, L:5, lines sent with their prices swapped (same subtotal) | `409 price_changed`, no stock moved; resent with the right line prices it is placed and stores them |

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
  list, turn it off and see the catalog price back. And: a shopper reaches the payment step at 25%, the owner changes
  it to 30%, «ثبت نهایی سفارش» is refused with the notice, the summary shows the new price, and the second press
  places the order at it, which the confirmation shows.
- The confirmation shows each line at the price stored with the order (a stored 700,000 line shows 700,000 although
  the demo catalog prices it at 643,000), and placing an order stores those prices.
- The rail: nine demo cards (the table above), each with its colour, size and price, on the Kasra-red band with the
  stamp beside the title; a card opens its product with that colour and size chosen; «مشاهده همه» opens
  `/last-pieces` with all nine; swiping on a 320px phone never widens the page; the arrows on phones and desktop; no
  serious axe findings.

## Out of scope

Per-product or per-variant overrides and exclusions, a different percent per category, a countdown or end date,
prices per variant other than this discount, and the shop counter.
