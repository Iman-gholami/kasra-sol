# Kasra Boutique — Visual Refinement Audit

## Scope and baselines

This is an **in-place design and UX refinement** on the original Next.js 16 App Router, React 19, TypeScript and Tailwind 4 storefront. No routes, product data architecture, localStorage cart, inventory rules, checkout validation, or deployment services were removed or replaced.

Baseline source: [commit 5d4e0db](https://github.com/Iman-gholami/kasra-sol/commit/5d4e0db2622093801525fb3e3561b088053e2fd7), with [5/5 Playwright checks passing](https://github.com/Iman-gholami/kasra-sol/actions/runs/38358967632). Screenshots were not originally retained by the baseline CI. `visual-baseline.yml` creates **baseline screenshots** from that pinned commit and uploads an artifact; the refreshed CI saves matching screenshots in `storefront-screenshots`. Compare the artifact sets rather than relying on descriptions.

Baseline limitations observed from source and styling:
- Minimal K-in-a-box + Persian-first wordmark gave a less distinct fashion label identity.
- Category tiles were plain gradients with no category imagery; the editorial feature used an icon rather than photography.
- Catalog filters were open by default on small devices, consuming space before products.
- No removable active-filter indicators; shoppers could not quickly see which constraints applied.
- Heading/price hierarchy, visual rhythm and touch-target details needed a coordinated design system.
- Some demo imagery is reused across multiple unrelated SKUs. It is AI-generated, not verified item photography.

## Refinement delivered

- **Brand identity:** compact K monogram, considered Latin `KASRA` wordmark, neutral typography, reusable `src/app/icon.svg`.
- **Design system:** semantic ivory/white/charcoal/sand/dusty-rose/deep-rose tokens, spacing/motion/focus states, carefully scoped responsive rules in a single `globals.css`.
- **Homepage:** more deliberate editorial split hero, image-backed shomiz/manto/tshirt category cards, photography-led *The Kasra Edit* with real category navigation, more concise Persian copy, clean content rhythm.
- **Product cards:** 3:4 studio image, smaller badges and hearts, readable Toman pricing, swatches, clearer product links.
- **Catalog:** lightweight desktop filter rail, client-side accessible modal-like mobile filter drawer, Escape/backdrop/close, focus cycling and lock on background scroll, server-driven URL query filtering preserved, removable active chips.
- **Other routes:** polished existing product gallery/option states/cart/checkout/wishlist/info page CSS without altering transactional behavior or backend boundaries; optimized for 320–1440px widths.
- **Photos:** six existing locally hosted small AVIF AI-generated portraits continue to be used as **demo-only** assets. They do not necessarily correspond to each product name, size, color or stock.

## Architecture retained

Server Components for homepage, shop, categories, search, product routes, metadata; typed product adapter `src/lib/catalog.ts`; lightweight client components for cards, header, variant selector, cart and checkout; URL-driven filters; no new runtime dependencies. The Docker/Compose/Nginx/ParsPack deployment architecture remains unchanged.

Routes kept: `/`, `/shop`, `/category/[slug]`, `/search`, `/product/[slug]`, `/cart`, `/wishlist`, `/checkout`, `/order-confirmation`, `/account`, `/about`, `/contact`, `/faq`, `/size-guide`, `/shipping-and-returns` plus `/api/health`, `/robots.txt`, `/sitemap.xml`.

## Verification

CI runs `npm run lint`, `npm run typecheck`, `npm run build`, Playwright browser tests and visual screenshot capture. Playwright covers core browsing/search/filter/variant/cart/wishlist/checkout, mobile menu/drawer, Escape behavior and 320, 375, 390, 430, 768, 1024 and 1440px overflow. Screenshots include mobile (390) and desktop (1440) homepage, catalog and product.

**Status source of truth:** [GitHub Actions for the latest main commit](https://github.com/Iman-gholami/kasra-sol/actions). Only treat outcomes listed as successful by the actual run as verified.

Desktop and mobile design review should inspect downloaded screenshots from `storefront-screenshots` and `kasra-baseline-screenshots`. Layout screenshots are synthetic Chromium results, not a substitute for physical devices or an accessibility audit.

**Performance:** no measured real-user p75 LCP, INP or CLS is claimed. No verified Lighthouse scores or capacity/ParsPack hosting results exist. Existing route-level data, image optimization and CSS motion constraints are preserved; measure under matching throttled lab profiles and capture real-user telemetry before making performance claims.

## Remaining gaps before commercial launch

1. Real photographed product-specific imagery with licenses, correct variant correspondence and honest stock.
2. Properly licensed, self-hosted and subset Persian display/body font instead of environment-dependent Tahoma/Vazirmatn fallback.
3. Manual cross-browser, screen-reader, zoom 200–400% and focus audit; visual screenshots are not WCAG certification.
4. Reproducible `package-lock.json`, Docker runtime check on intended Ubuntu VPS and domain/TLS setup.
5. All existing backend, payment, support and legal launch prerequisites listed in the README.

Do not present the prototype as a production storefront or the placeholder visuals as real product evidence.
