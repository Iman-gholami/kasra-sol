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
- Two-step Iranian checkout with validation, sample shipping/payment/discount rules and a simulated gateway; **no** real payment, server-side storage of addresses, or real order placement (the draft stays in the tab's sessionStorage)
- Provisional FAQ, contact, about, shipping, size guide, 404, health check
- Mobile responsive layouts, semantic labels, keyboard-friendly interactions, reduced-motion CSS
- Docker standalone runtime, Compose, Nginx sample, GitHub Actions and Playwright cases

**No actual purchases, prices, commercial policies, real social proof, auth or shipping guarantees exist.** The checkout confirmation explicitly means "demo complete", never "order placed".

## Architecture

```text
src/
  fonts/                Official Estedad 8.5 variable WOFF2, OFL license/provenance
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

`src/data/products.ts` defines 12 products per category, each with multiple colors and per-size stock. **Six photorealistic AI-generated model images**, optimized to AVIF and stored locally under `public/images/lookbook/`, are intentionally **reused across the 36 mock products** to evaluate the visual design of the storefront. These images do **not** represent actual inventory or faithfully depict the named clothes, sizes, available colors or variants. The previous SVG illustrations remain in the repository for reference but are no longer used in product displays. Before production, replace this demo mapping with distinct, properly licensed authentic product photos, preferably on an image CDN. Persian typography uses the official **Estedad 8.5 variable WOFF2** (100–900) bundled at `src/fonts/Estedad-VF.woff2`, loaded through `next/font/local` with `font-display: swap` and local font preloading. It is self-hosted at runtime and makes no font-CDN requests. The font's SIL OFL 1.1 license and source/version verification are at `src/fonts/OFL.txt` and `src/fonts/README.md`.

## Local typography — Estedad 8.5

The primary font for **all Persian text, prices, navigation and forms** is **Estedad**, configured via `next/font/local` in `src/app/layout.tsx`. The single 120,924-byte variable WOFF2 supports weights 100–900, uses `font-display: swap`, is preloaded by Next.js and has Tahoma fallback. The Latin editorial **KASRA** wordmark retains its intentional Georgia serif treatment.

The upstream is [Amin Abedi's official Estedad repository](https://github.com/aminabedi68/Estedad), pinned to [release 8.5](https://github.com/aminabedi68/Estedad/releases/tag/8.5), under **SIL OFL 1.1**. The committed binary matches upstream Git blob SHA `01db924b1aa7dea3ab62814d50e73440957df7d3`. License/provenance are bundled in `src/fonts/`. No Google Fonts API, runtime CDN or extra npm package is needed.

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

## Cart & Checkout 10.0

The purchase flow now behaves like a real store while staying simulated: an add-to-cart confirmation sheet (bottom sheet on phones, panel under the cart icon on desktop), stock-aware adding, a free-shipping meter and "save for later" in the cart, a two-step checkout (address + shipping method → review and payment method) addressed by `?step=payment` so Back works, a simulated gateway with success, failure and cancel paths (no card data is ever asked for), and a confirmation page with the order summary. Sample rules live in `src/lib/checkout.ts`; the draft and the demo order are kept only in the tab's `sessionStorage`. On phones (10.1) the flow follows benedito.ir's pattern in Kasra's style: a short confirmation sheet with stacked actions, a focused back-and-logo header with an icon stepper on cart and checkout, and the discount code inside the cart. See [Cart & Checkout 10.0](docs/CHECKOUT-V10.md).

## UX Overhaul 9.0

V9 rebuilds the presentation and interaction layer for desktop and mobile; data, store contract, routes, query parameters, APIs, deployment and the demo-only checkout are unchanged. It adds a token stylesheet (`src/styles/`), one native-`<dialog>` sheet primitive for every overlay, a header disclosure panel, a search combobox, instant sidebar filters with a live-count bottom sheet on phones, an RTL scroll-snap gallery with magnify-and-pan zoom, cart undo, inline checkout validation, and bottom navigation on mobile browsing pages. Read the [audit](docs/UX-AUDIT-V9.md) and the [implementation notes, test and Lighthouse evidence](docs/UX-V9.md). Accessibility is checked with axe-core in `tests/a11y.spec.ts`; screenshots and a DOM probe can be regenerated with `node scripts/capture-ux.cjs`.

## Shop by Color 8.0

The homepage now includes a responsive, interactive **خرید بر اساس رنگ** section between categories and new arrivals. Color options come from product variants via the server-only `getShopByColorResults` adapter (at most four lightweight product cards per color), with URL-compatible **/shop?color=...** navigation. The existing product-card and wishlist UI is reused. See [Shop by Color 8.0 implementation notes](docs/SHOP-BY-COLOR-V8.md) for data contracts, accessibility, test evidence, preview-image limitations and backend integration.

## Product Discovery Experience 7.0

Search, catalog filters, category browsing and recovery from empty results have been refined in place. Live search suggestions now use a small server endpoint instead of shipping the entire mock catalog to the client. Read the [discovery UX audit and testing guide](docs/PRODUCT-DISCOVERY-V7.md).

## Mobile Product Experience 6.0

See [Mobile PDP Experience 6.0](docs/MOBILE-PDP-V6.md) for an in-place improvement to product-detail pages only: swipe navigation, a compact contained-image gallery, accessible zoom and size guide, inventory-aware variants, a contextual mobile sticky purchase bar, and nonblocking cart confirmation. Existing data, shipping mock, cart store, self-hosted Estedad font, payment-demo boundary and deployment remain unchanged.

## Experience Upgrade 3.0

See [Experience Upgrade 3.0 UX audit and QA](docs/EXPERIENCE-V3.md). This in-place update adds a focused quick-cart dialog, inline example-only size guide, Persian search previews, visual color swatches, keyboard refinements and a clearer demo checkout. All existing commerce data and routing remain in place.

## Design Transformation 4.0

See [Design Transformation 4.0 — UX audit and QA](docs/DESIGN-V4.md) for the implemented responsive redesign, priority issue list, photo provenance, test evidence and reproducible lab measurements. Backend, checkout and VPS integration are intentionally unchanged.

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
