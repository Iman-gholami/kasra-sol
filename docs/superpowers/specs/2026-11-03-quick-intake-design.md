# Quick goods intake with barcodes, and categories the shop manages — design

Status: **approved by the owner** (2026-11-03). Implementation plan:
`docs/superpowers/plans/2026-11-03-quick-intake.md`, reviewed by the owner before any code.

This is sub-project **1 of 3** agreed with the owner:

1. **This spec**: categories in the back office + quick goods intake («ورود کالا») with barcodes and printing.
2. Categories on the website: menu, category pages and filters follow the owner's tree (own spec, before the first
   product of a new category is published).
3. Accurate reports: stock, units sold (website + counter), revenue and profit per size, product, sub-category and
   main category (own spec).

## خلاصه برای صاحب فروشگاه

- منوی پنل یک صفحه‌ی **«ورود کالا»** دارد با سه قدم:
  ۱) عنوان (یا اسکن برچسب یک تکه‌ی قدیمی)، دسته، قیمت فروش، قیمت خرید (اختیاری) و تعداد کل؛
  ۲) انتخاب رنگ‌ها و سایزها با دکمه و تقسیم تعداد کل در جدول رنگ × سایز («۷ از ۱۰ — ۳ عدد مانده»)؛ دکمه‌ی «بارکد»
  فقط وقتی جمع جدول با تعداد کل برابر است فعال می‌شود؛
  ۳) با «بارکد» همه‌چیز یک‌جا ثبت می‌شود و همه‌ی بارکدها مرتب نمایش داده می‌شوند؛ بعد «چاپ ۱۰ برچسب» از همان صفحه.
- **بارکد** برای هر محصول + رنگ + سایز یکی است (شلوار مشکی ۴۰ و ۴۴ دو بارکد جدا؛ سه تا مشکی ۴۰ یک بارکد و سه برچسب).
- محصول تازه اول **«فقط فروشگاه»** است (صندوق همان لحظه می‌فروشد)؛ عکس و توضیح بعداً با «تکمیل برای سایت».
- صفحه‌ی **«دسته‌بندی‌ها»**: دسته اصلی ← زیردسته، با فهرستی که فرستادید از روز اول؛ افزودن، تغییر نام، ترتیب، حذف
  (فقط دسته‌ی خالی) و فهرست سایزهای هر دسته اصلی.
- **قیمت خرید** فقط برای مدیرها دیده می‌شود و برای گزارش سود (بخش ۳) نگه داشته می‌شود.
- **ابطال ورود** برای اشتباه، تا وقتی چیزی از آن سری فروش نرفته.
- هیچ‌جا تایپ انگلیسی لازم نیست؛ شناسه‌ها خودکار ساخته می‌شوند.
- محدودیت موقت: محصولات دسته‌های جدید تا بخش ۲ فقط در فروشگاه فروخته می‌شوند.

## Goal

Goods arrive (say 10 leather bombers). The owner types a title, the total, splits the total by colour and size,
presses «بارکد», sees every barcode, and prints the labels, in one screen, in a minute or two, on a computer or a
phone, without typing Latin text. The units are in the one shared stock at once, so the counter and (once published)
the website sell from it. Every product sits in the owner's category tree, so sub-project 3 can report per size,
product, sub-category and main category.

## Decisions

| Question | Decision |
| --- | --- |
| Barcode granularity | **One code per product + colour + size**, unchanged (`variant_barcodes`). Same colour and size → same code; a sale takes one unit. |
| Website at intake | **No.** A new product is created as a draft («فقط فروشگاه»); the counter sells it immediately. «تکمیل برای سایت» adds photos and text later. |
| Categories | **Managed in the back office**, two levels: «دسته اصلی» → «زیردسته». Seeded with the owner's tree. |
| Purchase price | **Optional, per unit, per intake**; visible and editable only with `products:price`. |
| How it is saved | **One atomic, idempotent server operation** (`POST /v1/admin/intake`): product, colours/sizes, stock, receipt, barcodes and cost commit together or not at all. |
| Old «ورود کالا و برچسب» screen | **Replaced** by «ورود کالا». Restocking an existing product is the same flow (title search or scan). Receipts stay listed and reprintable. |
| Product editor | Kept for «تکمیل برای سایت» and corrections, simplified (below). «افزودن محصول» opens «ورود کالا». |

## The intake flow («ورود کالا»)

Permission to open it: `inventory:write` (owner and managers by default). A new product additionally needs
`products:write` and `products:price` (it sets a price); changing an existing product's price or entering a
purchase price needs `products:price`. Fields the account may not change are shown read-only with the reason.

### Step 1 — «چی رسیده؟»

- **«عنوان یا بارکد»**: one field. Typing searches existing products (`GET products?q=`, 6 results, debounced);
  each suggestion shows name, category and current stock. Picking one means **restock**. A scanner's 13 digits +
  Enter (Persian digits accepted) look the label up (`GET barcodes/:code`) and pick its product. When nothing is
  picked, the title creates a **new product** («محصول جدید: بامبر چرم»).
- **«دسته»** (new product only): main categories as large buttons, then that category's sub-categories. A main
  category with sub-categories needs one of them; one without is chosen directly. «+ زیردسته‌ی جدید» adds a
  sub-category in place (`POST categories`, needs `products:write`). For a restock the category is shown, not asked.
- **«قیمت فروش (تومان)»**: required, above zero (the counter refuses a sale without a price). Prefilled for a restock.
  Thousands are grouped while typing; Persian or Latin digits.
- **«قیمت خرید هر عدد (اختیاری)»**: only for `products:price`.
- **«تعداد کل»**: 1–2,000 (the most labels one print run prepares), with − / + buttons.
- «بعدی» validates and moves on; errors are shown next to the field, in Persian.

### Step 2 — «تقسیم بر اساس رنگ و سایز»

- **Colours**: toggle buttons from a fixed palette (each with its swatch), plus «رنگ دیگر» (a Persian name and a
  swatch picker). For a restock the product's own colours come first.
- **Sizes**: the main category's size list as toggle buttons (e.g. pants 36…50; others فری‌سایز, S…XXL), plus
  «سایز دیگر». For a restock the product's own sizes come first.
- **Grid**: one row per chosen colour, one column per chosen size; each cell a number with − / +. On a narrow screen
  (< 640 px) the grid becomes one card per colour with its sizes stacked.
- **Progress line** above the grid: «۷ از ۱۰ — ۳ عدد مانده» / «۱۰ از ۱۰ ✓» / «۲ عدد بیشتر از تعداد کل», announced
  politely to screen readers.
- **«بارکد»** is enabled only when the grid's sum equals the total and every used colour has a name. «قبلی» returns
  to step 1 without losing anything.

### Step 3 — «بارکدها»

- Pressing «بارکد» sends the intake once (a client-generated `clientRef`; a retry or double click returns the same
  receipt). While it is sent, the button shows «در حال ثبت…».
- On success: a heading «۱۰ عدد بامبر چرم ثبت شد» and **one card per colour and size**: the barcode drawn on screen,
  its 13 digits, «مشکی · ۴۰», and «× ۳ برچسب». Cards keep the grid's order (colour, then size).
- **Printing, in the same page**: label type (the same four formats as `/admin/labels`, default 50 × 25 mm, the last
  choice remembered), «قیمت روی برچسب چاپ شود», then **«چاپ ۱۰ برچسب»** opens the browser's print dialog with only
  the labels (one per unit). The print reminder (margins None, scale 100%) stays.
- Then: **«ورود کالای بعدی»** (clears the form), **«تکمیل برای سایت»** (opens the product editor for this product),
  **«ابطال این ورود»** (see below).
- The form asks before leaving while steps 1–2 hold unsaved input (the dashboard's existing unsaved-changes guard).
- Below the flow: the receipts list as today (reprint any receipt), with voided receipts marked «ابطال‌شده».

### Voiding an intake («ابطال این ورود»)

For a mistake. Allowed while every line's colour/size still has at least the received units in stock (nothing of it
sold or ordered); otherwise refused with the items and how many are left. It takes the units back out, marks the
receipt voided, and keeps it in the list. A product created by that intake stays as a draft with no stock (it can be
archived from the products list). Available for any receipt, from the list too, to `inventory:write`.

## Categories («دسته‌بندی‌ها»)

A new menu item after «محصولات», visible with `products:read`, editable with `products:write`.

- One card per main category in order; its sub-categories listed under it. Each line shows its product count
  (all statuses).
- Actions: add a main category; add a sub-category to one; rename; move up / down within its level; edit a main
  category's size list (chips, add / remove / reorder); delete.
- **Delete only when empty**: no products and (for a main category) no sub-categories. Otherwise
  «این زیردسته ۸ محصول دارد؛ اول آن‌ها را به دسته‌ی دیگری ببرید.»
- Only two levels. Names 1–60 characters, unique among siblings.
- Category ids are generated (`cat-` + 6 random base-36 characters); the seeded ones are readable (below) for
  sub-project 2's addresses. Ids never change.

### Seeded tree (migration)

| Main category (id) | Sizes | Sub-categories (id) |
| --- | --- | --- |
| شلوار زنانه (`women-pants`) | 36, 38, 40, 42, 44, 46, 48, 50 | شلوار بگ، نیم‌بگ، سوپربگ، فلربگ زنانه (`pants-bag`) · شلوار بوتکات زنانه (`pants-bootcut`) · شلوار واید / جورتس / کاپری / ایزی / شلوارک زنانه (`pants-wide`) · شلوار پارچه‌ای زنانه (`pants-fabric`) · شلوار جاگر (`pants-jogger`) · شلوار خونگی / راحتی (`pants-home`) · شلوار دامنی زنانه (`pants-skirt`) · شلوار لگ / جوراب‌شلواری (`pants-leggings`) · شلوار راسته زنانه (`pants-straight`) · شلوار بالونی زنانه (`pants-balloon`) |
| دامن (`skirt`) | فری‌سایز, S, M, L, XL, XXL | — |
| بارانی و ترنچ کت زنانه (`trench`) | فری‌سایز, S, M, L, XL, XXL | — |
| هودی و دورس زنانه (`hoodie-dorce`) | فری‌سایز, S, M, L, XL, XXL | هودی زنانه (`hoodie`) · دورس زنانه (`dorce`) |
| سویشرت و بامبر جکت (`sweatshirt-bomber`) | فری‌سایز, S, M, L, XL, XXL | — |
| شومیز (`shomiz`), مانتو (`manto`), تیشرت (`tshirt`) | S, M, L, XL | — (the existing categories, last; deletable once empty) |

## Products list and editor

- **List**: «افزودن محصول» opens «ورود کالا». The category column shows «دسته اصلی › زیردسته». Drafts show the badge
  «فقط فروشگاه» and the row action «تکمیل برای سایت» (the editor). «کپی» stays.
- **Editor** («تکمیل برای سایت» / edit):
  - Category: a grouped select (main category → sub-categories).
  - Colours: the same palette buttons and «رنگ دیگر» as the intake. Colour ids, product id and address (slug) are
    generated and shown only under a collapsed «تنظیمات پیشرفته» (slug editable there).
  - Sizes: buttons from the category's list plus «سایز دیگر», instead of comma-separated text.
  - Description, material, fit and care may be empty on a draft; they are required to publish.
  - The stock grid stays, labelled «اصلاح موجودی (بعد از شمارش)»; new goods go through «ورود کالا».

## Generated identifiers

- Product id and slug: `p-` + 8 random base-36 characters (e.g. `p-k3x9q2ma`), retried on the rare collision.
- Colour ids: palette colours use fixed ids that map to the storefront's colour families (`familyId`), e.g. black
  → `black`, cream → `cream`, navy → `navy` (family `blue`). «رنگ دیگر» gets `c-1`, `c-2`, … (the next free number in
  that product). On a restock a colour whose name matches an existing colour of the product (trimmed, Persian/Arabic
  ک/ی normalised) reuses its id, so its barcode and stock continue.
- The palette lives in `src/lib/intake-colors.ts`, shared by the panel and the API (as `src/lib/format.ts` is).

## Data (migration `backend/sql/012_categories_intake.sql`, additive)

```sql
CREATE TABLE IF NOT EXISTS categories (
  id varchar(40) PRIMARY KEY CHECK (id ~ '^[a-z0-9][a-z0-9-]{1,39}$'),
  parent_id varchar(40) REFERENCES categories(id) ON DELETE RESTRICT,
  name varchar(60) NOT NULL CHECK (length(btrim(name)) > 0),
  position smallint NOT NULL DEFAULT 0,
  sizes jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (parent_id IS NULL OR parent_id <> id)
);
CREATE INDEX IF NOT EXISTS categories_parent_idx ON categories(parent_id, position);
-- seed: the tree above, INSERT … ON CONFLICT (id) DO NOTHING
ALTER TABLE products ADD CONSTRAINT products_category_fk FOREIGN KEY (category) REFERENCES categories(id);
ALTER TABLE stock_receipt_items ADD COLUMN IF NOT EXISTS unit_cost integer CHECK (unit_cost >= 0);
ALTER TABLE stock_receipts ADD COLUMN IF NOT EXISTS voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS voided_by uuid REFERENCES admin_users(id) ON DELETE SET NULL;
```

- Two levels are enforced by the API (a parent must itself have no parent). `sizes` is used on main categories only.
- `products.category` keeps its column; it now holds a category id. The three existing values are seeded before the
  foreign key is added, so every existing row is valid.
- Purchase cost stays per receipt line (what that batch cost), so sub-project 3 can compute profit per sale.

## API (all under `/v1/admin`, same session and same-origin proxy; the proxy allowlist gains each path)

| Method | Path | Permission | Notes |
| --- | --- | --- | --- |
| GET | `categories` | `products:read` | Tree in order, with `sizes` and product counts. |
| POST | `categories` | `products:write` | `{ name, parentId?, sizes? }` → the new category. |
| PUT | `categories/:id` | `products:write` | `{ name, sizes? }`. |
| PUT | `categories/order` | `products:write` | `{ parentId: string \| null, ids: string[] }`: the full sibling list in its new order. |
| DELETE | `categories/:id` | `products:write` | `409 category_not_empty` with `{ products, children }`. |
| POST | `intake` | `inventory:write` (+ see above) | Below. |
| POST | `stock-receipts/:id/void` | `inventory:write` | `409 units_already_sold` with `items[]` (name, colour, size, received, inStock); `409 receipt_already_voided`. |

`GET stock-receipts/:id` includes `unitCost` per line only for `products:price`, and `voidedAt`. `GET stock-receipts`
includes `voidedAt`. The label page shows «این ورود ابطال شده است» for a voided receipt and offers no print.

### `POST intake`

```ts
type IntakeInput = {
  clientRef: string;                       // uuid, generated per submission
  product: { id: string }                  // restock
         | { name: string; categoryId: string }; // new (name 2–200 chars; categoryId a leaf, see below)
  price: number;                           // integer toman, 1…1,000,000,000
  unitCost?: number | null;                // integer toman, needs products:price
  note?: string;                           // ≤ 300
  lines: { colorName: string; hex: string; colorId?: string; size: string; quantity: number }[]; // 1…120 lines,
         // unique colour/size, quantity 1…2,000, total ≤ 2,000
};
// 201 { receipt: ReceiptDetail, product: { id, name, created: boolean } }; repeated clientRef → 200, duplicate: true
```

One transaction:

1. Advisory lock on `clientRef`; an existing receipt with it is returned as is.
2. **New product**: insert it (draft: `active=false`, empty images and texts, colours and sizes from the lines).
   **Restock**: lock the product row `FOR UPDATE`, add colours and sizes the lines bring that it lacks (appended in the
   order given), and update the price when it differs (needs `products:price`).
3. Insert missing variants with stock 0, then lock the lines' variants `FOR UPDATE` ordered by product, colour and
   size (the order checkout and the counter use), and add the quantities.
4. Ensure barcodes (`ensureBarcodes`), insert the receipt and its lines (with `unit_cost`), write the audit entries
   (`products.created` when created, `products.price` when changed, `inventory.received` with `source: 'intake'`).
5. Commit, then invalidate the catalog cache.

Category rule for new products and edits: the category must exist and be a sub-category, or a main category without
sub-categories (`400 category_not_leaf` / `400 unknown_category`).

Errors (Persian messages in the panel): `invalid_payload` (including a total above 2,000), `unknown_category`,
`category_not_leaf`, `forbidden` (with the missing permission), `not_found` (restock of a removed product).

## Product schema and publishing

- `productInput.category`: an id of up to 40 characters checked against `categories` (no fixed enum).
- `description`, `material`, `fit`, `care` may be empty strings (drafts).
- `saleBlocker` (publishing, and every edit of a published product) adds: `details_required_to_publish` (description
  under 10 characters or material/fit/care empty) and, until sub-project 2, `category_not_on_site_yet` (category
  other than `shomiz`, `manto`, `tshirt`). The editor explains each: «برای انتشار، توضیحات، جنس، فرم و نگهداری را
  پر کنید.» / «انتشار محصولات این دسته بعد از به‌روزرسانی منوی سایت ممکن می‌شود؛ تا آن موقع در فروشگاه فروخته
  می‌شود.»
- The public catalog API and storefront are unchanged in this sub-project.

## Compatibility and rollback

- The migration only adds a table, columns and a foreign key that every existing row satisfies. The previous release
  ignores the new table and columns.
- After a rollback: products in new categories are drafts, which the previous storefront never shows; the previous
  editor cannot save them (its enum rejects the category, with an error, not silently). Receipts and counter sales
  keep working. Voided receipts would show as normal receipts in the previous list (their stock change stays
  correct).
- If the owner deletes an empty legacy category (`shomiz`, …) and a rollback follows, the previous editor cannot
  create a product in that category (foreign key). Accepted and noted in `docs/STORE-INVENTORY.md`.

## Navigation

Menu order: داشبورد · آمار بازدید · صندوق فروش · **ورود کالا** · محصولات · **دسته‌بندی‌ها** · اسلایدر صفحه اول ·
تخفیف آخرین دونه‌ها · سفارش‌ها · کارکنان و مجوزها · تاریخچه فعالیت‌ها · حساب من. Tabs `receiving` (kept as the URL
for «ورود کالا», so old links work) and `categories`.

## Visual design

The intake is the panel's most used screen after the counter, so it gets a deliberate design within the existing
admin tokens (`src/styles/admin.css`, `tokens.css`): a three-step header that always shows where you are, large touch
targets (≥ 44 px) for categories, colours, sizes and steppers, one primary action per step, and barcode cards that
read like the printed labels. Built with the `frontend-design` plugin during implementation; RTL and both phone and
desktop widths checked with screenshots.

## Testing

- **Backend unit**: intake and category input schemas; generated ids; palette mapping and colour-name matching;
  `saleBlocker` rules.
- **Backend integration (real PostgreSQL)**: a new-product intake creates the draft, variants, receipt, barcodes and
  cost in one transaction (and nothing when a line is invalid); a repeated `clientRef` applies once; a restock adds a
  new colour and size without touching other variants' stock and reuses a matching colour's id and barcode; a price
  change without `products:price` is refused; `unitCost` is hidden without `products:price`; an intake racing an
  online order for the same variant leaves exact stock; void returns the units once and is refused after a sale;
  category create / rename / reorder / delete-refused (products, children); `category_not_leaf`; publishing refused
  for new categories and empty details; migration on a fresh database and on one at `011` with products.
- **Storefront unit**: the grid's remaining/over-count logic; thousand grouping and Persian digits.
- **Admin E2E (Playwright)**: intake of 10 units over 2 colours × 2 sizes → 4 barcode cards, «چاپ ۱۰ برچسب», print
  emulation shows 10 labels of 50 × 25 mm; «بارکد» disabled while the sum differs; restock by title and by scanning
  a label; void; category add / rename / delete refused; phone layout (390 px) of all three steps; axe checks of the
  new screens.
- Before the pull request: `npm run lint`, `npm run typecheck`, `npm test`, `npm --prefix backend run typecheck`,
  `npm run build`, the admin Playwright suite (per `docs/RELEASING.md`).

## Not included (later sub-projects or not requested)

- Categories on the website (sub-project 2) and reports, including profit (sub-project 3).
- Several products in one intake (each product is its own intake; the receipts list shows them all).
- Partial void of one line; editing a recorded intake (void and enter again).
- Camera scanning on phones; supplier records beyond the free-text note.
