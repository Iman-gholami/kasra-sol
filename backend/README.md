# Kasra commerce API

**Stack:** Node.js 22, TypeScript, Fastify 5, PostgreSQL, Drizzle ORM and optional Redis read-cache. This API is a separate service in the existing monorepo. It uses **toman** (IRT) integer prices, matching the storefront.

## Run

From repository root:

```sh
cp .env.example .env
# set POSTGRES_PASSWORD and ORDER_TOKEN_SECRET in .env before public deployment
docker compose up --build -d
curl http://localhost:4000/health/ready
```

The API and PostgreSQL/Redis run on the Compose network. PostgreSQL and Redis are not published to the host. The backend development port is bound to loopback only. For API development outside Compose, use `cd backend && npm install && npm run db:migrate && npm run db:seed && npm run dev` with `DATABASE_URL`.

Demo seed runs only if **no products exist**; restarting never resets stock. Demo imagery, categories and shipping/discount rules are examples and must be replaced before commercial use.

## Routes

| Method | Path | Purpose |
|---|---|---|
| GET | `/health/live`, `/health/ready` | Liveness and DB readiness |
| GET | `/v1/categories` | Existing category metadata |
| GET | `/v1/products` | Paginated catalog filters: `category,q,size,color,min,max,stock,sale,sort,page,limit` |
| GET | `/v1/products/:slug` | Product, colors, variants and stock |
| GET | `/v1/home/slider` | The home page slider's products, in the order the back office set (published only) |
| GET | `/v1/search/suggestions?q=...` | Search autocomplete |
| POST | `/v1/checkout/quote` | Authoritative cart/shipping/discount quote |
| POST | `/v1/orders` | Durable guest order, requires `Idempotency-Key` |
| GET | `/v1/orders/:id` | Receipt with `Authorization: Bearer <accessToken>` |
| PUT | `/v1/admin/stock` | Change variant stock with `ADMIN_API_KEY` bearer secret |
| POST | `/v1/analytics/view` | Anonymous page view from the storefront (always `204`) |

`POST /v1/orders` accepts:

```json
{
  "items": [{ "productId": "manto-01", "colorId": "black", "size": "M", "quantity": 1 }],
  "fields": {
    "name": "Example Customer", "mobile": "09123456789", "province": "تهران",
    "city": "تهران", "address": "خیابان مثال، پلاک ۱۰", "postal": "1234567890", "notes": ""
  },
  "shipping": "courier", "payment": "cod", "code": ""
}
```

Use a colorId belonging to an existing product. Never trust prices, discounts or stock submitted by a browser.

**Order semantics:** `confirmed_cod` orders atomically decrement inventory using row locks. `pending_payment` online orders are stored as **unpaid** and **do not reserve or decrement stock**; no payment confirmation can occur before integrating a real PSP and its verified, idempotent callback. No fake successful payment is emitted. Guest receipts require an unpredictable per-order HMAC access token; do not place it in a public URL or logs.

**Database guarantees (`sql/004_order_integrity.sql`):** CHECK constraints restrict payment, shipping and status
values, require `total = subtotal - discount + shipping_cost`, keep every order's `payment_status` at `unpaid`
(no verified settlement exists yet), and forbid an online order from leaving `pending_payment` except to
`cancelled`. A bug or a manual SQL edit therefore cannot turn an unpaid online order into a paid or shipped one.
Widen these constraints only together with a payments ledger (signed PSP callback, amount and order match,
idempotent settlement, stock reservation/expiry).

## Security and operations

- Validation with Zod, body size limit, generic 5xx responses, rate limits and no public DB ports.
- Assign **unique 32+ character** `ORDER_TOKEN_SECRET`, `ADMIN_API_KEY` and strong `POSTGRES_PASSWORD` in deployment.
  The API refuses to start without `ORDER_TOKEN_SECRET`, and rejects the `.env.example` placeholders.
- Rate limits are per visitor. Browsers reach the API only through Next.js, which forwards the visitor address in
  `X-Forwarded-For` (the last entry appended by Nginx). Set `TRUST_PROXY=true` (Compose does) only while the API
  port is reachable solely from the Next.js server, or list the proxy addresses/CIDRs instead of `true`.
  Exceeding a limit answers `429 rate_limited`.
- Run SQL migrations before starting; migration lock prevents concurrent rollout collisions. Drizzle schema is mirrored by `sql/*.sql`.
- Query cache is capped at 20 seconds; admin inventory updates bump its Redis revision. Multi-instance rate limiting requires a shared Redis limiter before launch.
- No customer login, Iranian SMS OTP provider, real payment gateway/refund, fulfillment admin UI, audit log, consent management, or production deployment is included.
- CI runs real-PostgreSQL integration tests (`tests/integration/`): concurrent COD orders never oversell,
  parallel retries of one `Idempotency-Key` create one order, client prices are ignored, unpaid online orders
  cannot be marked paid or fulfilled even by direct SQL, receipts need their token, rate limits are per client.
  Backup+restore and load tests on the target server are still required before accepting real orders.

```sh
cd backend
npm install
npm run typecheck
npm test
npm run build
# with PostgreSQL migrated and the API running (TRUST_PROXY=true):
DATABASE_URL=... node --test --test-concurrency=1 tests/integration/*.mjs
```


## Multi-user admin (development branch)

The RBAC backend implements individual staff accounts with roles `owner`, `manager`, and `staff`.
Only the owner may create, disable, or change staff access. Manager and staff permission overrides
are explicit; `staff:manage` and `payments:configure` cannot be delegated. Default staff **cannot change prices**.
All privileged mutations of price, stock, and staff roles have audit records; role edits revoke all affected sessions.

Run additive migration `002_admin`; it does not erase existing products or orders.
Create the first owner with a password saved in a PRIVATE file outside the repository:

```sh
cd backend
npm run db:migrate
npm run admin:create-owner -- owner_login /secure/path/admin-password.txt
```

The file must contain a unique 12-256-character password. CLI refuses to create a second owner.
Inside the production image the entry point is `node dist/admin/bootstrap.js owner_login /secure/path/admin-password.txt`.
A password file must be explicitly and securely available within that container, or pipe it through stdin so
no copy stays in the container: `docker compose exec -T backend node dist/admin/bootstrap.js owner_login /dev/stdin < owner-pass`.

Admin API uses 8-hour random bearer sessions; SHA-256 token hashes alone are persisted in PostgreSQL.
Use HTTPS and an HttpOnly SameSite cookie in a server-side proxy, never browser-local storage.
The legacy global stock API key endpoint is disabled by default; `LEGACY_STOCK_API_ENABLED=true`
restores it only for short migrations (without per-user attribution).

Admin endpoints (prefix `/v1/admin`): `/auth/login`, `/auth/me`, `/auth/logout`, `/auth/password`,
`/products` (`?q&status&stock&page&limit`), `/products/:id`, `/products/:id/price`, `/products/:id/variants`,
`/products/:id/visibility`, `/variants/:id/stock`, `/orders` (`?status&q&period&page&limit`), `/orders/export`
(`?status&q&period`, CSV), `/orders/:id`, `/orders/:id/status`, `/staff`, `/staff/:id`, `/staff/:id/password`, `/media`,
`/reports/overview`, `/audit` (`?before&group&actor`), `/home-slider` (GET, PUT), `/products/:id/barcodes` (POST),
`/barcodes/:code`, `/stock-receipts` (`?page`; GET, POST), `/stock-receipts/:id`, `/store-sales` (`?date`; GET, POST),
`/store-sales/:id/void` (POST), `/store-holds` (GET, POST), `/store-holds/:id/resume` (POST), `/store-holds/:id` (DELETE).

`/audit` filters by event group (`auth`, `staff`, `products`, `inventory`, `orders`, `sales`, `media`: the part of the action
before the dot) and by acting account id, and adds `targetName` (the account or product an entry is about).

Accounts and sessions:
- 10 consecutive failed logins lock the account for 15 minutes; the answer stays the generic
  `invalid_credentials`. Logins are also limited to 5 per minute per visitor address.
- `POST /auth/password` changes one's own password (current password required) and ends the account's
  other sessions; the owner sets a new employee password with `PUT /staff/:id/password` (ends their
  sessions, clears a lock). Any role/permission/activation change ends the employee's sessions at once.
- Logins (also failed and locked attempts), logouts, password events, uploads and every change of
  price, stock, product, order status and staff access are written to `admin_audit_log`.

## Shop counter, goods receipts and barcodes (migration 008)

The shop and the website share `product_variants.stock`. `POST /stock-receipts` (`inventory:write`) adds received units and gives
each product/color/size a shop-internal EAN-13 code (prefix `20`, stored in `variant_barcodes`). `POST /store-sales` (`sales:pos`,
a new permission that staff and managers have by default) sells scanned codes at the current catalog price, locking like COD
checkout and refusing the whole sale with `409 insufficient_stock` when a unit is gone; a discount needs `products:price`.
`POST /store-sales/:id/void` (`inventory:write`) returns a sale's units once. Receipts and sales take a client `clientRef` UUID and
are applied once per reference. Held counter carts (`/store-holds`, migration 009) reserve no stock and are taken back by
one cashier only (the row is deleted on resume). Details, labels and the counter flow: [docs/STORE-INVENTORY.md](../docs/STORE-INVENTORY.md).

## Product catalog editing and media (PR #7)

Permissions: `products:write` edits content and publishes/archives. Creating a product also needs
`products:price` (and `inventory:write` for opening stock). In a full edit, changing price or compare-at
price needs `products:price` and any stock/variant change needs `inventory:write`; the API answers
`403 {permission}` otherwise, so the full editor cannot bypass the quick price/stock permissions.
Quick stock edits must send `expectedStock` (the value the employee saw): if orders changed it meanwhile,
the API answers `409 stock_changed` with the current stock instead of overwriting sold units.
Unpublishing a published product archives it (`archived_at`); a never-published product is a draft.

Endpoints: `POST /v1/admin/products` (creates an **unpublished draft**);
`GET /v1/admin/products/:id`, `PUT /v1/admin/products/:id`,
`PATCH /v1/admin/products/:id/visibility` (`active:boolean`),
and `POST /v1/admin/media` (authenticated raw JPEG/PNG/WebP, 2 MiB per file).
The public `GET /v1/media/:file` is served through Next.js `/api/media/:file`.
The first image is the product's display image. A product on sale must keep at least one image and a price above
zero: publishing, a full edit of a published product and a quick price change refuse otherwise
(`409 image_required_to_publish` / `price_required_to_publish`), because storefront cards cannot render without an
image and a free product could be ordered. Drafts may stay incomplete.
There is **no hard delete**. Archived products disappear from catalog and cannot be
purchased, but order snapshots and database records remain intact.
Color/size/stock editing is atomic; product writes invalidate the public Redis cache.

Home page slider: `GET /v1/admin/home-slider` (`products:read`) lists the picked products in order, with their
status; `PUT /v1/admin/home-slider` (`products:write`) replaces the pick with `{ productIds }` (at most 5, no
repeats, all published: otherwise `409 slide_unavailable`). The pick lives in `home_slides` (migration 007), is
written to the audit log as `products.home_slider` and invalidates the public cache. A product archived later simply
drops out of `GET /v1/home/slider`. With an empty pick the storefront shows its discounted products instead.

Uploaded images are stored in `media_data`, an independent **persistent Compose volume**
mounted at `/app/backend/uploads` with `MEDIA_DIR` set accordingly.
**Back up this volume alongside PostgreSQL**, and test restore.
Uploads never permit SVG, remote URLs, or arbitrary filenames. Files removed from a
product's gallery are unlinked from that product but retained on disk; add a safe
unreferenced-file cleanup process after retention policies have been determined.
This first implementation does not include image resizing, malware scanning, quotas
by total tenant storage, or CDN offloading. Limit use to staging until audited.

## Dynamic storefront catalog integration

The browser cart and wishlist resolve product IDs through `GET /api/catalog/lookup?ids=...`
(Next.js) which forwards to `GET /v1/products/lookup` (Fastify). It returns only active products.
This allows admin-created products to be added to cart, survive reload, show current variant stock,
and proceed to checkout; the server always recalculates totals and availability during ordering.
If live lookup fails, the persisted cart is **not wiped** and checkout shows a retry message.

## Orders in the admin

Staff with `orders:read` list orders (no mobile numbers in the list) and open the detail (address, items
with name/color snapshots, totals, status history from `order_status_history`). With `orders:fulfill`:
COD `confirmed_cod → preparing → shipped → delivered`, and `confirmed_cod|preparing → cancelled`, which
returns the units to stock in the same transaction. An unpaid online order (`pending_payment`) can only be
`cancelled` (it never reserved stock); the API and the database constraints refuse every fulfilment state
for it. Concurrent clicks record exactly one transition (row lock + 409).

`period` (`all`, `today`, `7d`, `30d`, `month`) limits both the list and the export by order date in Tehran days;
`month` is the current Solar Hijri month. `GET /orders/export` returns the filtered orders (all pages, at most 5000,
else `422 export_too_large`) as UTF-8 CSV with a byte-order mark for Excel: Persian headers and labels, Solar Hijri
Tehran dates, customer name, mobile, address, postal code, items and amounts. It needs `orders:export`, a manager
default that staff only get by explicit grant, because it is a bulk copy of customer contact data. Every download is
audited (`orders.exported`: row count and filters, never the search text). Text cells that a spreadsheet would run as
a formula (`= + - @`) are prefixed with an apostrophe; mobile numbers and postal codes are written as `="0912…"` so
they keep their leading zero.

## Store analytics overview (development branch)

Owners and managers (or staff with an explicit reports:read grant) see a new
"داشبورد فروشگاه" tab as their admin landing page. It is backed by
GET /v1/admin/reports/overview, guarded by reports:read and proxied through
the existing HttpOnly admin session at /api/admin/reports/overview.

The cards display non-cancelled orders today and in the current **Solar Hijri month**
(Asia/Tehran days), published/draft/archived product counts, out-of-stock and low-stock products,
COD orders in progress, and unpaid online orders with their (uncollected) value. The 7-day series
counts placed orders per day and the *value of COD orders marked delivered* on the delivery date
recorded in `order_status_history`. This is NOT confirmed revenue because the
current schema has no verified receipt/cash collection event. The chart and
values are real SQL aggregates, not demo series, but the local database is
seeded with demo products. "Top products" ranks quantities in accepted COD
orders; these are not proof of settled sales.

A future payment integration must add immutable payment settlement/refund events
before any revenue or profit metric is shown. No customer PII is returned by the
reporting endpoint. A manual "Refresh" fetches the current database results.

## Traffic statistics (آمار بازدید)

The storefront reports each page shown in a real browser to `POST /v1/analytics/view` (through the same-origin
Next route `/api/analytics/view`, which forwards the client address and user agent). Owners and managers, or staff
with a `reports:read` grant, read the result in the admin "آمار بازدید" tab, backed by
`GET /v1/admin/reports/traffic?days=7|30|90`. The report covers views and visitors today versus yesterday,
visitors in the last 5 minutes, conversion (non-cancelled orders ÷ daily visitors), a daily series, busiest hours,
top pages and products (with units ordered in the same range), traffic sources and devices. Days are Asia/Tehran days.

**Privacy by design (`sql/006_traffic.sql`):** no cookie, no IP address, no user agent and no query string is stored.
A row keeps the day, the path (without `?`/`#`), the referring site's host name, a device class and a 32-hex visitor
hash: `sha256(daily random salt | IP | user agent)`. The salt lives in `analytics_salts` and is deleted after the
next day, so hashes from different days cannot be linked and nobody (including the shop) can recover an IP from
them. A visitor is therefore counted once per day; a range's "visitors" is the sum of daily visitors. Page views
older than 400 days are deleted. Admin, API and Next internals are never recorded.

**Not counted:** crawlers, link previews, scripts and headless or automated browsers (user-agent rules plus the
browser's `navigator.webdriver` flag). The endpoint is rate limited (60/minute per address), ignores invalid input
silently and has no read side, so it cannot be used to probe anything. It is disabled together with the backend
(`NEXT_PUBLIC_BACKEND_ENABLED` unset), in which case the storefront sends nothing.
