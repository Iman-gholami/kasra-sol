# Last-piece discount Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A colour-and-size variant with exactly one unit left sells at a discount the owner sets in the back office,
identically on every page, in the cart and in the server's order total; the home page shows these pieces in a
redesigned «آخرین دونه‌ها» rail, and «مشاهده همه» lists them all.

**Architecture:** One pure pricing module shared by the storefront and the API (`src/lib/last-piece-discount.ts`)
turns a product's catalog price into per-variant offers. The API fills those offers into every product payload and
prices every order line with the same function from the line's own variant row; the storefront only reads offers
(`offerFor`). A one-row settings table holds on/off and the percent; a new admin section edits it.

**Tech Stack:** Next.js 16 / React 19 storefront (TypeScript, CSS with container queries), Fastify + Drizzle +
PostgreSQL API, node:test (`tsx --test`), Playwright.

**Spec:** `docs/superpowers/specs/2026-11-03-last-piece-discount-design.md` (revision 4).

## Global Constraints

- A variant qualifies only when the setting is enabled **and that variant's own stock is exactly 1**; stock 0 or ≥ 2
  never qualifies; the product's total stock is irrelevant.
- `discounted = round(original × (100 − percent) / 100 / 1000) × 1000` where `original = compareAt > price ? compareAt : price`;
  the variant sells at `min(price, discounted)` and shows `compareAt = original`; a result `≥ price` changes nothing.
- Percent is an integer **5–70**; the setting starts **off at 20**. Demo mode uses `{ enabled: true, percent: 20 }`.
- Website only: the shop counter (`backend/src/admin/store-routes.ts`) and the admin product editor keep catalog prices.
- Price range filter, price sorts and structured data keep catalog prices.
- Migration `011_last_piece_discount` is additive; the previous release must keep working without it.
- Storefront CSS: container queries (`@container kasra (max-width: …)`) and `cqi` only, never viewport-width media
  queries or `vw` (`tests-unit/single-layout-css.test.ts`); text ≥ 12px; touch targets ≥ 44px; motion uses
  `transform`/`opacity`, never runs on its own, and is off under `prefers-reduced-motion`.
- Copy, verbatim: «آخرین دونه‌ها» · on `/last-pieces` only, «از هر کدوم فقط یکی مونده؛ مال کسیه که زودتر برسه.» ·
  «مشاهده همه» · «فقط ۱ دونه» ·
  «X٪ تخفیف» · listings «تا X٪ تخفیف روی رنگ و سایزهای تک‌دونه» · chosen variant «X٪ تخفیف آخرین دونه» ·
  size name suffix «، با تخفیف آخرین دونه» · page count «X دونه» · empty «الان هیچ رنگ و سایزی تک‌دونه نیست.» with
  «دیدن همه محصولات» · admin section «تخفیف آخرین دونه‌ها» · admin own-sale note «تخفیف خود محصول بیشتر است».
  Numbers in Persian digits via `formatNumber` / `formatPercent`.
- The rail's look is the spec's "Visual direction": the Kasra-red band, white cards, the pill on the photo's edge,
  arrows on every device, the 72px scalloped stamp beside the title. No new colour token.

## Review Focus

- **A product link with a bad or stale selection** (`?color=nope&size=XXL`, or a colour/size that sold out since the
  card was shown): the product page loads with nothing chosen, or only the colour when the size is the bad part —
  never an error, never a sold-out size chosen. Test in Task 6.
- **A last piece whose own sale is deeper than the setting**: it is not a last-piece deal anywhere (no listing line, no
  «٪» size mark, not counted in the rail's «تا X٪»); it still appears in the rail as a last piece at its sale price.
  Tests in Tasks 1 and 8.
- **A variant whose colour was removed from the product** (stale variant row): it never appears in the rail, the page
  or the admin list, and `offerFor` for an unknown colour/size returns the product price. Tests in Tasks 1 and 8.
- **The owner types the percent in Persian digits, or out of range** («۲۵», «۷۵», «۰», «۲۰٫۵»): Persian digits are
  accepted; out-of-range or non-integer values are refused by the API with 400 and shown as an inline error, and
  nothing is saved. Tests in Tasks 4 and 9.
- **A cart kept across a restock**: a cart saved while L was 1 shows the catalog price after L is restocked (the cart
  reads prices from the lookup on every visit, unchanged), and the quote and the order charge the catalog price. Test
  in Task 3 (the quote and the product API after `setStock('M', 3)`).

---

## File map

| File | Responsibility |
| --- | --- |
| `src/lib/last-piece-discount.ts` (new) | The rule, offers per variant, deal summary for listings; shared with the API |
| `src/types/store.ts` | `ProductVariant` gains optional `price`, `compareAt`; `CatalogFilters.lastPiece` removed |
| `src/data/products.ts` | Demo stock combinations; demo products passed through the demo setting |
| `src/lib/catalog.ts`, `catalog-url.ts`, `components/catalog/*` | `sale=1` includes deals; `last=1` removed |
| `backend/sql/011_last_piece_discount.sql`, `backend/src/db/migrate.ts` | The settings row |
| `backend/src/last-piece.ts` (new) | `getLastPieceSetting(db)` |
| `backend/src/catalog.ts`, `backend/src/orders.ts` | Offers in payloads, `sale=1` SQL, order line prices; `last` removed |
| `backend/src/admin/last-piece-routes.ts` (new), `admin/routes.ts` | GET/PUT of the setting with the live variant list |
| `src/lib/checkout.ts`, `components/cart/cart-page.tsx`, `components/checkout/order-summary.tsx` | Variant prices in cart and totals |
| `components/products/purchase-panel.tsx`, `product-detail.tsx`, `app/product/[slug]/page.tsx`, `styles/product.css` | Variant-aware price, size marks, preselection |
| `components/products/product-card.tsx`, `src/lib/shop-by-color.ts`, `styles/catalog.css` | The listing line / struck price |
| `src/lib/last-pieces.ts`, `components/home/last-piece-card.tsx` (new), `last-pieces.tsx`, `last-pieces-arrows.tsx`, `app/last-pieces/page.tsx` (new), `styles/home.css`, `styles/tokens.css` | The rail and the see-all page |
| `components/admin/last-piece-discount.tsx` (new), `admin-dashboard.tsx`, `styles/admin.css` | The admin section |

Demo fixtures used by tests (from the spec's table; prices at 20%): shomiz-04 white M 718,000 → 574,000 ·
shomiz-06 black L 804,000 → 643,000 (its other variants keep their stock) · shomiz-07 rose M → 678,000 ·
manto-06 rose M → 1,188,000 · tshirt-05 cream M 437,000 (from 530,000) → 424,000 · manto-08 rose S and cream XL
1,643,000 → 1,314,000 · tshirt-08 white M → 414,000 · manto-11 black M → 1,504,000. Rail order (newest product
first, then colour, then size): shomiz-04, shomiz-06, shomiz-07, manto-06, tshirt-05, manto-08 rose S,
manto-08 cream XL, tshirt-08, manto-11.

---

### Task 1: The shared rule

**Files:**
- Create: `src/lib/last-piece-discount.ts`
- Modify: `src/types/store.ts` (`ProductVariant`)
- Test: `tests-unit/last-piece-discount.test.ts`

**Interfaces:**
- Produces:
  - `type LastPieceSetting = { enabled: boolean; percent: number }`
  - `type Offer = { price: number; compareAt?: number }`
  - `type LastPieceDeal = { percent: number; everyVariant: boolean; offer: Offer }`
  - `const DEMO_LAST_PIECE_SETTING: LastPieceSetting` (`{ enabled: true, percent: 20 }`)
  - `const LAST_PIECE_PERCENT = { min: 5, max: 70 } as const`
  - `variantOffer(base: Offer, stock: number, setting: LastPieceSetting): Offer`
  - `withLastPieceOffers<T extends Offer & { variants: ProductVariant[] }>(product: T, setting: LastPieceSetting): T`
    — copies `price`/`compareAt` onto each variant whose offer differs from the product's; removes stale ones
  - `offerFor(product: Offer & { variants: ProductVariant[] }, colorId: string, size: string): Offer`
  - `lastPieceDeal(product: Offer & { variants: ProductVariant[] }): LastPieceDeal | null` — `percent` is the deepest
    `discountPercent(variant.price, variant.compareAt)` among variants with an own `price`; `everyVariant` is true when
    every variant with stock > 0 has one; `offer` is the lowest variant offer
  - `ProductVariant = { colorId: string; size: string; stock: number; price?: number; compareAt?: number }`

- [ ] **Step 1: Write the failing tests** — one `it` per row of the spec's unit table, with a fixture helper
  `product(stock: Record<'cream-M'|'cream-L'|'black-M'|'black-L', number>, extra?)` at 900,000 (cream and black, M
  and L). Key assertions:

```ts
assert.deepEqual(variantOffer({ price: 718_000 }, 1, ON20), { price: 574_000, compareAt: 718_000 });
assert.deepEqual(variantOffer({ price: 718_000 }, 2, ON20), { price: 718_000 });
assert.deepEqual(variantOffer({ price: 718_000 }, 0, ON20), { price: 718_000 });
assert.deepEqual(variantOffer({ price: 718_000 }, 1, { enabled: false, percent: 20 }), { price: 718_000 });
assert.deepEqual(variantOffer({ price: 437_000, compareAt: 530_000 }, 1, ON20), { price: 424_000, compareAt: 530_000 });
assert.deepEqual(variantOffer({ price: 437_000, compareAt: 530_000 }, 1, { enabled: true, percent: 10 }), { price: 437_000, compareAt: 530_000 });
assert.deepEqual(variantOffer({ price: 1_000 }, 1, { enabled: true, percent: 5 }), { price: 1_000 }); // would not lower it
// two combinations at 1 (total 2) are both discounted; same size other colour is not
const p = withLastPieceOffers(product({ 'cream-M': 1, 'black-L': 1, 'black-M': 3 }), ON20);
assert.equal(offerFor(p, 'cream', 'M').price, 720_000);
assert.equal(offerFor(p, 'black', 'L').price, 720_000);
assert.equal(offerFor(p, 'black', 'M').price, 900_000);
assert.equal(offerFor(p, 'nope', 'XXL').price, 900_000);
assert.deepEqual(lastPieceDeal(p), { percent: 20, everyVariant: false, offer: { price: 720_000, compareAt: 900_000 } });
assert.equal(lastPieceDeal(withLastPieceOffers(product({ 'cream-M': 1 }), ON20))?.everyVariant, true);
assert.equal(lastPieceDeal(withLastPieceOffers(product({ 'cream-M': 2 }), ON20)), null);
// a last piece whose own sale is deeper is no last-piece deal
assert.equal(lastPieceDeal(withLastPieceOffers(product({ 'cream-M': 1 }, { price: 437_000, compareAt: 530_000 }), { enabled: true, percent: 10 })), null);
// restocked or sold: re-applying with the new stock removes the variant's offer
assert.equal(offerFor(withLastPieceOffers({ ...p, variants: p.variants.map(v => v.colorId === 'cream' && v.size === 'M' ? { ...v, stock: 3 } : v) }, ON20), 'cream', 'M').price, 900_000);
```

- [ ] **Step 2: Run** `npx tsx --test tests-unit/last-piece-discount.test.ts` — expected: FAIL, cannot find module.
- [ ] **Step 3: Implement** the module and the `ProductVariant` fields. `withLastPieceOffers` is pure (returns a new
  object). Rounding: `Math.round(original * (100 - percent) / 100 / 1000) * 1000`.
- [ ] **Step 4: Run** the test file, then `npm run typecheck` — expected: PASS, no type errors.
- [ ] **Step 5: Commit** `feat(pricing): last-piece offers per variant`.

### Task 2: Demo catalog and the storefront's filters

**Files:**
- Modify: `src/data/products.ts`, `src/lib/catalog.ts`, `src/lib/catalog-url.ts`, `src/components/catalog/catalog-view.tsx`,
  `src/components/catalog/catalog-filters.tsx`, `src/types/store.ts` (remove `lastPiece`)
- Test: `tests-unit/catalog.test.ts`, `tests-unit/products-data.test.ts`

**Interfaces:**
- Consumes: `withLastPieceOffers`, `lastPieceDeal`, `DEMO_LAST_PIECE_SETTING` (Task 1).
- Produces: demo `products` already carry variant offers; `queryProducts({ discounted: true })` in demo mode keeps a
  product when `compareAt > price` **or** `lastPieceDeal(product) !== null`.

- [ ] **Step 1: Write the failing tests.** In `products-data.test.ts`: the stock of shomiz-06 black L, manto-08 rose S
  and cream XL, tshirt-05 cream M is 1 and every other variant of those products keeps a stock ≠ 1; the five earlier
  last pieces keep one variant at 1 and the rest at 0; `offerFor(bySlug('shomiz-06')!, 'black', 'L')` is
  `{ price: 643_000, compareAt: 804_000 }`; `offerFor(bySlug('tshirt-05')!, 'cream', 'M').price === 424_000`. In
  `catalog.test.ts`: the `on sale` case's predicate becomes `(p.compareAt ?? 0) > p.price || lastPieceDeal(p) !== null`
  and includes shomiz-06; remove the `last piece` case, `last: '1'` from the API-forwarding test, `last=1` from the
  `catalogHref` expectations and `lastPiece` from the defaults and round trip.
- [ ] **Step 2: Run** `npx tsx --test tests-unit/products-data.test.ts tests-unit/catalog.test.ts` — expected: FAIL on
  the new stock and price assertions.
- [ ] **Step 3: Implement.** Demo stock: extend the existing `demoLastPieces` override with the three new
  combinations (a map slug → list of `[colorIndex, size]` at stock 1; for the five earlier ones every other variant is
  0, for the new three the others keep the formula). Export `products` mapped through
  `withLastPieceOffers(p, DEMO_LAST_PIECE_SETTING)`. Remove `lastPiece` / `last=1` everywhere in the storefront
  (parse, query, URL builder, chip, sort-form hidden input, active count) and `lastPieceOf` from `src/lib/last-pieces.ts`.
- [ ] **Step 4: Run** `npm run test:unit` — expected: all pass.
- [ ] **Step 5: Commit** `feat(demo): last-piece combinations; sale filter includes variant deals; drop last=1`.

### Task 3: The API — setting, product payloads, `sale=1`, orders

**Files:**
- Create: `backend/sql/011_last_piece_discount.sql` (the spec's SQL), `backend/src/last-piece.ts`
- Modify: `backend/src/db/migrate.ts` (append `'011_last_piece_discount'`), `backend/src/catalog.ts`, `backend/src/orders.ts`
- Test: `backend/tests/catalog-filters.test.ts`, `backend/tests/integration/orders.integration.mjs`

**Interfaces:**
- Consumes: `variantOffer`, `withLastPieceOffers` (Task 1) via `../../src/lib/last-piece-discount`.
- Produces: `getLastPieceSetting(db: { query: Queryable['query'] }): Promise<LastPieceSetting>` (reads row 1; returns
  `{ enabled: false, percent: 20 }` when it is missing); `hydrate(rows)` returns variants with offers; `resolveCart`
  lines carry `offer: Offer` and `unitPrice = offer.price`.

- [ ] **Step 1: Write the failing tests.** `catalog-filters.test.ts`: remove the `last` cases (`{ last: 'yes' }` is no
  longer rejected; it is stripped). `orders.integration.mjs`: replace the `last=1` test with
  `describe('last-piece discount')`, which sets row 1 to `{ enabled: true, percent: 20 }` in `before` and back to off
  in `after`, and one `it` per row of the spec's integration table on `it-orders-01` (black, `PRICE` 500,000 →
  400,000): `GET /v1/products/it-orders-01` variant prices; a COD order of M with `stock M:1` stores
  `unit_price = 400_000` and `totals.subtotal = 400_000`; M:1 L:1 with both lines → subtotal 800,000; M:2 L:0 →
  no variant price and absent from `sale=1`; M:1 then `setStock('M', 3)` → catalog price in the API and a new quote;
  setting off → catalog price. Use distinct query strings per fixture, as the existing sale test does.
- [ ] **Step 2: Run** the backend unit tests (`cd backend && npm test`) and the integration file against local
  PostgreSQL:
  `pg_ctlcluster 16 main start`, then with `DATABASE_URL`, `ORDER_TOKEN_SECRET`, `ADMIN_API_KEY`, `TRUST_PROXY=true`
  set: `npm run build && npm run db:migrate && npm run db:seed`, start `node dist/index.js` (keep its PID; never
  `pkill -f`), `node --test --test-concurrency=1 tests/integration/orders.integration.mjs` — expected: the new
  last-piece tests FAIL (no table / no offers).
- [ ] **Step 3: Implement.** Migration and list entry. `hydrate` reads the setting once per call and passes each
  product through `withLastPieceOffers`. `listProducts`: drop `last`; `sale=1` becomes
  `compare_at > price OR (setting.enabled AND EXISTS (variant stock = 1) AND round(GREATEST(price, COALESCE(compare_at,0)) * (100 - percent) / 100000.0) * 1000 < price)`
  with the setting values as parameters. `resolveCart`: read the setting in the same transaction and compute each
  line's `offer = variantOffer({ price: row.price, compareAt: row.compareAt ?? undefined }, variant.stock, setting)`
  (the row's `compareAt` is `null`, not `undefined`); `calculate` and `unitPrice` use `offer.price` (both
  `createOrder` and the quote).
- [ ] **Step 4: Run** `npm --prefix backend run typecheck`, `npm --prefix backend test` and the integration file —
  expected: all pass, including the existing order and concurrency tests.
- [ ] **Step 5: Commit** `feat(api): last-piece prices per variant in catalog, sale filter and orders`.

### Task 4: The admin API

**Files:**
- Create: `backend/src/admin/last-piece-routes.ts`
- Modify: `backend/src/admin/routes.ts` (register next to `homeAdminRoutes`)
- Test: `backend/tests/admin-routes.test.ts`, `backend/tests/schemas.test.ts`, `backend/tests/integration/admin.integration.mjs`

**Interfaces:**
- Consumes: `getLastPieceSetting`, `variantOffer`, `LAST_PIECE_PERCENT`, `recordAudit`, `opts.invalidateCatalog`.
- Produces:
  - `GET /v1/admin/last-piece-discount` (`products:read`) →
    `{ enabled, percent, updatedAt, variants: { productId, slug, name, image, colorId, colorName, size, price, compareAt, offerPrice, ownSaleWins }[] }`
    for active products, variants at stock 1 whose colour is in the product's colours, newest product first.
  - `PUT /v1/admin/last-piece-discount` (`products:price`) with `lastPieceInput = z.object({ enabled: z.boolean(), percent: z.coerce.number().int().min(5).max(70) })`
    after converting Persian digits in a string `percent`; 400 `invalid_payload`; on success updates row 1
    (`updated_by`, `updated_at`), audits `products.last_piece_discount` with `{ from, to }`, calls `invalidateCatalog`,
    returns `{ enabled, percent }`.

- [ ] **Step 1: Write the failing tests.** `admin-routes.test.ts`: add both rows to `ENDPOINTS`
  (`['GET', '/v1/admin/last-piece-discount', 'products:read']`, `['PUT', '/v1/admin/last-piece-discount', 'products:price']`).
  `schemas.test.ts`: `lastPieceInput` accepts `{ enabled: true, percent: '۲۵' }` (→ 25) and `{ enabled: false, percent: 5 }`;
  rejects percent `4`, `71`, `'۷۵'`, `20.5`, `'abc'`, a missing `enabled`. `admin.integration.mjs`: as the owner, `PUT`
  `{ enabled: true, percent: 30 }` → 200, the audit log has `products.last_piece_discount`, the public product API
  shows a variant at stock 1 at 30% off; as staff without `products:price` → 403 and nothing changes; finally turn it
  off.
- [ ] **Step 2: Run** `cd backend && npx tsx --test tests/admin-routes.test.ts tests/schemas.test.ts` — expected: FAIL
  (routes missing).
- [ ] **Step 3: Implement** the route module (`pool` queries in the style of `home-routes.ts`, one advisory-free
  `UPDATE … WHERE id = 1` inside a transaction with the audit insert).
- [ ] **Step 4: Run** the backend unit tests and `admin.integration.mjs` (API started as in Task 3; the media tests in
  that file need Garage and may be skipped locally — CI runs them) — expected: PASS.
- [ ] **Step 5: Commit** `feat(admin-api): last-piece discount setting`.

### Task 5: Cart and checkout

**Files:**
- Modify: `src/lib/checkout.ts` (`orderTotals`), `src/components/cart/cart-page.tsx`, `src/components/checkout/order-summary.tsx`
- Test: `tests-unit/checkout.test.ts`, `tests/last-piece-price.spec.ts` (create)

**Interfaces:**
- Consumes: `offerFor` (Task 1); demo offers (Task 2).
- Produces: every cart and checkout amount uses `offerFor(product, item.colorId, item.size)`.

- [ ] **Step 1: Write the failing tests.** `checkout.test.ts`: `orderTotals` for shomiz-06 black L ×1 and white M ×1
  gives `subtotal = 643_000 + 804_000`, `original = 804_000 × 2`, `savings = 161_000`. `last-piece-price.spec.ts`
  (seed the cart in `localStorage` as `checkout.spec.ts` does): `/cart` shows the L line at «۶۴۳٬۰۰۰ تومان» with
  «۸۰۴٬۰۰۰» struck and the M line at «۸۰۴٬۰۰۰ تومان» with no struck price; the cart total and the checkout summary
  equal «۱٬۴۴۷٬۰۰۰ تومان» before shipping; «سود تو از تخفیف کالاها» shows «۱۶۱٬۰۰۰ تومان».
- [ ] **Step 2: Run** `npx tsx --test tests-unit/checkout.test.ts`; `npm run build` then
  `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium npx playwright test tests/last-piece-price.spec.ts` —
  expected: FAIL (lines priced at 804,000).
- [ ] **Step 3: Implement** with `offerFor` in the three files (line price, struck price, line total, totals).
- [ ] **Step 4: Run** both again, then `tests/checkout.spec.ts` — expected: PASS.
- [ ] **Step 5: Commit** `feat(cart): variant prices in cart and checkout`.

### Task 6: The product page

**Files:**
- Modify: `src/components/products/purchase-panel.tsx`, `src/components/products/product-detail.tsx`,
  `src/app/product/[slug]/page.tsx`, `src/styles/product.css`
- Test: `tests/last-piece-price.spec.ts`, `tests/pdp.spec.ts` (only if a selector moves)

**Interfaces:**
- Consumes: `offerFor`, `lastPieceDeal`, `discountPercent`, `formatPercent`.
- Produces: `PurchasePanel({ product, initialColorId?, initialSize? })`; `ProductDetail({ product, selection? })`
  where `selection: { colorId?: string; size?: string }` comes from the page's `searchParams` (`color`, `size`).
  The price block keeps the class `detail-price` and its place above the buy box.

- [ ] **Step 1: Write the failing tests** in `last-piece-price.spec.ts` (phone 390 and desktop):
  - `/product/shomiz-06`: the price is «۸۰۴٬۰۰۰ تومان» and the line «تا ۲۰٪ تخفیف روی رنگ و سایزهای تک‌دونه» shows;
    after «رنگ مشکی» the L button's name ends with «، با تخفیف آخرین دونه» and shows «٪»; after «سایز L» the price is
    «۶۴۳٬۰۰۰ تومان» with «۸۰۴٬۰۰۰» struck and «۲۰٪ تخفیف آخرین دونه»; after «سایز M» it is «۸۰۴٬۰۰۰ تومان» with no
    struck price; the phone purchase bar shows the same price in both states.
  - `/product/shomiz-06?color=black&size=L` starts with black and L pressed and the discounted price.
  - `?color=nope&size=XXL` starts with nothing chosen; `?color=black&size=S` where black S is sold out starts with
    black only; no console errors.
  - `/product/tshirt-05?color=cream&size=M` shows «۴۲۴٬۰۰۰ تومان» with «۵۳۰٬۰۰۰» struck.
  - `/product/shomiz-04` (its only variant left) shows «۵۷۴٬۰۰۰ تومان» before any choice.
- [ ] **Step 2: Run** the spec — expected: FAIL.
- [ ] **Step 3: Implement.** The page reads `searchParams` and passes `selection`; `ProductDetail` drops its price
  block and passes the selection on; `PurchasePanel` renders the price block first (offer of the chosen variant;
  before a full choice, `lastPieceDeal.everyVariant ? deal.offer : catalog price`, plus the line when a deal exists
  and not every variant), validates the initial selection against in-stock variants, marks qualifying sizes, and uses
  the chosen offer in the sticky bar.
- [ ] **Step 4: Run** the spec, `tests/pdp.spec.ts`, `tests/store.spec.ts`, `tests/single-layout.spec.ts` — expected: PASS.
- [ ] **Step 5: Commit** `feat(pdp): variant price, last-piece marks and preselection from the address`.

### Task 7: Listings

**Files:**
- Modify: `src/components/products/product-card.tsx` (`ProductCardData` gains `deal?: LastPieceDeal | null`),
  `src/lib/shop-by-color.ts`, `src/styles/catalog.css`
- Test: `tests/last-piece-price.spec.ts`, `tests-unit/shop-by-color.test.ts`

**Interfaces:**
- Consumes: `lastPieceDeal`.
- Produces: a card computes `deal = product.deal ?? (product.variants ? lastPieceDeal(product) : null)`; with
  `everyVariant` it shows `deal.offer` as price and «X٪ تخفیف» as its tag; otherwise the catalog price and the line
  `.product-deal` «تا X٪ تخفیف روی رنگ و سایزهای تک‌دونه». Shop-by-colour previews carry `deal`.

- [ ] **Step 1: Write the failing tests.** E2E on `/shop?category=shomiz`: shomiz-06's card shows «۸۰۴٬۰۰۰ تومان»,
  no `del`, and the line; shomiz-04's card shows «۵۷۴٬۰۰۰ تومان», «۷۱۸٬۰۰۰» struck and «۲۰٪ تخفیف»; `/shop?sale=1`
  lists shomiz-06. Unit: a shop-by-colour preview of shomiz-06 has `deal.percent === 20`.
- [ ] **Step 2: Run** them — expected: FAIL.
- [ ] **Step 3: Implement** the card and the preview field; the line is `--text-xs`, Kasra red, under the price.
- [ ] **Step 4: Run** them plus `tests/shop-by-color.spec.ts`, `tests/discovery.spec.ts` — expected: PASS.
- [ ] **Step 5: Commit** `feat(catalog): show last-piece deals on cards without implying every variant`.

### Task 8: The rail and the «مشاهده همه» page

**Files:**
- Modify: `src/lib/last-pieces.ts`, `src/components/home/last-pieces.tsx`, `src/components/home/last-pieces-arrows.tsx`
  (selectors; shown on every device), `src/styles/home.css`, `DESIGN.md`
- Create: `src/components/home/last-piece-card.tsx`, `src/components/home/last-piece-stamp.tsx`, `src/app/last-pieces/page.tsx`
- Test: `tests-unit/last-pieces.test.ts`, `tests/last-pieces.spec.ts`

**Interfaces:**
- Consumes: `offerFor`, `discountPercent`, `getCatalogProducts`.
- Produces:
  - `type LastPiece = { key: string; slug: string; name: string; image: string; color: { id: string; name: string; hex: string }; size: string; offer: Offer; percent: number; href: string }`
    with `href = '/product/' + slug + '?color=' + encodeURIComponent(color.id) + '&size=' + encodeURIComponent(size)`
  - `getLastPieces(products: Product[], limit?: number): { items: LastPiece[]; total: number; maxPercent: number }`
    — every variant at stock 1 whose colour is in `product.colors`; order: product `createdAt` desc, then colour
    order, then size order; `percent` is 0 when the offer is not lowered
  - `LastPieceCard({ piece })` — the white card of the spec's visual direction
  - `LastPieceStamp()` — the scalloped stamp SVG (`aria-hidden`)
  - `/last-pieces`: `export const dynamic = 'force-dynamic'`, metadata via `pageMetadata({ path: '/last-pieces', … })`

- [ ] **Step 1: Write the failing tests.** Unit: the demo gives the nine pieces in the fixture order with their
  prices; a variant whose colour is not in `colors` is skipped; with a deeper own sale `percent === 0` and
  `maxPercent` ignores it; `limit` 10 caps `items` but not `total`; `href` for shomiz-06 is
  `/product/shomiz-06?color=black&size=L`. E2E (`last-pieces.spec.ts`, rewritten): the region «آخرین دونه‌ها» sits
  between the arrivals and shop by colour with nine `.last-piece-card`s; the first is شومیز نخی دریا, «سفید»,
  «M», «۲۰٪ تخفیف», «۵۷۴٬۰۰۰ تومان» with «۷۱۸٬۰۰۰» struck; the band's background is `rgb(181, 31, 43)` and the stamp
  sits beside the title; clicking manto-08's cream XL card
  opens its product with cream and XL pressed; «مشاهده همه» → `/last-pieces` with nine cards and «۹ دونه»; the arrow
  tests carried over, now also on a touch phone (the arrows are shown there too); the 320/390 swipe test (no page
  overflow, a second card visibly cut); serious/critical axe findings: none on both pages.
- [ ] **Step 2: Run** `npx tsx --test tests-unit/last-pieces.test.ts`; build; the spec — expected: FAIL.
- [ ] **Step 3: Implement** the spec's visual direction: the edge-to-edge Kasra-red band, the title row with the
  stamp popping out of the band's top edge, the white cards (photo, pill on the photo's edge, name, colour and size,
  prices at the inline end), the arrows on every device, the stamp's edge turning with page scroll inside
  `@supports (animation-timeline: scroll())` and `(prefers-reduced-motion: no-preference)`, press feedback
  `scale(.98)`; `/last-pieces` as a two-column grid of the same cards under a light page heading with the line and
  the empty state. Update `DESIGN.md` (home sections).
- [ ] **Step 4: Run** the unit and E2E specs plus `tests/single-layout.spec.ts`, `tests/a11y.spec.ts`,
  `tests/mobile-v9.spec.ts`, `npm run test:unit` — expected: PASS. Take phone and desktop screenshots and check them
  against the spec's visual direction.
- [ ] **Step 5: Commit** `feat(home): «آخرین دونه‌ها» per variant on a clothes rail, and the see-all page`.

### Task 9: The admin section, and the release checks

**Files:**
- Create: `src/components/admin/last-piece-discount.tsx`
- Modify: `src/components/admin/admin-dashboard.tsx` (section `{ id: 'last-piece', label: 'تخفیف آخرین دونه‌ها', permission: 'products:read', icon: Tag }`),
  `src/styles/admin.css`, `docs/STORE-INVENTORY.md` (one paragraph: what the setting does, that the counter is not affected)
- Test: `tests-admin/admin-panel.spec.ts`

**Interfaces:**
- Consumes: the admin API of Task 4 through `adminApi`; `can('products:price')` from the dashboard.
- Produces: `LastPieceDiscount({ canEdit, onUnsaved })`.

- [ ] **Step 1: Write the failing test** (admin E2E, real API): create and publish a product through the admin API as
  the counter test does (`POST /v1/admin/products` at 640,000 with white S stock 1 and white M stock 4, then
  `PATCH …/visibility`); the owner opens «تخفیف آخرین دونه‌ها», switches the setting on at «۲۵», saves, sees the
  white S line in the live list at «۴۸۰٬۰۰۰», and the storefront product page with `?color=white&size=S` at that
  price while white M stays at «۶۴۰٬۰۰۰»;
  typing «۷۵» shows an inline error and saves nothing; a staff user without `products:price` sees the form read-only;
  the owner switches it off and the storefront shows the catalog price again. The page has no serious axe findings.
- [ ] **Step 2: Run** `npx playwright test -c playwright.admin.config.ts -g "last-piece"` where the admin E2E stack can
  run locally (API + PostgreSQL as in Task 3); otherwise rely on CI's «Admin panel E2E» — expected: FAIL.
- [ ] **Step 3: Implement** the section in the style of `home-slider-manager.tsx` (load, dirty guard via `onUnsaved`,
  `Notice` for errors and success, read-only without `products:price`).
- [ ] **Step 4: Run** the release checks from `docs/RELEASING.md`: `npm run lint`, `npm run typecheck`, `npm test`,
  `npm --prefix backend run typecheck`, `npm run build`, the full `npx playwright test`, and the backend integration
  files — expected: all pass; report anything not run locally (WebKit, Garage-backed tests).
- [ ] **Step 5: Commit** `feat(admin): last-piece discount section` and push the branch; ask before opening a pull
  request.
