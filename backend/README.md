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
DATABASE_URL=... node --test tests/integration/*.mjs
```
