# Kasra Boutique — کسری بوتیک

Persian-language, RTL women's fashion storefront prototype built with **Next.js 16 App Router**, **React 19**, **strict TypeScript**, and **Tailwind CSS 4**. The shopping experience and all prices, products, stock, and confirmation flows are **demonstration-only**.

## Start locally

Requires Node.js 22+ and npm.

```bash
npm install
npm run dev
# open http://localhost:3000
```

Build and verify:

```bash
npm run lint
npm run typecheck
npm run build
npm run start
npx playwright install chromium
npm run test:e2e
```

Run Playwright against a built app. Do not use the development server for performance measurements.

> The repository was bootstrapped without a generated npm lockfile because the authoring environment had no npm registry connectivity. Before a production release, run `npm install --package-lock-only` in a networked environment, commit `package-lock.json`, change the Docker dependency stage and CI to `npm ci`, and then verify reproducible builds.

## Included customer flows

- Homepage, three categories, 36 representative products, six optimized local AI-generated fashion photographs (3:4)
- Server-oriented filtered, sorted, paginated catalog with shareable query parameters
- Persian-friendly search normalization (Arabic/Persian ک/ی forms and numerals)
- Product gallery, zoom, available color/size variants, quantity and size guide
- Local browser wishlist/cart, with variant-specific lines and totals
- Iranian checkout form validation and **no** payment, storage of addresses, or real order placement
- Provisional FAQ, contact, about, shipping, size guide, 404, health check
- Mobile responsive layouts, semantic labels, keyboard-friendly interactions, reduced-motion CSS
- Docker standalone runtime, Compose, Nginx sample, GitHub Actions and Playwright cases

**No actual purchases, prices, commercial policies, real social proof, auth or shipping guarantees exist.** The checkout confirmation explicitly means "demo complete", never "order placed".

## Architecture

```text
src/
  app/                  App Router pages, metadata, sitemap, robots, /api/health
  components/layout/    Navigation, footer
  components/catalog/   Filter and result UI
  components/products/  Cards, detail/gallery, variant selection
  components/cart/      Cart UI
  components/checkout/  Simulated checkout
  components/shop-provider.tsx  Browser-only wishlist/cart store
  data/products.ts      36 typed sample products and category config
  lib/catalog.ts        Server-side filtering/pagination adapter
  lib/format.ts         Persian normalization, digits, pricing
  types/store.ts        Product, variant, cart and filter models
public/images/          Original local SVG placeholders; NOT product photographs
tests/                  Playwright critical-path tests
deploy/nginx/           Reverse-proxy starter
docs/                   Deployment and verification reports
```

Most route modules are Server Components. The catalog adapter returns a limited page, not the entire catalog. Interactive browser state uses `useSyncExternalStore` and versioned localStorage; it is not a backend or authoritative stock source.

To connect a backend, replace `queryProducts` and product lookup methods with typed paginated/search APIs; move pricing, inventory and cart authority server-side. Use a transactional order endpoint before processing real payments. The frontend's product types and route structure are designed as adapter boundaries, not production contracts.

## Data / assets

`src/data/products.ts` defines 12 products per category, each with multiple colors and per-size stock. **Six photorealistic AI-generated model images**, optimized to AVIF and stored locally under `public/images/lookbook/`, are intentionally **reused across the 36 mock products** to evaluate the visual design of the storefront. These images do **not** represent actual inventory or faithfully depict the named clothes, sizes, available colors or variants. The previous SVG illustrations remain in the repository for reference but are no longer used in product displays. Before production, replace this demo mapping with distinct, properly licensed authentic product photos, preferably on an image CDN. Real Persian typography should use properly licensed, self-hosted optimized Vazirmatn files when supplied. The current fallback stack supports Persian without remote font loading.

## Deployment

```bash
cp .env.production.example .env
# Set NEXT_PUBLIC_SITE_URL to your actual HTTPS domain
docker compose build
docker compose up -d
docker compose ps
curl -f http://127.0.0.1:3000/api/health
```

Compose publishes only to `127.0.0.1:3000` by design; configure host-level Nginx and HTTPS first. See [ParsPack Ubuntu deployment steps](docs/DEPLOYMENT.md).

Production deployment to a VPS, Docker image verification, browser tests and load testing must only be treated as complete when actually executed. Current verification status is recorded in [PERFORMANCE.md](docs/PERFORMANCE.md).

## Design refinement and visual QA

See [Visual Refinement Audit](docs/DESIGN-REFINEMENT.md). CI now uploads 390px and 1440px page screenshots; a separate baseline workflow captures comparable screenshots from the pre-refinement commit. Catalog filters support active chips and a mobile drawer; the homepage and product cards use the new editorial design system. No existing commerce logic was replaced.

## Before commercial launch

1. Product catalog/media/inventory API, content management and data reconciliation.
2. Authentication/accounts and rate-limited Iranian OTP integration.
3. Pricing/tax/discount and shipping quotes computed by backend.
4. Durable transactional orders, payment gateway + webhook reconciliation, refunds.
5. Legally reviewed policies, seller identity, genuine contact details and customer support.
6. Audit logs, security monitoring, analytics with appropriate consent, backups and incident response.
7. CDN cache correctness, real-user Core Web Vitals, realistic campaign-load tests and origin protection.

This repository intentionally avoids fictional production features.
