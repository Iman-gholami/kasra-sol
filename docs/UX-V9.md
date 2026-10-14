# Kasra Boutique — UX V9: desktop and mobile overhaul

V9 rebuilds the presentation and interaction layer of the storefront. The order was audit
([UX-AUDIT-V9.md](UX-AUDIT-V9.md)), then tokens and primitives, then desktop, then mobile. Product data, the
cart/wishlist store contract (`shop-provider`), routes, query parameters, API shapes,
Docker/Nginx/CI and the demo-only checkout boundary are unchanged. No fake reviews, urgency, discounts
or social proof were added. The only new dependency is the dev-only `@axe-core/playwright`.

The audit came first; this document records what was built, why, and how it was verified.

## 1. What changed and why

| Area | Before (audit IDs) | V9 |
| --- | --- | --- |
| Styles | Six stacked override layers in one 1,095-line file; 30+ physical `left/right` (cross-cutting 1) | Token stylesheet `src/styles/tokens.css` plus eight layered modules (`base`, `primitives`, `layout`, `home`, `catalog`, `product`, `commerce`, `content`) using logical properties only |
| Overlays | Three different implementations; inconsistent Escape, focus return and scroll lock (cross-cutting 2) | One `Sheet` primitive on native `<dialog>.showModal()`: top layer, inert background, Escape via `cancel`, focus in and back, scroll lock, enter/exit motion, optional swipe-to-dismiss. Variants: `sheet-bottom`, `sheet-start`, `sheet-end`, `sheet-center`, `sheet-full`, `sheet-dropdown` |
| Prices | `tabular-nums` padded the Persian separator ("۵۸۹ , ۰۰۰") (cross-cutting 3) | Proportional figures everywhere: "۵۸۹٬۰۰۰ تومان"; currency never below 12 px |
| Separators | "M · ۱" read as "۱۰" (cross-cutting 4) | Persian comma "،" and labelled pairs ("سایز M، تعداد ۱") |
| Header | Category links crowded the bar; search a bare icon (D2.x) | Server header shell; "همه محصولات" link plus a disclosure panel; field-styled search trigger with the "/" shortcut; Persian count badges with a polite live region |
| Catalog | Filters hidden behind a toolbar; full reloads; no page numbers (D4.x, M4.x) | Sticky sidebar on desktop with instant client navigation (one history entry per change); bottom sheet on ≤ 820 px showing the real "نمایش N کالا"; removable chips; numbered pagination; scroll and filter restoration on Back |
| Search | Separate dialog behaviour per breakpoint (D4.x) | One combobox (`aria-activedescendant`), anchored dropdown on desktop, full-screen on phones, recent searches, error and retry, first Escape clears and second closes |
| PDP | CTA below the fold at 1280×720; gallery used custom touch math; zoom off-centre (D5.x, M5.x) | Sticky buy column; thumbnail rail; native RTL scroll-snap gallery; magnify-and-pan zoom (click, double tap, keyboard); size guide as a sheet; mobile purchase bar that summarises the chosen variant and reserves its own height |
| Cart | Remove was final; skeleton swap caused CLS 0.157–0.279 (D6.x) | In-place undo, stable line order, sticky summary on desktop, thumb-zone task bar on phones, skeleton with the final geometry (CLS 0) |
| Checkout | Errors only on submit; inconsistent input modes (D6.x, M6.x) | Visible labels, `aria-describedby` errors, blur validation, focus moves to the first problem, `autocomplete`/`inputmode` tokens, Persian and Latin digits accepted, +98/0098 normalised, collapsible order summary on phones, "fill sample data" helper, honest demo-only success |
| Mobile navigation | Hamburger only (M2.x) | Bottom navigation on browsing pages; task pages (product, cart, checkout) show their own action bar instead |
| System states | English or generic 404/error, layout jumps on loading (D7.x) | Persian 404 and error boundary with recovery links, `loading.tsx` skeletons per route group, toasts for wishlist/cart feedback |
| Content pages | ~100 characters per line (D8.x) | One content template, measured at 55–59 characters per line on desktop; accessible FAQ accordion and size table |

## 2. Tokens

All tokens are in `src/styles/tokens.css`. Color, type, shape, depth and motion are Tailwind 4
`@theme` tokens (CSS variables plus utilities). Spacing, layout, z-index and durations are plain
`:root` variables.

| Group | Values |
| --- | --- |
| Color roles | `surface` #faf8f5, `surface-raised` #fff, `surface-muted` #f1ece6, `surface-sunken` #e8dfd4, `text` #222 (13.6:1), `text-muted` #615852 (5.9:1), `text-subtle` #6b6158 (5.1:1), `accent` #7d453f (6.4:1), `accent-soft` (decorative only), `border`, `border-strong` (3.8:1 for controls), `success`, `warning`, `danger` with washes, `focus`, `scrim`. Ratios are measured against `surface-muted`, the darkest text background |
| Type | Estedad variable (400–800) via `--font-sans`; Georgia for the KASRA wordmark; fluid scale `xs` 12 px → `display` clamp(2.25rem … 4.25rem); body line-height 1.85, headings 1.4 |
| Space | 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 px; gutter clamp(16px, 4vw, 48px); section gap clamp(40px … 88px) |
| Layout | containers 1440 (page), 1520 (editorial), 1200 (checkout), measure 68ch; header 68 px (58 px on phones); `--touch` 44 px; safe-area insets |
| Shape and depth | radii 2 / 6 / 16 px / pill; shadows 1 (bars), 2 (popovers), 3 (dialogs) |
| Layers | raised 2 · sticky 20 · header 40 · bottom bar 45 · toast 60 · skip link 80; overlays use the top layer |
| Motion | 120 / 200 / 320 ms; standard, enter and exit easings; everything collapses under `prefers-reduced-motion` |
| Breakpoints | 600 (phone) · 820 (tablet) · 1080 (small laptop) · 1440 (wide) |

## 3. Component inventory

Server Components by default; client islands are as deep as interaction allows.

| Component | Kind | Notes |
| --- | --- | --- |
| `ui/sheet.tsx` (`Sheet`, `useMountedOnce`) | client | Dialog/drawer/bottom-sheet/dropdown primitive. Content mounts on first open, then stays mounted so its state survives. `swipe: 'down' \| 'start' \| 'end'` dismiss with a velocity/distance threshold; buttons and Escape always work too |
| `ui/document-flags.ts` | client | `markModal` (scroll-lock counter) and `useBottomBar` (which bottom bar reserves space). Attribute flags on `<html>` replace document-level `:has()` selectors, which were measurably slower to style |
| `ui/toast.tsx` | client | One polite live region, 6 s auto-dismiss that pauses while hovered or focused, optional link action |
| `ui/quantity-stepper.tsx` | client | − / value / +, labelled per item, `md` and `lg` (44 px) sizes |
| `ui/skeletons.tsx` | server | Catalog and page skeletons that match final geometry |
| Buttons, chips, fields, accordion (`primitives.css`) | CSS | `btn-primary/secondary/tertiary/ghost`, `sm`/`lg`/`block`; `chip` with remove; `field` with label, hint and error; `details.accordion` (native, SVG mask chevron that flips in RTL). The sort "dropdown" is a native `<select>` with an apply button (WCAG 3.2.2) |
| `layout/header.tsx` | server | Shell; announcement is a labelled `<aside>` landmark |
| `layout/primary-nav.tsx` | client | Disclosure panel (WAI-ARIA disclosure, not `role=menu`), hover intent 150/250 ms |
| `layout/mobile-menu.tsx` | client | `sheet-start` drawer |
| `layout/header-actions.tsx` | client | Wishlist/cart badges, live count announcement |
| `layout/bottom-nav.tsx` | client | Phones only, browsing pages only, hides while a text field has focus |
| `layout/footer.tsx`, `breadcrumbs.tsx` | server | Full-width 44 px rows on phones |
| `search/search-launcher.tsx`, `search-experience.tsx` | client | Trigger plus combobox; uses the existing `/api/search-suggestions` endpoint and response shape |
| `catalog/catalog-shell.tsx` | client | `useTransition` navigation context; `data-pending` dims results |
| `catalog/catalog-filters.tsx` | client | Sidebar plus sheet sharing one draft; price validation |
| `catalog/catalog-view.tsx` | server | Heading, chips, grid, pagination |
| `lib/catalog-url.ts` | shared | `catalogHref` builds the **existing** query-string contract in one place |
| `products/product-card.tsx`, `price.tsx`, `product-grid.tsx` | server | One tab stop per card (stretched title link) plus wishlist island. Card image loading is `lcp` / `eager` / `lazy` |
| `products/wishlist-button.tsx` | client | `aria-pressed` with a toast |
| `products/product-gallery.tsx` | client | Scroll-snap track, thumbnails, dots, arrows, `ZoomView` |
| `products/purchase-panel.tsx` | client | Variants, quantity, add to cart, size guide sheet, sticky mobile bar |
| `cart/mini-cart.tsx`, `use-cart-lines.ts`, `line-details.tsx`, `cart-page.tsx` | client | Drawer, stable order and undo built only on the existing store API |
| `checkout/checkout-page.tsx` | client | Validation and normalisation are presentation-side only; the demo boundary is unchanged |

`shop-provider.tsx` keeps its store logic and public contract. The mini-cart markup moved to
`cart/mini-cart.tsx`. The provider now exposes a memoised `{ isCartOpen, openCart, closeCart }` that
already existed in its state.

## 4. Decisions and trade-offs

1. **Disclosure panel, not a mega menu.** Three categories don't fill mega-menu columns. They stay
   one click away as plain links. The panel adds what a bar can't: category photos, the six real
   colour families, "تازه‌ترین‌ها", "تخفیف‌دارها" and the size guide. All of these use existing query
   parameters.
2. **Sidebar filters with live apply on desktop, a bottom sheet on ≤ 820 px.**
   - Each discrete change is one history entry, so Back undoes a filter.
   - Price applies on Enter or its button, after validation.
   - In the sheet, changes apply behind it (`replace` after the first change) so the footer shows
     the real count, not an estimate.
3. **Bottom navigation only on browsing pages.**
   - Product, cart and checkout replace it with their task bar, so two bars never stack.
   - It hides while a text field is focused, because the on-screen keyboard would push it up.
   - Its height is reserved through `--bottom-bar-space`. `scroll-padding-block` keeps focused
     elements clear of it (WCAG 2.4.11).
4. **Both the cart page and the drawer stay.** The header icon goes to `/cart`, which is
   predictable, shareable and works without JS. The drawer ("سبد سریع") is the optional quick
   check after adding an item.
5. **One search combobox in two placements:** an anchored dropdown on desktop and full-screen on
   phones. The keyboard model and recent searches are identical.
6. **RTL swipe direction.**
   - The gallery is a native scroll-snap track. In RTL the next image sits to the left, so dragging
     the finger to the right reveals it.
   - This matches the arrows, the dots and how native RTL scrollers behave.
   - The pre-V9 test asserted the LTR gesture against custom touch math. See §5.
7. **Drawers follow the inline axis.** The menu opens from the start (right) edge and the cart from
   the end (left) edge, the side the cart icon is on. Transforms use an `--inline-sign` variable, so
   flipping `dir` needs no new CSS.
8. **Checkout helpers are honest.**
   - "Fill sample data" is labelled as a demo aid.
   - Success says the demo is complete, never "order placed".
   - Accepted inputs: Persian or Latin digits, `+98`/`0098` prefixes, spaces in the mobile number,
     and dashes in the postal code.
9. **The SEO exception is kept.** `robots: noindex` stays deliberately, so a store with fictional
   products is not indexed. Lighthouse SEO is therefore 63–66 on every route. The only failing audit
   is `is-crawlable`; every other SEO audit passes.
10. **No heavy dependencies.** Gestures, sheets, zoom, toasts and focus management are a few small
    hooks on platform features: `<dialog>`, scroll snap, `@starting-style`, `transition-behavior:
    allow-discrete`, and `IntersectionObserver` and `ResizeObserver`.

## 5. Changes to existing tests (flagged)

The baseline suite had 39 tests, and 37 passed in this environment. Three existing test files
changed; no assertion was weakened.

| File | Change | Why |
| --- | --- | --- |
| `pdp.spec.ts` swipe test | Uses real CDP touch drags in a `hasTouch`/`isMobile` context. The swipe direction changed to finger right = next | Synthetic DOM `TouchEvent`s never scroll a native scroller, and the old direction was the LTR convention. Vertical-drag, zoom and Escape assertions are unchanged |
| `pdp.spec.ts` sticky bar test | Unchanged assertions | It was flaky in the baseline: it measured the bar mid-transition. The bar now reveals with `clip-path`, so its box never moves |
| `visual.spec.ts` | `img.decode()` raced against 3 s | Decode never settles for lazy images that haven't loaded yet in Chromium 141 (a baseline timeout) |
| `playwright.config.ts` | Optional `PLAYWRIGHT_CHROMIUM_EXECUTABLE` | Lets you use a preinstalled Chromium. CI is unaffected |

New test files:
- `desktop-v9.spec.ts` (10 tests): skip link, nav disclosure (keyboard and hover), search keyboard,
  filters apply/Back/clear, grid columns, PDP above-the-fold CTA, sticky buy box, variant and add,
  zoom keyboard, cart quantity and undo, checkout validation, catalog restoration.
- `mobile-v9.spec.ts` (9 tests, touch-emulated): bottom nav, drawer swipe and focus, filter sheet
  count and swipe, purchase bar, cart thumb zone, checkout keyboards and errors, and a target/text/
  overflow audit at 360, 390 and 412.
- `a11y.spec.ts` (5 tests): axe-core on 17 routes and every overlay, at 1440 and 390, plus a
  reduced-motion test: overlays and the gallery work, and transitions are effectively off.

## 6. Results

RESULTS_PLACEHOLDER

## 7. Manual checks

Done by hand in Chromium, in addition to the automated tests:

- **Screenshot review.** Every route and overlay state was rendered at 360, 390, 412, 768, 1024,
  1280, 1440 and 1920 px, after each phase. That means 22 route states and 13 overlay states.
  `scripts/capture-ux.cjs` regenerates them.
- **Cross-breakpoint pass at 768 and 1024**, where layouts switch:
  - 768 px: sheet filters, a 3-column grid, a stacked PDP, no bottom nav.
  - 1024 px: sidebar filters, the sticky buy column, the desktop header.
- **Back/Forward:**
  - Returning from a product restores the catalog scroll position and filters.
  - Each live filter change is one history entry.
  - Bottom-sheet filter changes collapse into one entry.
- **Line length** on content pages: 55–59 characters per line at ≥ 1024 px, against ~100 before.
- **Persian digits and bidi:**
  - Prices, counts, badges, pagination, the gallery counter ("۱ / ۲") and the checkout summary all
    use Persian digits.
  - Latin size codes (S/M/L), phone and postal fields, the wordmark and user-typed queries are
    isolated runs (`dir="ltr"` or `dir="auto"`).
  - Accessible names were checked for stray spaces around isolated runs.
- **Physical-direction audit** of the CSS: no `left`/`right` remains. The single LTR exception is the
  wordmark's letter-spacing balance, written as `padding-inline-start` inside its `dir="ltr"` box.
- **Directional icons:**
  - Previous points right and next points left: pagination, gallery, zoom.
  - Forward CTAs use ←.
  - The accordion chevron flips in RTL.

LANDSCAPE_PLACEHOLDER

Not done: real phones and tablets, screen readers, Safari/Firefox, Windows High Contrast on a real
system, and slow real networks. See §8.

## 8. Limitations and backlog

Limitations (known, not hidden):

- **Mobile LCP is above 2.5 s on several routes in Lighthouse's simulated Moto G / slow-4G run.**
  This was also true of the baseline. See §6 for numbers.
  - The LCP image now starts loading almost immediately: its load delay is 0–0.3 s, against
    1.5–2.4 s in the baseline.
  - The remaining time is render delay, which lantern charges for hydration script that runs before
    the observed paint.
  - V9 hydrates more interactive UI on `/shop`: the sidebar form and the bottom nav. The `/shop`
    document is 104 KB against 81 KB before (12.9 KB against 11.0 KB gzipped).
- **No real devices or assistive technology were used.**
  - Touch was emulated through Chrome DevTools Protocol touch events.
  - No VoiceOver, TalkBack or NVDA pass was run.
  - Only Chromium 141 was tested. WebKit and Firefox Playwright browsers are not installed here.
- **Safari and Firefox exit animations.** Closing a sheet relies on `transition-behavior:
  allow-discrete` and the `overlay` property. Where `overlay` is unsupported, the sheet closes
  instantly instead of sliding out. Behaviour (focus, Escape, scroll lock) is unaffected.
- **Image quality.** The six demo photos are 480×640 AVIFs, so zoom magnification is capped and the
  editorial imagery is softer than a real shoot would be.
- **SEO 63–66** is the intentional `noindex` (§4.9).
- **Lighthouse variance** on this shared 4-vCPU container is ±300–500 ms LCP between identical runs.
  Medians of three runs are reported for home, shop and product; the other routes had one run.

Backlog, in priority order:

1. **P1 — device and screen-reader QA:** iOS Safari 17/18 (dialog, focus-in-gesture keyboard,
   safe areas, rubber-band scrolling under the sheets), Android Chrome with TalkBack, VoiceOver on
   macOS, and NVDA with Firefox.
2. **P1 — subset the Estedad font** (121 KB) to the Persian and Latin ranges in use. This is the
   largest remaining LCP lever on slow networks. It changes the vendored binary, so it was deferred
   (audit §4).
3. **P1 — less hydration before LCP:**
   - Load the code for the search experience, mini cart and filter sheet with `import()` on idle
     or on first intent.
   - Keep the synchronous open that iOS needs to raise the keyboard: render the preloaded module.
   - Re-measure with medians of 5 runs.
4. **P2 — real product photography** of at least 1200 px on the long edge, with per-variant images.
   Then remove the zoom cap and the "colour may differ" note.
5. **P2 — WebKit and Firefox Playwright projects** in CI, and pixel-diff baselines for
   `visual.spec.ts`, which today captures but does not compare.
6. **P2 — field data:** web-vitals RUM (LCP, INP, CLS) once deployed. Lab INP is not measurable
   with Lighthouse navigation runs.
7. **P2 — when a real catalogue exists:** remove `noindex`, and add `Product` structured data that
   uses only real values (no invented ratings).
