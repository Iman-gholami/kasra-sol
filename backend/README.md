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
| GET | `/v1/search/suggestions?q=...` | Search autocomplete |
| POST | `/v1/checkout/quote` | Authoritative cart/shipping/discount quote |
| POST | `/v1/orders` | Durable guest order, requires `Idempotency-Key` |
| GET | `/v1/orders/:id` | Receipt with `Authorization: Bearer <accessToken>` |
| PUT | `/v1/admin/stock` | Change variant stock with `ADMIN_API_KEY` bearer secret |

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
A password file must be explicitly and securely available within that container.

Admin API uses 8-hour random bearer sessions; SHA-256 token hashes alone are persisted in PostgreSQL.
Use HTTPS and an HttpOnly SameSite cookie in a server-side proxy, never browser-local storage.
The legacy global stock API key endpoint is disabled by default; `LEGACY_STOCK_API_ENABLED=true`
restores it only for short migrations (without per-user attribution).

Admin endpoints (prefix `/v1/admin`): `/auth/login`, `/auth/me`, `/auth/logout`, `/products`,
`/products/:id/price`, `/products/:id/variants`, `/variants/:id/stock`, `/orders`,
`/staff`, `/staff/:id`, `/audit`.
Online orders stay unpaid pending PSP verification. Full product CRUD, image uploads, fulfillment
transitions, 2FA, reports and payment reconciliation are later work before commercial launch.

## Product catalog editing and media (PR #7)

New permissions: full create/edit requires all of `products:write`, `products:price` and
`inventory:write`; archiving/publishing requires `products:write`.
Staff without pricing access cannot bypass that restriction using full-product editing.

Endpoints: `POST /v1/admin/products` (creates an **unpublished draft**);
`GET /v1/admin/products/:id`, `PUT /v1/admin/products/:id`,
`PATCH /v1/admin/products/:id/visibility` (`active:boolean`),
and `POST /v1/admin/media` (authenticated raw JPEG/PNG/WebP, 2 MiB per file).
The public `GET /v1/media/:file` is served through Next.js `/api/media/:file`.
The first image is the product's display image; products with no images cannot be published.
There is **no hard delete**. Archived products disappear from catalog and cannot be
purchased, but order snapshots and database records remain intact.
Color/size/stock editing is atomic; product writes invalidate the public Redis cache.

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

## Store analytics overview (development branch)

Owners and managers (or staff with an explicit reports:read grant) see a new
"داشبورد فروشگاه" tab as their admin landing page. It is backed by
GET /v1/admin/reports/overview, guarded by reports:read and proxied through
the existing HttpOnly admin session at /api/admin/reports/overview.

The cards display order counts today/this month, active/archived product counts,
active variants with 1-3 or 0 stock, COD orders in progress, and unpaid online
orders. The 7-day trend and today/monthly values count the *value of COD orders
marked delivered* based on server-side audited delivery event timestamps,
in the Asia/Tehran time zone. This is NOT confirmed revenue because the
current schema has no verified receipt/cash collection event. The chart and
values are real SQL aggregates, not demo series, but the local database is
seeded with demo products. "Top products" ranks quantities in accepted COD
orders; these are not proof of settled sales.

A future payment integration must add immutable payment settlement/refund events
before any revenue or profit metric is shown. No customer PII is returned by the
reporting endpoint. A manual "Refresh" fetches the current database results.
