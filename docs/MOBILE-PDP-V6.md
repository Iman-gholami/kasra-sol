# KASRA BOUTIQUE — Mobile Product Experience 6.0

## Scope

The existing **Next.js 16 App Router, TypeScript, Persian RTL** product detail view was refined in place. No new framework or runtime packages; no changes to the product data model, category routes, checkout, wishlist persistence, Docker or deployment configuration.

The current source includes **six repeated, AI-generated demo images across 36 mock products**. This redesign does not claim they are genuine product or variant photos. Selected swatches do **not** change photos because no verified color-specific imagery exists.

## Mobile flow — implemented

1. **Photo gallery:** the first image is preloaded, gallery frame has reserved aspect ratio, horizontal touch gestures switch slides (with a vertical-motion threshold), previous/next buttons and a subtle image count. Noncritical thumbnails are lazy and hidden on phones; the image opens an accessible native zoom dialog.
2. **Product identity:** name and authentic sample-data price/compare-at and computed discount remain immediately after the compact gallery. No discounts or shipping guarantees were invented.
3. **Color/size selection:** swatches and sizes have labelled buttons with correct `aria-pressed`/disabled states. Changing to a color where the current size has no stock clears that size and announces the reason.
4. **Size guide:** the dialog opens from the option row, works with Escape and restores trigger focus. The former example numerical measurement table was removed because the store has no verified measurements for this SKU.
5. **Quantity:** existing stock maximum, minimum 1 and cart-quantity rules are preserved.
6. **Purchase:** when the main Add button is outside the viewport, `IntersectionObserver` activates a small fixed bar on phones up to 600px. The bar respects viewport safe areas, has an inert/hidden state, hides when the original CTA becomes visible, and does not appear over the size guide, zoom or mini-cart. When the selection is missing it scrolls and focuses the relevant option, not the cart.
7. **Feedback:** a valid add updates the existing in-memory/localStorage cart, keeps color, size and quantity, confirms within the page and exposes a view-cart link plus an **optional** mini-cart button. There is no forced redirect/modal.
8. **Supporting detail:** compact, honest shipping/returns text and sample-only apparel metadata follow the purchase flow. Disclosure that images, pricing and inventory are demonstrative remains visible.

## Implementation boundaries

- `src/components/products/product-detail.tsx`: gallery, touch handler, dialogs, selection and sticky CTA. The product image and option buttons are all kept within a single small client component already present in the architecture.
- `src/app/globals.css`: narrowly scoped `.pdp` styles and phone-only fixed purchase bar. Reduced-motion preferences are respected. Estedad remains self-hosted.
- `tests/pdp.spec.ts`: focused Playwright checks for swipe vs vertical gesture, image zoom, size invalidation, sticky focus and hiding, keyboard focus restoration, six viewport widths, RTL, Estedad and horizontal overflow.
- `tests/store.spec.ts` and `tests/visual.spec.ts`: existing cart cases adjusted for nonblocking confirmation; screenshots cover the new phone gallery/CTA and options.

## Visual evidence

The CI artifact named `storefront-screenshots` includes full-page product screenshots at **320, 375, 390, 430, 1024, 1440 and 1800 pixels**, along with a 390px gallery-with-sticky screenshot, size guide and options. Compare with the **previous Estedad/V4 baseline run** rather than comparing different images or using a screenshot as evidence of actual inventory.

Previous baseline: [Estedad 8.5 / V4 full CI](https://github.com/Iman-gholami/kasra-sol/actions/runs/38376836912). Latest verification: [Storefront CI history](https://github.com/Iman-gholami/kasra-sol/actions/workflows/ci.yml). Always check the **latest** workflow result before declaring deployment readiness.

## Comparable laboratory measurements, not field CWV

Method: pinned V4 and V6 release candidates each built with Next.js production output and sampled with the same existing `scripts/measure-lab.cjs` on GitHub Actions Chromium. **Unthrottled and on separate CI runners**; median five samples at 390px for the product route are shown as descriptive observations only.

| Metric | V4 Estedad baseline | V6 candidate |
| --- | ---: | ---: |
| Product 390px CLS samples | 0 / 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 / 0 |
| Product 390px FCP median | 76 ms | 64 ms |
| Product 390px LCP median | 80 ms | 64 ms |
| Product 390px JavaScript transfer | 158,695 bytes | 159,920 bytes |
| Product 390px total transferred resources, approx | 328,007 bytes | 329,302 bytes |
| Product 1440px CLS single sample | 0 | 0 |

These unthrottled lab results **do not prove real-user performance gains** or satisfy a Lighthouse target. The JS cost rose by 1,225 transferred bytes in this CI setup; apparent lower FCP/LCP can reflect runner variability, and neither dataset measures field **INP**. The intended field thresholds (LCP ≤2.5s / INP ≤200ms / CLS ≤0.1) remain goals to verify on real devices and hosting.

## Remaining limitations

- Use real rights-cleared per-product and per-variant images and actual inventory before commercial launch.
- Obtain verified item measurements before displaying a size chart. Existing size-guide page is generic.
- Test on physical iOS Safari/Android Chrome, screen readers, zoom and open keyboard; browser automation does not establish WCAG compliance.
- No real payment, shipping, order persistence, domain/VPS deployment or production field Web Vitals were added or claimed.

Local check: `git pull origin main && npm install && npm run dev`, then open `http://localhost:3000/product/shomiz-01`.
