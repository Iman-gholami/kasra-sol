# One stock for the shop and the website: barcodes, receiving and the counter

The physical shop and the website now sell from **one stock**: `product_variants.stock`, per product, color and size.
Every change goes through the API in a database transaction, so a unit can never be sold twice (once at the counter and
once online).

| Event | Where | Stock |
|---|---|---|
| Goods arrive | Admin → «ورود کالا و برچسب» (receipt) | + received units |
| Sale in the shop | Admin → «صندوق فروش» (scan labels) | − sold units |
| Counter sale voided / returned | «فروش حضوری امروز» → «ابطال / مرجوعی» | + units of that sale |
| Online COD order | Storefront checkout | − ordered units (unchanged) |
| COD order cancelled | Admin → orders | + units (unchanged) |
| Manual correction | Admin → products → «موجودی» | set exactly (unchanged, audited) |

## Barcodes

- **One barcode per product + color + size** (not per unit). All five black medium shirts carry the same label, the same way
  most clothing shops label stock.
- Format: **EAN-13 in prefix `20`**, GS1's range for numbers used only inside one store: `20` + a 10-digit sequence + check digit
  (`2000000000015`, `2000000000022`, …). Every scanner reads EAN-13 out of the box.
- **Digits only, on purpose.** A USB/Bluetooth scanner behaves like a keyboard. On a computer set to Persian, letters would arrive
  as Persian characters; digits arrive as `۰-۹`, which the panel converts. A wrong digit fails the check digit and is rejected at
  the scan.
- Codes live in `variant_barcodes` (keyed by product/color/size, not by the variant row), so a label already stuck on clothes keeps
  working when the product editor removes and later restores that color or size. A code is created the first time it is needed:
  on a receipt or when labels for a product are printed.

## Receiving goods («ورود کالا و برچسب», needs `inventory:write`)

1. A new product is first defined in «محصولات و موجودی» with its colors and sizes and **stock 0** (it may stay a draft; the shop
   can sell products that are not on the website).
2. In «ورود کالا و برچسب», find the product by name and enter how many of each color/size arrived, or scan the label of an item
   that is already labelled (each scan adds one). One receipt can hold many products.
3. «ثبت رسید و افزودن به موجودی» adds all lines in one transaction (or none of them) and gives each color/size its barcode.
4. «چاپ برچسب‌های این رسید» opens the label page with **one label per received unit**. Any receipt can be reprinted later from the
   receipts list, and any product from its row in «محصولات و موجودی» («برچسب»).

## Labels (`/admin/labels`)

Printed from the browser; the page holds nothing but labels when printed, in real millimetres:

| Type | Size | Notes |
|---|---|---|
| Label printer roll | 40 × 30 mm | One label per page. Bars of 0.25 mm = 2 dots on a 203 dpi printer. |
| Label printer roll | 50 × 25 mm | Bars of 0.375 mm = 3 dots. |
| A4 sheet, 65 labels | 38.1 × 21.2 mm (5 × 13) | «چند خانه اول خالی بماند» reuses a partly used sheet. |

Each label shows the product name, color, size, price (optional) and the barcode with its digits. In the print dialog choose the
label printer, margins **None** and scale **100%**; for a roll, set the same label size in the printer driver. The price printed is
the price at printing time; the counter always charges the current catalog price.

## The counter («صندوق فروش», needs `sales:pos`)

- Shop staff land on the counter when they sign in. The scan field takes a scanner's digits + Enter (or the 13 digits typed by hand).
  Scanning the same label again adds one; quantities never exceed the stock shown.
- A label whose stock is 0 is refused at the scan with the likely reason: the last unit was ordered online and is waiting to be packed
  (see open orders), or its arrival was never received into stock.
- «ثبت فروش و کم کردن از موجودی» records the sale with the payment method (card reader / cash / card-to-card) and takes the units in
  one transaction. If the website sold a unit in the meantime, the sale is refused as a whole with the item and the available count.
- Discounts on a sale need `products:price` (managers). Voiding a sale (a mistake or a return) needs `inventory:write` and returns
  its units once.
- «فروش حضوری امروز» lists the day's sales (Tehran day) with totals per payment method, leaving voided sales out.
- A sale submitted again after a lost answer (same cart, same reference) is recorded once.

## Permissions

| Permission | Default | Allows |
|---|---|---|
| `sales:pos` (new) | owner, manager, **staff** | Scan and record counter sales, see the day's counter sales |
| `inventory:read` | everyone | Scan lookups, receipts list, print labels |
| `inventory:write` | owner, manager | Receive goods, void counter sales |
| `products:price` | owner, manager | Give a discount at the counter |

The owner can grant or revoke `sales:pos` per employee in «کارکنان و مجوزها». Receipts, counter sales and voids are written to the
activity history (`inventory.received`, `sales.recorded`, `sales.voided`).

## API

All under `/v1/admin`, behind the same session and the same-origin proxy (`/api/admin/*`):

| Method | Path | Permission |
|---|---|---|
| POST | `/products/:id/barcodes` (codes for every color/size, created if missing) | `inventory:read` |
| GET | `/barcodes/:code` (what a label is, with current price and stock) | `inventory:read` |
| GET / POST | `/stock-receipts` (`?page`) | `inventory:read` / `inventory:write` |
| GET | `/stock-receipts/:id` (lines with barcode and current price, for labels) | `inventory:read` |
| GET / POST | `/store-sales` (`?date=YYYY-MM-DD`, default today in Tehran) | `sales:pos` |
| POST | `/store-sales/:id/void` | `inventory:write` |

`POST /stock-receipts` and `POST /store-sales` take a client-generated `clientRef` (UUID); repeating it returns the first result
(`200`, `duplicate: true`) instead of applying it twice. Errors: `variant_not_found`, `barcode_not_found`, `invalid_barcode`,
`variant_removed`, `price_missing`, `insufficient_stock` (with `items[]`: code, name, requested, available), `discount_too_large`,
`sale_already_voided`, `restock_variant_missing`.

Locking follows checkout: products `FOR SHARE` ordered by id, then the variants `FOR UPDATE` ordered by product, color and size, so
counter sales, receipts, online orders and full product edits neither deadlock nor interleave. Migration
`backend/sql/008_store_inventory.sql` is additive.

## Tests

- `backend/tests/barcode.test.ts`: EAN-13 check digits against published codes, the in-store range, rejection of typos.
- `backend/tests/integration/store.integration.mjs` (real PostgreSQL): receipts applied once and atomically, barcodes stable
  across a removed/restored size, sales at catalog price, all-or-nothing refusal, discount permission, **counter and website racing
  for the last 3 units sell exactly 3**, a cancelled online order's unit sold at the counter, void once with correct day totals.
- `tests-admin/admin-panel.spec.ts`: receive → print (3 labels, one 40 × 30 mm PDF page each) → staff scan with Persian digits →
  sale → website stock follows → manager voids; staff menu and permissions; axe checks of the new screens; phone layouts.

The EAN-13 drawing was also checked by decoding the generated symbols with ZXing (not part of the repository's tests).

## Not included yet

- Scanning with a phone camera (works today with any USB/Bluetooth scanner, or by typing the digits).
- A printed customer receipt from the counter, and counter sales in the dashboard reports (the counter shows the day's totals).
- Stock counting (انبارگردانی) and partial returns of one line of a sale (void returns the whole sale).
- Existing manufacturer barcodes on goods; every color/size gets the shop's own code.

---

## راهنمای کوتاه برای فروشگاه

**وقتی جنس می‌رسد**
1. اگر محصول جدید است، اول در «محصولات و موجودی» آن را با رنگ‌ها و سایزها و موجودی **صفر** بسازید.
2. در «ورود کالا و برچسب» محصول را جست‌وجو کنید، تعداد رسیده از هر رنگ و سایز را بنویسید و «افزودن به رسید» بزنید.
   (برای کالایی که قبلاً برچسب دارد، برچسبش را اسکن کنید؛ هر اسکن یک عدد.)
3. «ثبت رسید و افزودن به موجودی» را بزنید؛ همان لحظه در سایت هم موجود می‌شود.
4. «چاپ برچسب‌های این رسید» را بزنید و روی هر تکه یک برچسب بچسبانید.

**وقت فروش**
1. در «صندوق فروش» برچسب هر کالا را با بارکدخوان اسکن کنید.
2. روش پرداخت را انتخاب کنید و «ثبت فروش و کم کردن از موجودی» را بزنید؛ از موجودی سایت هم کم می‌شود.
3. اگر سیستم گفت موجودی ندارد، احتمالاً آخرین عدد در سایت سفارش داده شده است: سفارش‌های باز را ببینید و آن تکه را کنار بگذارید.

**مرجوعی یا اشتباه**: در «فروش حضوری امروز» دکمه «ابطال / مرجوعی» (فقط مدیر) کالا را به موجودی برمی‌گرداند.
