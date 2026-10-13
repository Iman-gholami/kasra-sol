# Kasra Boutique — Design Transformation 4.0

## Executive decision

This is a focused upgrade of the **existing** Persian RTL, Next.js 16 / React / TypeScript fashion storefront, not a replacement application. Commercial flows remain local, mock-only. The art direction is *The Contemporary Fashion Edit*: more useful display area, an editorial category composition, readable catalog product names/prices, and a coherent purchase decision interface.

Baseline: commit [`f5030708`](https://github.com/Iman-gholami/kasra-sol/commit/f5030708ae0af0e49c3db5dcb1f5225ff35f8c93). Actual V3 desktop/mobile screenshots and the V4 screenshots were used to make these decisions. Browser measurements were collected using the same lightweight Playwright/Chromium script with both versions' production builds.

## The top ten issues and dispositions

| Priority | Issue observed | V4 change | Disposition |
| --- | --- | --- | --- |
| P1 | Excessive side margins on ultra-wide desktop | Increase catalog/container max from 1280 to 1440px; add a separate 1520px wide-editorial variant | Fixed in CSS; inspect the 1800px screenshot |
| P1 | Product imagery repeating in listings and related suggestions | Curate different category photos on homepage and style-across-category recommendations | **Partially mitigated**: only six generated photos are available for 36 named SKUs |
| P1 | Names, prices and product actions secondary to photos | Sharpen Persian text hierarchy, increase product title/price sizes, make the size-action link explicit | Improved; inspect two-column 390px cards |
| P1 | Price / variants / quantity / CTA fragmented on detail page | Coherent bordered purchase section with directly labelled color swatches and nearby size guide/quantity/CTA | Fixed |
| P1 | Homepage three category tiles too uniform | Asymmetric but readable category grid at desktop, reset to balanced mobile arrangement | Fixed |
| P1 | Repetitive large demo disclosures broke purchase flow | Move full explanation below purchasing decisions and use a compact inline note + image/gallery label | Fixed; truthfulness retained |
| P2 | Repeated uppercase English overlines competed with Persian brand voice | Replace most overlines with short Persian section kickers; retain only intentional KASRA editorial naming | Improved |
| P2 | Generic benefit boxes and long unrelated section gaps | Replace feature-box row with direct size/shipping/FAQ service links; tighten related sections | Fixed |
| P2 | Sorting buried in desktop filter sidebar | Expose sort toolbar + product count + category shortcuts, preserve query parameters on submit | Fixed |
| P2 | Four-column desktop catalog had a mostly empty last row (nine products/page) | Increase page size from 9 to 12; test 4-column rows and next-page navigation | Fixed |

### Other areas inspected and preserved

Mobile menu, search previews, wishlist/localStorage persistence, mini cart with subtotal, quantity and stock validation, inline example-only size guide, shipping information, demo checkout, error and empty states, test coverage, Docker/Compose/Nginx ParsPack target all remain. There is no new backend, payment integration, animation framework or product imaging service.

The V3 reference full-page screenshot's partial hero at a captured scroll position was not treated as a proven component defect. V4 hero remains directly linked to the catalog and visible categories.

## Visual system

- **Widths:** editorial up to 1520px, general and catalog up to 1440px, prose up to 820px, compact checkout content up to 1120px. Responsive horizontal gutters retained.
- **Hero:** tightened copy/CTA arrangement and added lightweight category links in the introduction. No carousel/video.
- **Category cards:** first card visually emphasized, second card staggered on larger screens, consistent readable overlays. Mobile cards remain balanced.
- **Product grid:** 3 columns with desktop filter sidebar, 4 on ultra-wide screens; 2 on conventional phones. Twelve products per page with ordinary URL pagination.
- **Product detail:** product name, price, short description, clear labelled color/size/tally controls, action, truthful asset note, then lower details.
- **Interactions:** familiar links, native <dialog> for quick cart and size guide, visible keyboard-focus outlines, no motion library.
- **Editorial text:** reduced repeated English kickers, straightforward Persian CTA language.

## Photo provenance and replacement plan

Only **six** optimized local AI-generated studio portraits currently exist under `public/images/lookbook/`. They are assigned to many separate mock SKUs and **do not verify the cut, fit, color or material of the named item**. No credible new product-specific photos or rights-cleared asset library were available. V4 **does not fabricate unique SKU photography**: it makes mixed-category editorial recommendations where possible and explicitly identifies the catalog images as demo-only.

**Before production:** acquire a licensed image set for every SKU and its purchasable color variants; provide a full-length primary view, front/back or detail views with consistent framing, alt text grounded in actual images, color/size correspondence, signed consent for recognisable models as applicable, and tuned AVIF/WebP sizes. Store durable image identifiers/URLs in typed product data, ideally backed by a CDN, and replace the demo mapping. Do not mix a green garment photo into a black-only purchasable variant.

## Test evidence

- [V3 baseline visual/metrics workflow](https://github.com/Iman-gholami/kasra-sol/actions/workflows/visual-baseline.yml)
- [Latest V4 lint/typecheck/production build/Playwright/screenshot workflow](https://github.com/Iman-gholami/kasra-sol/actions/workflows/ci.yml)
- `tests/store.spec.ts`: shopping flow, demo checkout, RTL search, sorting, persistent wishlist/cart, filters, stock rules, 320–1440px overflow, 1800px wide layout and 12-item catalog pages.
- `tests/visual.spec.ts`: full-page homepage/catalog/product at 320, 375, 390, 430, 1024, 1440 and 1800px; filter open, size guide, mini-cart, cart and checkout on mobile.
- Artifacts: `storefront-screenshots` and `kasra-baseline-screenshots` from the linked runs.

The check suite runs against actual Chromium; **it is not user testing**, full accessibility certification or a guarantee for devices not in its viewport set.

## Performance methodology and limitations

The standalone production builds for pinned V3 and current V4 are exercised on Ubuntu GitHub Actions using the same `scripts/measure-lab.cjs` and Chromium. The artifact JSON files record approximate FCP, last observed LCP, accumulated session CLS, DOMContentLoaded, transferred resources/scripts/images, counts and horizontal overflow at 390 and 1440px across homepage, catalog and sample product. The mobile product case is repeated five times to flag intermittent layout shifts.

**Interpretation:** results are single-run **unthrottled synthetic** observations on CI runners with variable load. They are **not** a Lighthouse score, Core Web Vitals p75, a mobile field measurement, or a calibrated performance budget. One early mobile product sample showed nonzero CLS and a later sample recorded zero; that variability is explicitly under review rather than being concealed. Inspect the most recent workflow JSON before drawing a performance conclusion. No Lighthouse ≥90 claim is made.

V4 does not add runtime dependencies or build a backend, and retains Server Components, efficient catalog query pagination and locally optimized small AVIF demo files. A proper repeatable Lighthouse test at fixed CPU/network conditions, production CDN/origin checks and real-user web-vitals telemetry remain prerequisites before claiming no performance regression.

## Remaining work for real launch

1. Licensed actual per-product/per-variant photographs, without repeated ambiguous mock portraits.
2. Approved self-hosted/subsetted Persian font for consistent typographic experience.
3. Final product/business price/stock, shipping/returns policy, and legal support content.
4. Reproducible `package-lock.json`, backend/auth/payment/inventory integration, server environment validation.
5. Screen reader, 200–400% zoom and real-device/customer usability study; controlled Lighthouse and RUM measurements.
6. Real ParsPack VPS Docker/Nginx deployment smoke test. No live server deployment was performed in this task.

Local smoke test: `git pull origin main && npm install && npm run dev`. Browser address: `http://localhost:3000`.
