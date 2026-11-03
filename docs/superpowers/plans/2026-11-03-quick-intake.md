# Quick Goods Intake and Shop-Managed Categories Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A three-step «ورود کالا» (title → total → colour × size split → barcodes → print in place), saved by one
atomic server operation, plus a two-level category tree («دسته اصلی» → «زیردسته») the owner manages in the panel.

**Architecture:** One additive migration (categories table seeded with the owner's tree, a foreign key from
`products.category`, purchase cost on receipt lines, voiding on receipts). Two new Fastify route modules
(`category-routes.ts`, `intake-routes.ts`) reuse the stock/barcode helpers of `store-routes.ts`; pure logic shared by
panel and API lives in `src/lib/`. The panel gets an intake flow and a category manager as new dashboard sections,
the label printing code is split out so the intake prints in place, and the product editor loses its Latin fields.

**Tech Stack:** Next.js 16 / React 19 (client components), Fastify 5, PostgreSQL (pg), zod 4, node:test via tsx,
Playwright (admin E2E), lucide-react icons.

**Spec:** `docs/superpowers/specs/2026-11-03-quick-intake-design.md` (approved by the owner). Read it first; this plan
does not repeat its tables (seeded tree, palette rules, error list, UI copy).

## Global Constraints

- Migrations stay backward compatible with the previous release (rollbacks do not undo them); `012` only adds.
- No Latin input is ever required from the user; generated ids: product `p-` + 8 chars of `[0-9a-z]`, category
  `cat-` + 6 chars of `[0-9a-z]`, custom colours `c-1`, `c-2`, ….
- Persian (۰-۹) and Arabic-Indic (٠-٩) digits are accepted wherever a number or size is typed; amounts accept `٬`, `,`
  and spaces as grouping.
- Intake total 1–2,000 units; 1–120 colour/size lines; sale price 1–1,000,000,000 toman; purchase cost 0–1,000,000,000.
- Purchase cost is returned and accepted only for `products:price`.
- Every new admin endpoint is added to the proxy allowlist in `src/app/api/admin/[...path]/route.ts`; nothing else is
  reachable from the browser.
- Panel copy is Persian and RTL; touch targets ≥ 44 px; every new screen passes the existing axe check
  (`wcag2a`, `wcag2aa`) and fits a 390 px phone without horizontal overflow.
- Until sub-project 2, publishing is refused for categories other than `shomiz`, `manto`, `tshirt`.
- Actions logs are public: tests and scripts never print secrets or `.env` contents.
- Commit after every task on branch `claude/laughing-pascal-wtmehi`; commit messages end with the session's
  attribution lines.

## Review Focus

1. **Sizes typed with Persian digits or lower case** ("۴۰", "xl") must be the same size as "40" / "XL"; otherwise one
   size gets two barcodes. → `normalizeSize` tests (Task 2) and the intake integration test sending `'۴۰'` (Task 5).
2. **Amounts typed as «۱٬۲۵۰٬۰۰۰»** must parse to 1250000, and junk must not become 0. → `parseAmount` tests (Task 2).
3. **A restock colour written differently** ("مشكي " with Arabic ک/ی, extra space) must reuse the product's colour id
   and barcode. → `mergeColors` test (Task 2) and the restock integration test (Task 5).
4. **The response is lost after the server committed**; pressing «بارکد» again must return the same receipt, never add
   stock twice. → integration test with a repeated `clientRef` (Task 5) and the E2E that aborts the first response
   (Task 9); the panel keeps the same `clientRef` until the input changes.
5. **Two people restock the same product at once with the same new colour** must end with one colour and the summed
   stock. → concurrent intake integration test (Task 5).

---

### Task 1: Migration 012 — categories, foreign key, cost and voiding

**Files:**
- Create: `backend/sql/012_categories_intake.sql`
- Modify: `backend/src/db/migrate.ts` (append `'012_categories_intake'` to the version list)

**Interfaces:**
- Produces: tables/columns exactly as in the spec's «Data» section: `categories(id, parent_id, name, position, sizes,
  created_at)`, `products_category_fk`, `stock_receipt_items.unit_cost`, `stock_receipts.voided_at`, `voided_by`.

- [ ] **Step 1: Run the migration list test to see it fail after adding the file**

Create the SQL file (empty), then run: `cd backend && npx tsx --test tests/migrations.test.ts`
Expected: FAIL «a migration file is missing from src/db/migrate.ts».

- [ ] **Step 2: Write the migration and list it**

Header comment in the style of `011_last_piece_discount.sql` (additive, why the previous release ignores it). Seed
with `INSERT INTO categories(id,parent_id,name,position,sizes) VALUES … ON CONFLICT (id) DO NOTHING`, mains before
children, using the spec's seeded-tree table verbatim (ids, Persian names, size lists; positions 0,1,2… in table
order; legacy `shomiz`, `manto`, `tshirt` last with sizes `["S","M","L","XL"]`). Only then add the foreign key.

- [ ] **Step 3: Verify against a real database (twice, like CI)**

Start a throwaway PostgreSQL (scratchpad dir `$S`):
```bash
/usr/lib/postgresql/16/bin/initdb -D "$S/pg" -U kasra --auth=trust >/dev/null
/usr/lib/postgresql/16/bin/pg_ctl -D "$S/pg" -o "-p 5433 -k $S" -l "$S/pg.log" start
createdb -h 127.0.0.1 -p 5433 -U kasra kasra
```
Run: `cd backend && npm ci && DATABASE_URL=postgres://kasra@127.0.0.1:5433/kasra npm run db:migrate && npm run db:migrate && npm run db:seed`
then `psql -h 127.0.0.1 -p 5433 -U kasra kasra -Atc "SELECT count(*), count(parent_id) FROM categories"`
Expected: `20|12`. And `npx tsx --test tests/migrations.test.ts` PASS.
Upgrade path: `git worktree add "$S/main" origin/main`, then in `"$S/main/backend"` run `npm ci`, `db:migrate` and
`db:seed` against a second database `kasra_up`; back on this branch run `db:migrate` against `kasra_up`.
Expected: no error, and `SELECT count(*) FROM products p LEFT JOIN categories c ON c.id=p.category WHERE c.id IS NULL`
is `0`.

- [ ] **Step 4: Commit** — `feat(db): categories tree, receipt cost and voiding (migration 012)`

---

### Task 2: Shared pure logic — colours, sizes, amounts, ids

**Files:**
- Create: `src/lib/intake-colors.ts`, `src/lib/intake-split.ts`, `backend/src/admin/ids.ts`
- Test: `tests-unit/intake-colors.test.ts`, `tests-unit/intake-split.test.ts`, `backend/tests/ids.test.ts`

**Interfaces:**
- Produces (`src/lib/intake-colors.ts`):
  - `type ProductColorInput = { id: string; name: string; hex: string; familyId?: string }`
  - `const INTAKE_PALETTE: readonly ProductColorInput[]` — in this order: `black` مشکی `#34312f`; `white` سفید
    `#f6f3ed`; `cream` کرم `#e7d8c2`; `beige` بژ `#d9c4a5` (family `cream`); `gray` طوسی `#8c8c8a`; `navy` سرمه‌ای
    `#26324a` (family `blue`); `blue` آبی `#7c929d`; `brown` قهوه‌ای `#6b4a35`; `camel` شتری `#b08850` (family
    `cream`); `green` سبز `#84958a` (family `sage`); `red` قرمز `#a23b32`; `pink` صورتی `#b98a83` (family `rose`);
    `mustard` خردلی `#c79a2c`.
  - `colorKey(name: string): string` — `normalizePersian` from `src/lib/format.ts`.
  - `mergeColors(existing: ProductColorInput[], wanted: { name: string; hex: string; id?: string }[]):
    { colors: ProductColorInput[]; idOf(wanted: { name: string; id?: string }): string }` — keeps `existing` in
    order; for each wanted: its `id` if it names an existing colour; else an existing colour with the same key; else
    the palette entry with that key if its id is free (palette hex and family); else `c-N` with the smallest free N
    (trimmed name, given hex). Appended colours keep the wanted order.
- Produces (`src/lib/intake-split.ts`):
  - `MAX_INTAKE_UNITS = 2000`
  - `normalizeSize(size: string): string` — NFKC, Latin digits, trim, collapse spaces, Latin letters upper-cased.
  - `parseAmount(text: string): number | null` — Latin digits after removing `٬`, `,`, spaces; `null` for empty or
    any other character.
  - `splitStatus(total: number, counts: number[]): { assigned: number; remaining: number; over: number; complete: boolean }`
- Produces (`backend/src/admin/ids.ts`): `newProductId(): string`, `newCategoryId(): string` (from
  `crypto.randomBytes`, each byte mod 36 into `0-9a-z`).

- [ ] **Step 1: Write the failing tests**

```ts
// tests-unit/intake-colors.test.ts
it('reuses an existing colour written with Arabic letters or spaces', () => {
  const { colors, idOf } = mergeColors([{ id: 'jet', name: 'مشکی', hex: '#000000' }], [{ name: ' مشكي ', hex: '#111111' }]);
  assert.equal(colors.length, 1); assert.equal(idOf({ name: 'مشكي' }), 'jet');
});
it('takes palette ids and families, then c-1, c-2 for other names', () => {
  const { colors } = mergeColors([], [{ name: 'سرمه‌ای', hex: '#000000' }, { name: 'یشمی', hex: '#2e8b57' }, { name: 'لیمویی', hex: '#e5e500' }]);
  assert.deepEqual(colors.map(c => [c.id, c.familyId]), [['navy', 'blue'], ['c-1', undefined], ['c-2', undefined]]);
});
it('does not take a palette id the product already uses for another name', () => {
  const { colors } = mergeColors([{ id: 'black', name: 'ذغالی', hex: '#222222' }], [{ name: 'مشکی', hex: '#000000' }]);
  assert.equal(colors[1].id, 'c-1');
});
// tests-unit/intake-split.test.ts
it('normalizes sizes', () => { for (const [a, b] of [['۴۰', '40'], [' xl ', 'XL'], ['فری  سایز', 'فری سایز']]) assert.equal(normalizeSize(a), b); });
it('parses grouped Persian amounts and rejects junk', () => {
  assert.equal(parseAmount('۱٬۲۵۰٬۰۰۰'), 1250000); assert.equal(parseAmount('1,250,000'), 1250000);
  assert.equal(parseAmount(''), null); assert.equal(parseAmount('12a'), null);
});
it('reports remaining and over-count', () => {
  assert.deepEqual(splitStatus(10, [3, 4]), { assigned: 7, remaining: 3, over: 0, complete: false });
  assert.deepEqual(splitStatus(10, [6, 6]), { assigned: 12, remaining: 0, over: 2, complete: false });
  assert.equal(splitStatus(10, [10]).complete, true);
});
// backend/tests/ids.test.ts
it('generates ids the product and category schemas accept', () => {
  for (let i = 0; i < 200; i++) { assert.match(newProductId(), /^p-[0-9a-z]{8}$/); assert.match(newCategoryId(), /^cat-[0-9a-z]{6}$/); }
});
```

- [ ] **Step 2: Run to verify they fail** — `npm ci && npm run test:unit` and `cd backend && npm test`; Expected: FAIL (modules missing).
- [ ] **Step 3: Implement the three modules** with the signatures above.
- [ ] **Step 4: Run to verify they pass** — same commands; Expected: PASS.
- [ ] **Step 5: Commit** — `feat(intake): shared colour palette, size/amount parsing and id generation`

---

### Task 3: Backend input schemas

**Files:**
- Modify: `backend/src/admin/product-schema.ts`
- Test: `backend/tests/schemas.test.ts`, `backend/tests/product.test.ts`

**Interfaces:**
- Consumes: `normalizeSize`, `colorKey`, `MAX_INTAKE_UNITS` (Task 2).
- Produces:
  - `categoryId = z.string().regex(/^[a-z0-9][a-z0-9-]{1,39}$/)`
  - `productInput`: `category: categoryId`; `description`: `z.string().trim().max(4000)`; `material`, `fit`:
    `.trim().max(200)`; `care`: `.trim().max(1000)` (empty allowed); `sizes` items pass through `normalizeSize`.
  - `categoryInput = { name: trim 1–60, parentId?: categoryId | null, sizes?: normalized sizes, ≤ 30, unique }` (strict)
  - `categoryUpdate = { name: trim 1–60, sizes?: as above }` (strict)
  - `categoryOrderInput = { parentId: categoryId | null, ids: categoryId[] 1–100, unique }` (strict)
  - `intakeInput` and `type IntakeInput` exactly as the spec's `POST intake` block; `lines[].size` normalized;
    refinements: unique (`colorKey(colorName)`, size) pairs, sum of quantities ≤ `MAX_INTAKE_UNITS`.

- [ ] **Step 1: Write the failing tests** (in `schemas.test.ts`; adjust the existing «rejects malformed» list: remove
  `{ description: 'کوتاه' }` and replace `{ category: 'shoes' }` with `{ category: 'Shoes!' }`)

```ts
it('accepts a draft with empty texts and a seeded or generated category id', () => {
  assert.equal(valid({ description: '', material: '', fit: '', care: '', category: 'pants-bootcut' }), true);
  assert.equal(valid({ category: 'cat-k3x9q2' }), true);
});
it('intake: one line per colour and size, at most 2000 units, sizes normalized', () => {
  const base = { clientRef: randomUUID(), product: { name: 'بامبر چرم', categoryId: 'sweatshirt-bomber' }, price: 4_200_000,
    lines: [{ colorName: 'مشکی', hex: '#000000', size: '۴۰', quantity: 3 }] };
  const parsed = intakeInput.parse(base);
  assert.equal(parsed.lines[0].size, '40');
  assert.equal(intakeInput.safeParse({ ...base, lines: [...base.lines, { ...base.lines[0], colorName: 'مشكي', size: '40' }] }).success, false);
  assert.equal(intakeInput.safeParse({ ...base, lines: [{ ...base.lines[0], quantity: 2001 }] }).success, false);
  assert.equal(intakeInput.safeParse({ ...base, price: 0 }).success, false);
  assert.equal(intakeInput.safeParse({ ...base, product: { id: 'p-abc12345' } }).success, true);
});
it('category order lists unique ids', () => {
  assert.equal(categoryOrderInput.safeParse({ parentId: null, ids: ['skirt', 'skirt'] }).success, false);
});
```

- [ ] **Step 2: Run to verify they fail** — `cd backend && npm test`; Expected: FAIL.
- [ ] **Step 3: Implement the schema changes.**
- [ ] **Step 4: Run to verify they pass** — `cd backend && npm test && npm run typecheck`; Expected: PASS (fix
  `product.test.ts` only where it asserted the old rules).
- [ ] **Step 5: Commit** — `feat(admin-api): category and intake input schemas; drafts may leave texts empty`

---

### Task 4: Category routes, category rule on products, publishing rules

**Files:**
- Create: `backend/src/admin/category-routes.ts`
- Modify: `backend/src/admin/product-routes.ts` (POST/PUT category check, `saleBlocker`, list columns),
  `backend/src/admin/routes.ts` (register; `AUDIT_GROUPS` gains `'categories'`)
- Test: `backend/tests/integration/categories.integration.mjs` (new; same fixtures style as `store.integration.mjs`),
  `backend/tests/product.test.ts` (saleBlocker unit cases)

**Interfaces:**
- Consumes: `categoryInput`, `categoryUpdate`, `categoryOrderInput`, `categoryId` (Task 3); `newCategoryId` (Task 2).
- Produces:
  - `type CategoryNode = { id: string; name: string; parentId: string | null; position: number; sizes: string[]; products: number; children: CategoryNode[] }`
  - `categoryRoutes(app: FastifyInstance, check: Guard, opts: { invalidateCatalog?: () => Promise<void> }): Promise<void>`
    serving the spec's five category endpoints. `GET` → `{ items: CategoryNode[] }`; `POST` → `201 { category }`;
    `PUT categories/:id` → `{ category }`; `PUT categories/order` → `{ ok: true }` (`400 invalid_order` unless `ids`
    is exactly the current siblings of `parentId`); `DELETE` → `{ ok: true }` or `409 category_not_empty
    { products, children }`. `POST` with a parent that has a parent → `400 category_too_deep`; unknown parent →
    `400 unknown_category`; a sibling with the same `colorKey(name)` → `409 category_name_taken`.
    Audit: `categories.created|updated|reordered|deleted`.
  - `categoryProblem(db: Pick<PoolClient,'query'>, id: string): Promise<null | 'unknown_category' | 'category_not_leaf'>`
    (a leaf is a sub-category, or a main category with no children).
  - `export const SITE_CATEGORIES = ['shomiz', 'manto', 'tshirt'] as const` and
    `saleBlocker(product: { images: unknown[]; price: number; description: string; material: string; fit: string; care: string; category: string })`
    returning, in this order, `image_required_to_publish`, `price_required_to_publish`,
    `details_required_to_publish` (description < 10 chars or material/fit/care empty), `category_not_on_site_yet`.
    The visibility route selects the columns it needs.
  - `GET /v1/admin/products` rows gain `categoryName: string | null` and `parentCategoryName: string | null`
    (scalar subqueries, since the list groups by `p.id`).

- [ ] **Step 1: Write the failing tests**

`product.test.ts`: `saleBlocker` returns `details_required_to_publish` for a full product with `care: ''`, and
`category_not_on_site_yet` for `category: 'pants-bootcut'`, `null` for a complete `manto` product.
`categories.integration.mjs` (owner, manager, staff fixtures as in `store.integration.mjs`):
- `GET /v1/admin/categories` → 8 mains in seeded order; `women-pants` has 10 children; `women-pants.sizes` deep-equals
  `['36','38','40','42','44','46','48','50']`.
- create main «کیف» → 201 with id matching `/^cat-[0-9a-z]{6}$/`; child «کیف دستی» under it → 201; a grandchild → 400
  `category_too_deep`; same-name sibling «کیف » → 409 `category_name_taken`; staff → 403.
- rename and resize; reorder mains with the new one first → `GET` shows it first; reorder with a missing id → 400
  `invalid_order`.
- `POST /v1/admin/products` with `category: 'women-pants'` → 400 `category_not_leaf`; with `'nope-cat'` → 400
  `unknown_category`; with `'pants-bootcut'` and empty texts → 201 (a draft); with `'pants-bootcut'`, an uploaded
  image and full texts → 201, and publishing it → 409 `category_not_on_site_yet`; the same product moved to
  `manto` (PUT) publishes → 200.
- deleting `pants-bootcut` → 409 `category_not_empty` with `products >= 1`; deleting `women-pants` → 409 with
  `children: 10`; deleting the empty «کیف دستی» then «کیف» → 200.

- [ ] **Step 2: Run to verify they fail** — build and start the API against the Task 1 database
  (`cd backend && npm run build && DATABASE_URL=… TRUST_PROXY=true ORDER_TOKEN_SECRET=local_only_secret_long_enough_0123456789 MEDIA_DIR=$S/media node dist/index.js &`),
  then `DATABASE_URL=… node --test tests/integration/categories.integration.mjs`; Expected: FAIL (404s).
- [ ] **Step 3: Implement** `category-routes.ts`, the product-route changes, registration (next to `storeRoutes` in
  `routes.ts`, same arguments). Category writes lock the affected sibling rows `FOR UPDATE`; delete counts products
  in the same transaction as the delete; the foreign key is the last line of defence (map `23503` to
  `category_not_empty`).
- [ ] **Step 4: Run to verify they pass** — rebuild/restart the API; run the new file and `node --test --test-concurrency=1 tests/integration/*.mjs`
  (existing suites must stay green: they create `shomiz`/`tshirt` products with full texts). Expected: PASS.
- [ ] **Step 5: Commit** — `feat(admin-api): manage the category tree; products must sit in a leaf category`

---

### Task 5: Intake endpoint and receipt voiding

**Files:**
- Create: `backend/src/admin/intake-routes.ts`
- Modify: `backend/src/admin/store-routes.ts` (export helpers, `voidedAt`/`unitCost` in receipt reads, void route),
  `backend/src/admin/routes.ts` (register `intakeRoutes`)
- Test: `backend/tests/integration/intake.integration.mjs` (new)

**Interfaces:**
- Consumes: `intakeInput` (Task 3), `mergeColors`, `normalizeSize` (Task 2), `newProductId` (Task 2),
  `categoryProblem` (Task 4).
- Produces:
  - from `store-routes.ts`: `export async function ensureBarcodes(db, keys)`, `export const keyOf`,
    `export async function receiptDetail(db: Db, id: string, opts: { withCost: boolean }): Promise<ReceiptDetail | null>`
    with `type ReceiptDetail = { id: string; note: string | null; createdAt: string; actor: string | null; voidedAt: string | null; items: { productId: string; name: string; colorId: string; colorName: string | null; size: string; code: string; quantity: number; price: number | null; unitCost?: number | null }[] }`
    (`unitCost` present only when `withCost`). `GET stock-receipts` rows gain `voidedAt`.
  - `POST /v1/admin/stock-receipts/:id/void` (`inventory:write`) → `{ receipt: ReceiptDetail }`; `409
    receipt_already_voided`; `409 units_already_sold` with `items: { name, colorName, size, received, inStock }[]`
    (a removed variant counts as `inStock: 0`). Locks the receipt `FOR UPDATE`, then products/variants in the
    checkout order; audit `inventory.receipt_voided` with units.
  - `intakeRoutes(app, check, opts)`: `POST /v1/admin/intake` → `201 { receipt: ReceiptDetail; product: { id: string; name: string; created: boolean } }`,
    repeated `clientRef` → `200 { receipt, product, duplicate: true }`. Transaction steps and permission rules as in
    the spec («POST intake»). A new product gets `id = slug = newProductId()` (retry on `23505`, max 3).

- [ ] **Step 1: Write the failing tests** (`intake.integration.mjs`; owner, manager, and a manager with
  `revokes: ['products:price']` as fixtures)
- new product «بامبر چرم آزمایشی <run>» in `sweatshirt-bomber`, price 4,200,000, cost 2,600,000, lines مشکی/M×3,
  مشکی/L×2, کرم/M×4, کرم/L×1 → 201, `product.created === true`, product is a draft with colours `black`, `cream`,
  sizes `['M','L']`, 4 receipt items with valid EAN-13 codes summing to 10, variant stocks exactly as sent, and
  `GET stock-receipts/:id` shows `unitCost: 2600000` to the owner and no `unitCost` key to the revoked manager.
- the same body again (same `clientRef`) → 200 `duplicate: true`, same receipt id, stocks unchanged.
- a body whose second line has a category that is not a leaf (`women-pants`) → 400 `category_not_leaf`, and
  `SELECT count(*) FROM products WHERE name=$1` is 0 (nothing written).
- restock of that product with `' مشكي '` / `'۴۰'` ×2 and `'سبز'` / `'M'` ×1 → black colour id reused (no new colour
  named مشکی), size `'40'` appended, `green` colour appended with family `sage`, M/black stock still 3, `40`/black 2.
- revoked manager restocks at the current price → 201; at a different price → 403 `{ permission: 'products:price' }`;
  with `unitCost` → 403.
- **concurrency (Review Focus 5):** two intakes on the same product at once, both adding «یشمی» M ×2 → both 201, the
  product has exactly one colour named یشمی (`c-1`) with stock 4.
- **race with an online order:** publish a full `tshirt` product with 1 unit (direct API as in `store.integration.mjs`),
  run an intake +2 and a COD order for 1 concurrently → final stock 2.
- void the first receipt after one black/M is sold at the counter → 409 `units_already_sold` listing مشکی M with
  `received: 3, inStock: 2`; void a fresh receipt → 200, stock back, second void → 409 `receipt_already_voided`, and
  `GET stock-receipts` shows its `voidedAt`.

- [ ] **Step 2: Run to verify they fail** — rebuild/restart API; `node --test tests/integration/intake.integration.mjs`; Expected: FAIL.
- [ ] **Step 3: Implement** the exports, void route and `intake-routes.ts`. For a restock, lock the product
  `FOR UPDATE` before reading its colours (this serialises concurrent intakes of one product), merge colours with
  `mergeColors(product.colors, lines)`, append missing normalized sizes, `UPDATE products SET colors, sizes, price,
  search_text`, insert missing variants with stock 0, then lock the lines' variants ordered by product, colour, size
  and add quantities. Audit `products.created` (new), `products.price` (changed), `inventory.received` with
  `{ source: 'intake', units, unitCost }`.
- [ ] **Step 4: Run to verify they pass** — all integration files with `--test-concurrency=1`, `npm test`,
  `npm run typecheck`; Expected: PASS.
- [ ] **Step 5: Commit** — `feat(admin-api): one-step goods intake with barcodes and cost; void a receipt`

---

### Task 6: Proxy allowlist, error messages, audit labels

**Files:**
- Modify: `src/app/api/admin/[...path]/route.ts`, `src/components/admin/admin-api.ts`, `src/components/admin/labels.ts`,
  `src/components/admin/audit-log.tsx`
- Test: `tests-unit/api-routes.test.ts`

**Interfaces:**
- Produces (proxy): `GET categories`; `POST categories|intake|stock-receipts/<serial>/void`;
  `PUT categories/order|categories/<cat>`; `DELETE categories/<cat>` where `<cat>` is `[a-z0-9][a-z0-9-]{1,39}`.
- Produces (`MESSAGES`): Persian text for `unknown_category`, `category_not_leaf`, `category_too_deep`,
  `category_name_taken`, `category_not_empty`, `invalid_order`, `details_required_to_publish`,
  `category_not_on_site_yet` (the spec's sentences), `receipt_already_voided`, `units_already_sold`.
  `barcode_not_found` now names «ورود کالا».
- Produces (`labels.ts`): `AUDIT_ACTION` for the four `categories.*` actions and `inventory.receipt_voided`;
  `AUDIT_GROUP.categories = 'دسته‌بندی‌ها'`. (The draft label and the `CATEGORY` map change in Task 10, together with
  the tests that read them.)

- [ ] **Step 1: Write the failing test** — in «forwards only allow-listed endpoints», add to the 404 list
  `['DELETE', 'categories/Bad_Id']`, `['PUT', 'categories']`, `['POST', 'stock-receipts/0/void']`; add a test that
  `POST intake`, `PUT categories/order`, `DELETE categories/cat-k3x9q2` and `POST stock-receipts/12/void` reach
  `API + '/v1/admin/…'` with the same method.
- [ ] **Step 2: Run to verify it fails** — `npm run test:unit`; Expected: FAIL.
- [ ] **Step 3: Implement** the allowlist, messages and labels; `audit-log.tsx` describes `inventory.receipt_voided`
  («رسید N · M عدد از موجودی برگشت») and `categories.*` (the category name).
- [ ] **Step 4: Run to verify it passes** — `npm run test:unit && npm run typecheck && npm run lint`; Expected: PASS.
- [ ] **Step 5: Commit** — `feat(admin): allow the category, intake and void endpoints through the proxy`

---

### Task 7: Label printing as a reusable module

**Files:**
- Create: `src/components/admin/labels/label-print.tsx`
- Modify: `src/components/admin/label-sheet.tsx` (uses the module; voided receipt notice), `src/styles/admin.css`
  (print rules for in-page printing)

**Interfaces:**
- Produces:
  - `FORMATS`, `type Format`, `type LabelItem = { code: string; name: string; colorName: string | null; size: string; price: number | null; count: number }`
  - `BarcodeSvg({ code, module })` (moved unchanged)
  - `useLabelPrefs(): { format: Format; setFormat(f: Format): void; custom: { width: string; height: string }; setCustom(…): void; price: boolean; setPrice(b: boolean): void; size: { width: number; height: number } }`
    (same `localStorage` key `kasra-label-prefs`, same clamping as today)
  - `LabelOptions(props: ReturnType<typeof useLabelPrefs> & { skip?: string; setSkip?: (s: string) => void })` — the
    current form controls and print reminder.
  - `LabelPreview({ items, prefs, skip }: { items: LabelItem[]; prefs: ReturnType<typeof useLabelPrefs>; skip?: number })`
    — the sheets, `@page` style included.
  - `PrintLabelsButton({ items, prefs, label }: { items: LabelItem[]; prefs: …; label: string })` — renders, only
    while printing, a portal into `document.body` with `.label-print-root` (holding `LabelPreview`), adds
    `kasra-printing-labels` to `body`, calls `window.print()` after paint, and removes both on `afterprint`.
- CSS: `.label-print-root { display: none }`; `@media print { body.kasra-printing-labels > :not(.label-print-root) { display: none !important } body.kasra-printing-labels .label-print-root { display: block } }`.

- [ ] **Step 1: Refactor `LabelSheet`** onto the module without behaviour change; for a receipt with `voidedAt`, show
  `<Notice tone="warning">این ورود ابطال شده است.</Notice>` and no print button.
- [ ] **Step 2: Verify** — `npm run typecheck && npm run lint && npm run build`; Expected: PASS. The existing
  label assertions in the admin E2E (50 × 25 mm PDF pages) are re-run in Task 9.
- [ ] **Step 3: Commit** — `refactor(admin): label printing as a module that can print in place`

---

### Task 8: Categories in the panel

**Files:**
- Create: `src/components/admin/categories/use-categories.ts`, `src/components/admin/categories/category-picker.tsx`,
  `src/components/admin/categories/category-manager.tsx`, `src/styles/admin-intake.css` (imported in
  `src/app/admin/layout.tsx` after `admin.css`)
- Modify: `src/components/admin/admin-dashboard.tsx`
- Test: `tests-admin/admin-panel.spec.ts`

**Interfaces:**
- Consumes: category endpoints (Task 4), messages (Task 6).
- Produces:
  - `type CategoryNode` (same shape as the API's), `useCategories(): { items: CategoryNode[] | null; error: string; reload(): void }`
  - `categoryPath(items: CategoryNode[], id: string): string` — `'شلوار زنانه › شلوار بوتکات زنانه'`, or the name of a
    main category, or the id when unknown.
  - `sizesFor(items: CategoryNode[], id: string): string[]` — the main category's sizes (a child uses its parent's).
  - `CategoryPicker({ items, value, onChange, canCreate, onCreated }: { items: CategoryNode[]; value: string | null; onChange(id: string): void; canCreate: boolean; onCreated(): void })`
    — main categories as a radio group of large buttons, then the chosen one's children as a second radio group;
    «+ زیردسته‌ی جدید» opens an inline name field (POST, then `onCreated` and select it).
  - `CategorySelect({ items, value, onChange, id }: { items: CategoryNode[]; value: string; onChange(id: string): void; id: string })`
    — `<select>` with `<optgroup>` per main category (leaf mains as plain options).
  - `CategoryManager({ canEdit }: { canEdit: boolean })` — the spec's «دسته‌بندی‌ها» screen. Buttons carry accessible
    names: `'افزودن زیردسته به ' + name`, `'تغییر نام ' + name`, `'انتقال ' + name + ' به بالا'`, `'… به پایین'`,
    `'حذف ' + name`, `'سایزهای ' + name`.
  - Dashboard: `Section` gains `'categories'`; `SECTIONS` in the spec's «Navigation» order; labels «ورود کالا»
    (`receiving`) and «محصولات» (`products`, title «محصولات»), new `{ id: 'categories', label: 'دسته‌بندی‌ها',
    title: 'دسته‌بندی‌ها', permission: 'products:read', icon: FolderTree }`.

- [ ] **Step 1: Write the failing E2E test** `test('owner manages categories: seeded tree, add, rename, order, delete only when empty', …)`:
  open «دسته‌بندی‌ها»; expect a card «شلوار زنانه» containing «شلوار بوتکات زنانه» and the size chips ۳۶…۵۰; add main
  «کیف»; add «کیف دستی» to it; rename to «کیف دوشی»; move «کیف» up and expect it before «تیشرت»; `حذف کیف` shows the
  `category_not_empty` alert; delete «کیف دوشی» then «کیف»; staff see the section read-only (no «افزودن» buttons);
  axe on `.admin-app` is clean; screenshot `categories-desktop`. Also replace every `'محصولات و موجودی'` and
  `'ورود کالا و برچسب'` in the spec file (tab labels and level-1 headings) with `'محصولات'` and `'ورود کالا'`, and
  add `['دسته‌بندی‌ها', 'categories']` to both viewport loops.
- [ ] **Step 2: Run to verify it fails** — local admin E2E (PostgreSQL from Task 1, fresh database, `db:migrate` +
  `db:seed`, `cd backend && npm run build`, `NEXT_PUBLIC_BACKEND_ENABLED=true NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3000 npm run build`,
  then `DATABASE_URL=… ORDER_TOKEN_SECRET=… MEDIA_DIR=$S/media npx playwright test -c playwright.admin.config.ts -g "categories"`);
  Expected: FAIL.
- [ ] **Step 3: Invoke `frontend-design:frontend-design`, then implement** the components and CSS (`.admin-category-*`
  classes in `admin-intake.css`, built on the tokens in `admin.css`).
- [ ] **Step 4: Run to verify it passes** — the same command, then the phone-layout and viewport-matrix tests
  (`-g "phone layout|viewport"`); Expected: PASS.
- [ ] **Step 5: Commit** — `feat(admin): «دسته‌بندی‌ها» — the owner's category tree in the panel`

---

### Task 9: The intake flow («ورود کالا»)

**Files:**
- Create in `src/components/admin/intake/`: `intake-flow.tsx`, `step-what.tsx`, `step-split.tsx`,
  `step-barcodes.tsx`, `color-size-picker.tsx`, `receipt-list.tsx`
- Modify: `src/components/admin/admin-dashboard.tsx` (`receiving` renders `IntakeFlow`), `src/styles/admin-intake.css`
- Delete: `src/components/admin/stock-receiving.tsx` (its receipts list moves to `receipt-list.tsx`)
- Test: `tests-admin/admin-panel.spec.ts`

**Interfaces:**
- Consumes: `POST intake`, `GET products?q=`, `GET products/:id`, `GET barcodes/:code`, `stock-receipts` (+ void);
  `CategoryPicker`, `useCategories`, `sizesFor` (Task 8); the intake sends colour names and the server merges them;
  `INTAKE_PALETTE`, `colorKey` (Task 2); `normalizeSize`, `parseAmount`, `splitStatus`, `MAX_INTAKE_UNITS` (Task 2);
  `LabelOptions`, `LabelPreview`, `PrintLabelsButton`, `useLabelPrefs`, `BarcodeSvg` (Task 7); `ScanField`,
  `barcodeProblem` (`scan-field.tsx`); `newClientRef` (`admin-api.ts`).
- Produces:
  - `IntakeFlow({ permissions, onUnsaved, openEditor }: { permissions: string[]; onUnsaved(q: string | null): void; openEditor(productId: string): void })`
    — dashboard passes `openEditor = id => show({ section: 'products', editor: id, q: '' })`.
  - `ColorPicker({ value, onChange, preferred }: { value: { name: string; hex: string; id?: string }[]; onChange(v): void; preferred?: ProductColorInput[] })`
    and `SizePicker({ value, onChange, options }: { value: string[]; onChange(v: string[]): void; options: string[] })`
    — toggle buttons with `aria-pressed`, «رنگ دیگر» / «سایز دیگر» inline fields; reused by the editor in Task 10.
  - `ReceiptList({ version, canVoid }: { version: number; canVoid: boolean })` — today's receipts table plus
    «ابطال‌شده» badge and `'ابطال ورود ' + n` button (confirm dialog, then the `units_already_sold` items as a list).
- Behaviour fixed by the spec's «The intake flow» section (fields, labels, progress copy, enabled rules, step 3
  actions). Grid cell inputs are labelled `'تعداد ' + colour + ' سایز ' + size`; the progress line has
  `role="status"`; the primary step buttons are «بعدی», «بارکد», «چاپ N برچسب» (N in Persian digits).
- Submission keeps one `clientRef` per distinct request body (as `stock-receiving.tsx` does with `attempt`), so a
  retry after a lost response sends the same ref.

- [ ] **Step 1: Write the failing E2E tests.** In `'goods arrive with barcode labels…'`, replace the receiving part
  with a restock in «ورود کالا»: title `COUNTER_NAME` → pick it → total ۳ → سفید M 3 → «بارکد»; take `code` from
  the single barcode card and keep the label-PDF, counter, hold and website-stock assertions as they are (labels
  printed with «چاپ ۳ برچسب» on the same page). Then add:
  1. `test('intake: 10 leather bombers by colour and size, all barcodes shown, 10 labels printed', …)` — manager:
     «ورود کالا» → «عنوان یا بارکد» «بامبر چرم آزمایشی» → «محصول جدید» → category «سویشرت و بامبر جکت» → price
     `۴٬۲۰۰٬۰۰۰` → cost `2600000` → total `۱۰` → «بعدی» → colours مشکی, کرم → sizes M, L → cells 3, 2, 4 → progress
     reads «۹ از ۱۰ — ۱ عدد مانده» and «بارکد» is disabled → last cell 1 → «۱۰ از ۱۰» → «بارکد» → 4 cards
     (`.intake-barcode-card`) with 13-digit codes matching `/^20\d{11}$/` → «چاپ ۱۰ برچسب»: emulate print and assert
     10 `.label-print-root .label` elements and the PDF has 10 pages of 50 × 25 mm (reuse the existing PDF checks) →
     the product list shows «بامبر چرم آزمایشی» with «فقط فروشگاه» and «۱۰ عدد»; axe clean on all three steps;
     screenshots `intake-step1/2/3-desktop`.
  2. `test('intake: restock by scanning a label keeps barcodes; a lost response is not counted twice', …)` — scan the
     black M code from test 1 into «عنوان یا بارکد» (Persian digits) → the product is picked and its category shown
     → total 2 → black M 2 → intercept `**/api/admin/intake` with `route.fetch()` then `route.abort()` once → error
     notice → press «بارکد» again → success with the same black M code; API stock of black M is 5, not 7.
  3. `test('intake: a wrong intake is voided before anything is sold', …)` — new product, 1 unit, «ابطال این ورود»,
     confirm → list shows «ابطال‌شده»; the product remains with «۰ عدد».
  4. Phone (390 px): the three steps without horizontal overflow; step 2 shows one card per colour.
- [ ] **Step 2: Run to verify they fail** — `npx playwright test -c playwright.admin.config.ts -g "intake"`; Expected: FAIL.
- [ ] **Step 3: Invoke `frontend-design:frontend-design`, then implement** the flow and styles (`.intake-*` classes):
  a step header that shows the three steps and the current one (`aria-current="step"`), large chips, steppers,
  barcode cards that look like the printed label.
- [ ] **Step 4: Run to verify they pass** — the whole admin suite `npx playwright test -c playwright.admin.config.ts`;
  Expected: PASS.
- [ ] **Step 5: Commit** — `feat(admin): «ورود کالا» — title, total, colour × size split, barcodes and print in one screen`

---

### Task 10: Simpler products list and editor («تکمیل برای سایت»)

**Files:**
- Modify: `src/components/admin/product-list.tsx`, `src/components/admin/product-editor.tsx`,
  `src/components/admin/admin-dashboard.tsx` («افزودن محصول» → `go('receiving')`)
- Test: `tests-admin/admin-panel.spec.ts`

**Interfaces:**
- Consumes: `categoryName`/`parentCategoryName` on list rows (Task 4); `CategorySelect`, `useCategories`, `sizesFor`
  (Task 8); `ColorPicker`, `SizePicker` (Task 9); `mergeColors` (Task 2, client-side here to build the payload's
  colour ids); `saleBlocker` messages (Task 6).
- Produces:
  - `labels.ts`: `PRODUCT_STATUS.draft.label = 'فقط فروشگاه'`; `CATEGORY` deleted; the list's status filter option
    reads «فقط فروشگاه (پیش‌نویس)».
  - List: category cell `parentCategoryName ? parent + ' › ' + name : name`; for `status === 'draft'` the edit button
    reads «تکمیل برای سایت» with `aria-label={'تکمیل برای سایت ' + name}`.
  - Editor: no visible id/slug/colour-id fields outside a `<details>` «تنظیمات پیشرفته» that holds «آدرس محصول
    (slug)» (editable) and shows the id; a copy gets `newProductId()`-shaped ids generated client-side
    (`'p-' + 8 chars` via `crypto.getRandomValues`); category by `CategorySelect` labelled «دسته‌بندی»; colours by
    `ColorPicker`, sizes by `SizePicker` (options `sizesFor(category)` plus the product's own); the stock fieldset
    legend «اصلاح موجودی (بعد از شمارش)»; texts not `required` on drafts; a published product or a publish attempt
    shows the API's `details_required_to_publish` / `category_not_on_site_yet` message.

- [ ] **Step 1: Update the failing E2E tests**
  - `'owner creates a draft with photos…'` now starts in «ورود کالا» (new product `PRODUCT_NAME`, category «مانتو»,
    price ۱۲۵۰۰۰۰, total 7, مشکی M 5 / L 2), then «تکمیل برای سایت» → in «تنظیمات پیشرفته» set «آدرس محصول (slug)»
    to `PRODUCT` → compare-at, description, material, fit, care, two photos → save → publish → storefront assertions
    unchanged.
  - `'product editor: unsaved changes…'`: the editor URL matches `/edit=p-[0-9a-z]{8}/`; the copy check asserts the
    name «(کپی)», stock 0, and that saving creates a second «فقط فروشگاه» row with ۷ عدد (drop the Latin-id and colour-id
    assertions).
  - New: publishing a product of «شلوار بوتکات زنانه» from the list shows the `category_not_on_site_yet` sentence.
  - Every remaining `'پیش‌نویس'` badge assertion in the file reads `'فقط فروشگاه'`.
- [ ] **Step 2: Run to verify they fail** — `npx playwright test -c playwright.admin.config.ts -g "draft with photos|product editor|not on the site"`; Expected: FAIL.
- [ ] **Step 3: Implement** the list and editor changes (remove `CATEGORY` uses).
- [ ] **Step 4: Run to verify they pass** — the whole admin suite; Expected: PASS.
- [ ] **Step 5: Commit** — `feat(admin): products list and editor without Latin fields; «تکمیل برای سایت»`

---

### Task 11: Documentation and full verification

**Files:**
- Modify: `docs/STORE-INVENTORY.md` (receiving section, API table, permissions, Persian short guide «وقتی جنس
  می‌رسد» rewritten for «ورود کالا», voiding, categories, the rollback note from the spec), `README.md` only where it
  names «ورود کالا و برچسب».

- [ ] **Step 1: Update the docs.**
- [ ] **Step 2: Run every check from `docs/RELEASING.md`** — `npm run lint`, `npm run typecheck`, `npm test`,
  `npm --prefix backend run typecheck`, `npm run build`, all backend integration files, the full admin Playwright
  suite; Expected: all PASS (paste the summary lines into the PR description).
- [ ] **Step 3: Review the screenshots** in `artifacts/screenshots/` (intake steps desktop + phone, categories) and
  send the owner the three intake screenshots.
- [ ] **Step 4: Commit and push** — `docs: «ورود کالا» and categories in the store inventory guide`; then
  `superpowers:finishing-a-development-branch` (pull request only when the owner asks; deployment only after the
  approval summary in `docs/RELEASING.md` and the owner's own approval in GitHub).
