# Shop by Color 8.0 — Implementation and QA

## Scope and visual source

Implemented as an **in-place section addition** to the Persian RTL Kasra Boutique homepage. It appears **after** the existing clothing-category cards and **before** the New Arrivals section. No hero, product-detail, checkout, wishlist backend, Docker or Nginx redesign was undertaken.

The provided paste supplies detailed art-direction text but **no image file of the approved reference was available for direct pixel comparison**. The new section follows the specified centered editorial heading, warm ivory canvas, minimal rounded swatch capsules, rose-accent selected outline, four clean existing product cards and a centered CTA. Exact pixel fidelity to an unseen image is not claimed.

## Data model and actual available colors

**The six real mock color families** are cream (کرم), black (مشکی), rose (رز خاکی), sage (سبز سدری), blue (آبی دودی) and white (سفید). Brown, pink, and olive were not added as fabricated sellable colors: they are examples in the design brief, not product variants in this dataset.

`src/types/store.ts` extends `ProductColor` with optional `familyId` for explicitly grouping a future specific shade with a broader color family. Existing colors default to their own ID, so no migration is required.

The **server-only** `src/lib/shop-by-color.ts` defines `ColorFamily` and `ShopByColorResult` and exposes `getShopByColorResults()`. It walks the mock catalog once, admits products only when they have a corresponding **actual color variant**, deduplicates each product within a family, orders labels by configured palette, and returns at most **four lightweight product-card summaries per family**. Each summary includes only ID, slug, name, category, price/compare price, thumbnail and available color metadata — **not** all stock rows, descriptions or full image galleries.

The adapter returns the true number of products with variants in that color; it does **not** invent inventory or represent unavailable photo hues as verified. `src/lib/catalog.ts` uses the shared color-family match logic so the View All link `/shop?color=cream` applies the same membership semantics server-side.

This bounded static initial payload gives immediate client-side color switching with no network request, no debounce and no stale-response problem. The future production replacement is one batched server API returning color facets and capped previews; full results should be paginated at the existing catalog endpoint. For hundreds of color families, only initial facets should be transferred and previews requested on demand.

## Interaction and accessibility

- Defaults to **cream** whenever cream has matching products, otherwise the first matching color.
- Selected pill has a rose outline; buttons expose Persian color names and `aria-pressed`.
- Color change instantly swaps a stable four-card, 4-column desktop/2-column mobile preview without reloading the homepage.
- The row can scroll horizontally in native RTL on narrow phones but never increases the document width.
- Existing `ProductGrid`/`ProductCard` handle wishlist toggles, links, prices and discounts; product detail and cart code are unchanged.
- CTA points to exactly `/shop?color={selectedSlug}`; back navigation remains native.
- A visible, concise disclaimer says **AI-generated demo imagery may not show the currently selected product color**. The six shared lookbook images are NOT per-SKU or per-variant photos; the project has no verified variant-specific image sources.
- Keyboard focus indication and reduced-motion behavior are respected.
- No new npm runtime dependencies or heavy animations were introduced.

## Files changed

| File | Change |
| --- | --- |
| `src/lib/shop-by-color.ts` | Typed, capped server mock adapter and explicit variant-family matching |
| `src/components/home/shop-by-color.tsx` | Small stateful client section |
| `src/components/products/product-card.tsx`, `product-grid.tsx` | Accept lightweight card summary type without duplicate card code |
| `src/app/page.tsx` | Fetch bounded server preview options and place section after categories |
| `src/types/store.ts` | Optional future family identifier on product colors |
| `src/lib/catalog.ts` | Apply family matching consistently to existing URL query |
| `src/app/globals.css` | Editorial color pills, preview layout and responsive styling |
| `tests/shop-by-color.spec.ts`, `tests/visual.spec.ts` | Navigation, variant, wishlist, overflow and 320–1440px screenshot coverage |

## Verification and remaining work

Run `npm run lint`, `npm run typecheck`, `npm run build` and `npm run test:e2e`, or inspect [Storefront CI](https://github.com/Iman-gholami/kasra-sol/actions/workflows/ci.yml) for actual executed results and downloadable screenshots. The focused tests cover: placement, six derived options, initial cream selection, four previews per color, catalog parity, a product with multiple colors, exclusion of black-only mismatch, CTA navigation and browser back, wishlist preservation, keyboard selection, RTL and document overflow at **320, 375, 390, 430, 768 and 1440px**.

**Limitations:** The current 36 demo products have only six repeated AI-generated editorial images. They cannot prove a garment's true variant color or availability; genuine color-specific licensed product photos are required before launch. No user research, real field Core Web Vitals, production image CDN or VPS deployment has been performed.

Local preview: `git pull origin main && npm install && npm run dev`, then visit the homepage at `http://localhost:3000`.
