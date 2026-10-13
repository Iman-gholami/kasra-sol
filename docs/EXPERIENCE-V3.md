# KASRA / Experience Upgrade 3.0

**Scope:** targeted in-place improvements to the existing Persian RTL Next.js storefront. No new framework, backend, payment gateway, or third-party UI/animation package.

**Baseline:** design-refinement commit `83a737b` ([successful 8-test CI](https://github.com/Iman-gholami/kasra-sol/actions/runs/38364042896)). Reviewed actual 390px and 1440px Chromium screenshots from this version, with existing catalog, product, cart and checkout source. This is a **heuristic audit**, not research with recruited customers.

## Prioritized top 10 UX issues

| Priority | Source-observed issue | Experience 3.0 response | Status |
| --- | --- | --- | --- |
| P1 | Adding a product only showed an inline message; reviewing the cart required navigating away | Native accessible quick-cart dialog with cart lines, colors/sizes, subtotal, continue/review actions | Fixed |
| P1 | Size guide took shoppers to a separate route, interrupting color/size decisions | In-page size-guide dialog with clear **example-only** measurement notice and link to full guide | Fixed |
| P1 | Mobile homepage image consumed about `104vw` height before shopping entry points | Reduce portrait height to `81vw` at mobile widths and tighten introductory spacing | Improved |
| P1 | Header search offered only static category links, not relevant products | Normalized Persian query previews from at most 4 existing mock products, each with a compact thumbnail; complete search remains server driven | Fixed |
| P1 | Color filtering used an abstract dropdown with little visual feedback | Seven labelled radio options (including reset), with swatches, selected and keyboard-focus outlines | Fixed |
| P1 | Mobile menu lacked first-link focus and keyboard cycling | Initial focus, Escape dismissal, tab cycling, temporary scroll lock | Improved; manual screen-reader audit remains |
| P1 | Checkout lacked an explicit step hierarchy and did not focus invalid fields | Three-step **demo** progress indicator and first-error focus | Fixed |
| P1 | Reused generated model images do not correspond reliably to individual SKU variants | Keep conspicuous AI-demo disclosure, and avoid claiming any color-specific product photography | **Asset gap: remains** |
| P2 | Form/selection confirmations were visually detached from the actions | Move product feedback above the action, visible selected states, clear mini-cart acknowledgement | Improved |
| P2 | Prior screenshots covered only 390/1440 and default page states | Added screenshot capture for 320, 375, 390, 430, 1024, 1440 plus open size guide/filter/cart, cart and checkout | Fixed coverage gap; human testing still required |

No new P0 blocker was found in the **prior baseline**. This is not a blanket guarantee about future backend behavior.

## Three implementation passes

**Pass 1 — shopping friction:** quick cart + totals, in-page size guide, normalized search suggestions, visual color filtering, feedback and mobile menu keyboard flow.

**Pass 2 — art direction:** adjusted portrait composition and mobile hero rhythm rather than adding another full-screen banner; kept editorial wordmark, understated warm-neutral/rose system and small, consistent product cards.

**Pass 3 — polish and verification:** CSS-only interaction styling, dialog states, touch sizes, focus/keyboard support, checkout step communication; no new runtime dependencies. Screenshot coverage expanded to responsive and interactive states.

## Five customer walkthroughs

- **Casual discovery:** `/` → image-backed categories/new arrivals → product details. Hero now leaves more of the next section visible at 390px.
- **Targeted search:** header search → Persian normalized preview → `/search?q=...` → URL-controlled category/color/size filters.
- **Unsure of size:** product → open inline guide → close with Escape → choose a selectable size. General measurement examples are labelled as such.
- **Purchase decision:** select actual mock-stock color and size → add → quick cart with line total → review and adjust quantities on `/cart`.
- **Demo checkout:** cart → `/checkout` → three-step indicator, validation and focus guidance → simulated confirmation, without real data persistence or payment.

These were validated as scripted browser scenarios only; no live customer usability study was conducted.

## Visual QA and test evidence

- [Baseline screenshots](https://github.com/Iman-gholami/kasra-sol/actions/runs/38364042919): pre-v3 home, catalog and product at 390px and 1440px.
- [V3 functional CI and screenshots](https://github.com/Iman-gholami/kasra-sol/actions/runs/38366664624): lint, TypeScript, production build and **13/13 Playwright tests** passed on commit `6ea6664`.
- The `storefront-screenshots` GitHub Actions artifact contains 6 viewport sizes for home/catalog/product and 390px screenshots of filter drawer, size guide, mini cart, cart, checkout.
- Playwright tests include search, filtering, wishlist persistence, variant stock, demo checkout, keyboard Escape, image availability and horizontal overflow.
- Native dialogs manage modal focus for quick cart and size guide. Tab cycling is coded for the filter and mobile menu. **A complete screen-reader/zoom and WCAG audit has not been carried out.**

## Performance and architecture

No Lighthouse mobile score or real-user LCP/INP/CLS percentile has been measured; do not interpret passing Playwright tests as performance certification.

Measured from CSS **configuration**, not RUM: mobile hero image height changes from `min(104vw,510px)` to `min(81vw,350px)` at widths up to 600px (about 406px → 316px at 390px viewport width). This reduces initial visual distance to the first category entries. The quick cart is now mounted only while open; search previews are capped at four local mock items. Server pagination and CSS transitions are preserved.

Before launch, perform repeatable throttled Lighthouse tests on the same machine and Chrome version, gather RUM p75 Web Vitals per route/device, and test the intended ParsPack Docker/Nginx deployment. Do not infer a production capacity from the VPS specification.

## Known limitations

- The six small AI-generated images remain repeated across 36 mock SKUs and should not be confused with authentic product-specific photography.
- A properly licensed, performance-optimized Persian font is still needed for consistent typography on different devices.
- No verified stock, shipping promise, checkout backend, payment integration, order persistence, customer authentication or seller identity is present.
- Test automation covers key journeys, not all assistive technologies, browsers, visual regressions or real human behavior.
- Reproducible npm lockfile, production hosting smoke test, performance measurements and accessibility specialist review remain pre-release work.
