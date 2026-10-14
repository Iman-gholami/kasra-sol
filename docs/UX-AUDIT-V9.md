# Kasra Boutique — UX Audit V9 (desktop first, then mobile)

Scope: presentation and interaction layer of the existing Persian RTL storefront. Product data, the
cart/wishlist store contract, routes, query parameters, APIs, deployment and the demo-only checkout
boundary are out of scope and stay unchanged. Earlier work this audit builds on: `EXPERIENCE-V3`,
`DESIGN-V4`, `DESIGN-REFINEMENT`, `MOBILE-PDP-V6`, `PRODUCT-DISCOVERY-V7`, `SHOP-BY-COLOR-V8`.

Method: heuristic review of production-build screenshots at 360, 390, 412, 768, 1024, 1280, 1440 and
1920 px for 22 route states and 13 overlay states, a DOM probe on every route/width (overflow, target
sizes, text sizes, heading count, fixed layers, line length), axe-core 4.14, and Lighthouse 12.8.
Guidelines cited: WCAG 2.2 AA, Apple HIG (44 pt targets, 16 px inputs), Material 3 (motion, bottom
navigation), Baymard Institute e-commerce research (filtering, product page, cart and checkout).
This is an expert review, not a study with recruited shoppers.

## 0. Baseline (commit `5d92682`)

Environment: Linux container, 4 vCPU, Node 22.22, npm 10.9, Next.js 16.3.5 production build
(`next build`, standalone `node server.js`). Browser: the preinstalled Chromium 141.0.7390.37 —
Playwright 1.64 expects its own Chromium 156, so `playwright.config.ts` now accepts an optional
`PLAYWRIGHT_CHROMIUM_EXECUTABLE` override (CI is unaffected and still installs its own browser).

| Check | Result |
| --- | --- |
| `npm run lint` | pass |
| `npm run typecheck` | pass |
| `npm run build` | pass (58 static pages) |
| `npm run test:e2e` | **37 / 39 pass**. Two failures reproduce serially in this environment: `pdp.spec.ts` "sticky mobile action…" measures the bar mid-transition (bottom 886 > 845), and `visual.spec.ts` "capture editorial layout…" times out because `HTMLImageElement.decode()` never settles for not-yet-loaded lazy images in Chromium 141. Both are test-timing issues, not product defects; they are fixed in V9 without weakening assertions. |
| Client JS (all chunks, raw) | 673,827 B |
| CSS (raw / transferred) | 77,350 B / 16,605 B |
| Heaviest transfer on `/` | Estedad variable font 121 KB, framework chunk 72 KB |

### Lighthouse 12.8.2 (production build, one run per cell, simulated throttling)

Mobile = Lighthouse default (Moto G Power emulation, 4× CPU slowdown, slow 4G). Desktop = `--preset=desktop`.

| Route | Mobile P / A11y / BP / SEO | Mobile LCP · CLS · TBT | Desktop P / A11y / BP / SEO | Desktop LCP · CLS |
| --- | --- | --- | --- | --- |
| `/` | 97 / 96 / 100 / 66 | 2.56 s · 0 · 42 ms | 100 / 96 / 100 / 66 | 0.60 s · 0 |
| `/shop` | 95 / 94 / 100 / 66 | 3.01 s · 0 · 44 ms | 100 / 94 / 100 / 66 | 0.59 s · 0 |
| `/product/shomiz-01` | 94 / 96 / 100 / 66 | 3.09 s · 0 · 40 ms | 100 / 96 / 100 / 66 | 0.59 s · 0 |
| `/search?q=شومیز` | 94 / 94 / 100 / 66 | 2.93 s · 0 · 109 ms | 100 / 94 / 100 / 66 | 0.73 s · 0 |
| `/cart` | 88 / 95 / 100 / 63 | 2.86 s · **0.157** · 96 ms | 86 / 95 / 100 / 63 | 0.69 s · **0.279** |
| `/checkout` | 88 / 95 / 100 / 63 | 2.86 s · **0.157** · 72 ms | 86 / 95 / 100 / 63 | 0.69 s · **0.279** |
| `/faq` | 96 / 93 / 100 / 63 | 2.71 s · 0 · 94 ms | 100 / 93 / 100 / 63 | 0.57 s · 0 |

- **SEO 63–66 is caused only by `is-crawlable`**: the root layout deliberately sets
  `robots: { index: false, follow: false }` so a store with fictional products is not indexed. Every
  other SEO audit passes. Removing `noindex` would conflict with the "demonstration only" honesty
  constraint, so V9 **does not change it**; the SEO ≥ 95 target is reported with this exception.
- Mobile LCP misses 2.5 s on product listing and product routes. The LCP breakdown shows render delay
  of 1.7–2.6 s after a ~0.9 s FCP: the main thread is busy evaluating ~600 ms of script (hydration).
  On `/shop` and `/search` the LCP element is a product image rendered with `loading="lazy"`.
- Cart/checkout CLS comes from a client-only skeleton being replaced by the real content.

### axe-core 4.14 (16 routes × desktop 1440 and mobile 390, cart and wishlist pre-filled)

| Impact | Rule | Nodes | Where |
| --- | --- | --- | --- |
| serious | `color-contrast` | 61 | every route — `#786f67` text on `#f1ece6` = 4.18:1 (struck-through prices, Latin stamps, catalog counts) |
| moderate | `region` | 32 | `.announcement` sits outside every landmark |
| moderate | `heading-order` | 22 | catalog/search/wishlist/related grids jump from `h1` to card `h3`; FAQ, static pages |

### DOM probe (8 widths × 22 route states)

- **Horizontal overflow: none** at any width or route (good baseline to protect).
- One `h1` on every route.
- Interactive targets below 44 × 44 px (excluding inline text links): 469 at 360 px, 448 at 390 px,
  496 at 1440 px across 21–22 routes. Repeated offenders: footer links (20 px tall), breadcrumbs
  (18 px), header icon buttons (40 × 42 at ≤ 600 px), brand link (32 px), card "انتخاب سایز" link
  (33 px), `<summary>` rows (21–24 px), "حذف" link (41 × 36), size-guide trigger (35 px).
- Text below 12 px: 284 instances at 360 px, 142 at 1440 px — announcement bar (10.9 px), discount
  tag (9.9 px), product category (11.8 px), footer bottom row (11 px), Latin "edit" stamps (10 px),
  count badges (11 px, Latin digits).
- Approximate line length on static pages at ≥ 1024 px: ~100 characters per line.

Evidence files (scratch, regenerated by `scripts/capture-ux.cjs`): `pages/<route>-<width>.png`,
`pages/<route>-<width>-fold.png`, `states/<state>-<width>.png`, `probe.json`. Screenshot names below
refer to that layout.

## 1. Cross-cutting findings that drive the plan

1. **The stylesheet is six stacked override layers** (V3 → V4 → V6 → V7 → V8) in one 1,095-line
   file. `.hero h1` is declared six times, `.product-info h3` five times; physical `left`/`right`
   appear 30+ times. Every change risks a regression at another breakpoint. Fixing visual issues
   one by one on top of this would add a seventh layer.
2. **Overlays are built three different ways**: native `<dialog>` (search, size guide, zoom, mini
   cart), a custom `aside[role=dialog]` with a hand-written focus trap (filters) and an absolutely
   positioned `<nav>` (mobile menu). Escape, focus return, scroll lock, inert background and motion
   differ between them.
3. **Prices look broken.** `font-variant-numeric: tabular-nums` makes Estedad pad the Persian
   thousands separator to a full digit width: "۵۸۹ , ۰۰۰ تومان" on every card, PDP and sticky bar
   (`product-1280-fold`, `home-1440`). The cart (no tabular figures) shows "۵۸۹٬۰۰۰".
4. **Middle-dot separators read as Persian zero.** "M · ۱" is rendered as "۱۰ × M" in the checkout
   summary and "M·۱۰ عدد" in the mini cart (`checkout-filled-1440`, `states/mini-cart-390`) — a
   shopper can read "10 items".

## Part A — Desktop (1024, 1280, 1440, 1920; 768 as transition)

Severity: **P0** blocker · **P1** major · **P2** polish. Effort: S ≤ ½ day, M ≤ 2 days, L > 2 days.

### Topic 1 — Layout and visual system

| ID | Route · viewport | Evidence | User impact | Sev | Proposed fix | Effort |
| --- | --- | --- | --- | --- | --- | --- |
| D1.1 | all · all | `globals.css` | Unpredictable styling, regressions between breakpoints, slow iteration | P1 | Rebuild CSS into token → base → primitives → layout → sections layers; logical properties only | L |
| D1.2 | `/shop` · 1440×900 | `shop-1440-fold` | First product row starts at y≈506; only ⅓ of the first card is visible | P1 | Compact catalog header (h1 + count on one row, short intro), toolbar merged with chips; products above y≈360 | M |
| D1.3 | `/shop` · 1280–1599 | `shop-1440` | 3 columns of 380 px cards (507 px tall) — slow scanning, 4 rows per page | P2 | 3 columns at 1024–1439, 4 at ≥ 1440 (12 items = 3 balanced rows) | S |
| D1.4 | `/checkout` · 1440 | `checkout-filled-1440` | Progress bar spans the container but the form/summary grid is a narrower centered box — summary floats 80 px off the grid | P1 | Align checkout grid with progress; sticky summary | S |
| D1.5 | PDP zoom · ≥ 1024 | `states/zoom-1440` | Zoom dialog docks to the right edge instead of centering (Tailwind preflight removes the dialog's `margin:auto`) | P1 | Dialog primitive owns placement for every variant | S |
| D1.6 | all | CSS | 9 radii values, 9 shadows, 7 font weights, 6 durations | P2 | Token scale (4 radii, 3 elevations, 4 weights, 3 durations) | S |
| D1.7 | `/`, catalog | source | `sizes` disagree with layout: wide first category tile declared 33vw; catalog cards 25vw in a 3-col grid | P2 | Per-layout `sizes`; priority on above-the-fold images | S |
| D1.8 | `/` · all | `home-1440` | Latin numbering stamps ("THE KASRA EDIT / COLLECTION / 01", "01 / 03", "THE EDIT / 2026") at 10–11 px add noise and fail the 12 px floor | P2 | Remove numbering stamps; keep the KASRA wordmark as the one Latin accent | S |
| D1.9 | footer · all | `product-1440` | Link rows 20 px tall, English slogan at 11 px, demo note repeated twice | P2 | Footer rhythm on the spacing scale, 32 px desktop link rows | S |

### Topic 2 — Navigation and wayfinding

| ID | Route · viewport | Evidence | User impact | Sev | Proposed fix | Effort |
| --- | --- | --- | --- | --- | --- | --- |
| D2.1 | all · ≥ 821 | `shop-1440-fold` | Header nav has no current-location indication (no `aria-current`, no active style) | P1 | Active underline + `aria-current="page"` | S |
| D2.2 | all · ≥ 821 | `home-1440-fold` | Search is a bare 44 px icon; the most valuable discovery tool is the least visible | P1 | Field-styled search trigger with placeholder and a `/` shortcut | S |
| D2.3 | header · ≥ 821 | `states/nav-hover-1440` | No overview of the store beyond 3 flat links; colors/new/discounted paths are invisible from the header | P2 | Compact "فروشگاه" disclosure panel (categories with imagery, shop-by-color, shortcuts) with keyboard support and hover intent — see decision §A | M |
| D2.4 | all · 1280×720 | `product-1280-fold` | 111 px of chrome (announcement 33 + header 78) = 15 % of the viewport | P2 | 64–68 px header, compact announcement | S |
| D2.5 | header · all | `cart-filled-390` | Badges use Latin digits ("3") at 11 px; cart changes are not announced | P2 | Persian digits, 12 px, polite live announcement | S |
| D2.6 | PDP, catalog | `product-1440` | Breadcrumb skips the category, is not a `nav`, separators are read aloud, no `aria-current` | P2 | `nav[aria-label]` + list + hidden separators + category level | S |
| D2.7 | header | `home-1440-fold` | "Account" icon suggests sign-in exists; the page says it is inactive | P2 | Keep the route, move the entry to the menu/footer | S |
| D2.8 | catalog ↔ PDP | test | Back from PDP must restore list position and filters | P2 | Verify with a test; filters already live in the URL | S |

### Topic 3 — Interaction and input

| ID | Route · viewport | Evidence | User impact | Sev | Proposed fix | Effort |
| --- | --- | --- | --- | --- | --- | --- |
| D3.1 | all | CSS | Eight unrelated button/link styles (`btn-dark`, `btn-outline`, `btn-line`, `text-link`, `subtle-link`, `link-button`, `catalog-sort-apply`, `pdp-quick-cart-link`); buttons jump 1 px on hover | P1 | Button primitive: primary / secondary / tertiary / ghost × sizes; hover, focus-visible, active, disabled, pending states | M |
| D3.2 | catalog · all | probe | Each card exposes 3 links + 1 button (image, title, "انتخاب سایز", heart) → ~48 tab stops per page; "انتخاب سایز" implies a size picker that does not exist | P1 | One stretched title link per card, image link out of the tab order, heart stays separate | S |
| D3.3 | catalog · ≥ 821 | source | Every filter change needs "اعمال فیلترها" and then a full page reload (`window.location.assign`), losing scroll position | P1 | Apply discrete filters immediately with client navigation (same URL contract), history entry per change, pending state on results | M |
| D3.4 | catalog · all | `shop-1440-fold` | Sort is a select plus a separate black "اعمال" button competing with the primary CTA | P2 | Keep explicit apply (WCAG 3.2.2) as a quiet secondary button grouped with the select | S |
| D3.5 | PDP · ≥ 1024 | `states/zoom-1440` | No trackpad swipe in the gallery; zoom only enlarges to 620 px with no magnification or pan | P2 | Scroll-snap track (trackpad/keyboard), magnify-and-pan in the zoom dialog with arrow-key panning. Source photos are 480×640, so magnification is limited — documented | M |
| D3.6 | FAQ, PDP | probe | Native `<summary>` rows are 21–24 px tall with the default triangle marker | P2 | Accordion styling: 48 px rows, chevron, focus ring | S |

### Topic 4 — Catalog, search and discovery

| ID | Route · viewport | Evidence | User impact | Sev | Proposed fix | Effort |
| --- | --- | --- | --- | --- | --- | --- |
| D4.1 | all prices | `product-1280-fold` | "۵۸۹ , ۰۰۰" — separator padded to digit width; prices look broken | P1 | Proportional figures for prices, lighter currency label | S |
| D4.2 | cards | `home-1440` | No title truncation rule; long names push prices out of line | P2 | 2-line clamp with reserved height | S |
| D4.3 | cards | source | Color dots carry `aria-label` on a generic `div` (ignored by assistive tech) | P2 | Visually hidden "رنگ‌ها: …" text | S |
| D4.4 | catalog | `shop-1440-fold` | Active chips appear below toolbar and a photo note, far from the filters | P2 | Toolbar row: count (live) · chips · clear-all · sort | S |
| D4.5 | catalog | `shop-1440` | Pagination is "قبل / صفحه ۱ از ۳ / بعد" with no page numbers or `aria-current` | P2 | Numbered pagination with labelled links | S |
| D4.6 | search · ≥ 1024 | `states/search-suggestions-1440` | Dialog floats mid-page detached from the trigger; no recent searches; a failed fetch says "nothing found" | P1 | Anchored dropdown under the header field, recent searches (client only), real error state | M |
| D4.7 | `/` color section | `home-1440` | Selected color pill differs by border tint only | P2 | Check mark + stronger ring | S |
| D4.8 | catalog, FAQ | axe | Heading levels skip (`h1` → `h3`) | P2 | Visually hidden `h2` for result lists; FAQ question headings | S |

### Topic 5 — Product detail page

| ID | Route · viewport | Evidence | User impact | Sev | Proposed fix | Effort |
| --- | --- | --- | --- | --- | --- | --- |
| D5.1 | PDP · 1280×720 | `product-1280-fold` | Primary CTA at y≈814 (below the fold); thumbnails not visible; the description sits between price and options | P1 | Buy box = title, price, color, size, quantity, CTA; description moves to details; vertical thumbnail rail beside the main image | M |
| D5.2 | PDP · ≥ 1081 | `product-1440` | Buy box is not sticky; reading details or related items loses the CTA and selection | P1 | Sticky buy column (when the viewport is ≥ 760 px tall); details flow under the gallery | S |
| D5.3 | PDP | `product-1440` | Category link "شومیز / کالکشن کسری ←" duplicates the breadcrumb | P2 | Remove; breadcrumb gains the category | S |
| D5.4 | PDP | `states/pdp-added-1440` | Confirmation is one text row with three inline actions; header badge does not react | P2 | Confirmation panel ("مشاهده سبد خرید", "سبد سریع"), badge pulse, polite announcement | S |
| D5.5 | PDP | `product-1440` | Three stacked notices (buy note, shipping note, AI-photo note) between CTA and details | P2 | One honest note under the CTA + "ارسال و بازگشت" accordion | S |
| D5.6 | PDP | `product-1440` | Unavailable sizes rely on 42 % opacity + strike-through; disabled color has a diagonal | P2 | Keep strike-through, add dashed border and "ناموجود" in the label, ≥ 3:1 outline | S |

### Topic 6 — Cart and checkout (demo)

| ID | Route · viewport | Evidence | User impact | Sev | Proposed fix | Effort |
| --- | --- | --- | --- | --- | --- | --- |
| D6.1 | `/cart`, `/checkout` · all | Lighthouse | CLS 0.279 desktop / 0.157 mobile from the client-only skeleton swap | P1 | Server-rendered heading + viewport-tall skeleton that matches the layout | M |
| D6.2 | cart, checkout, mini cart | `checkout-filled-1440` | Separator dots read as zero: "۱۰ × M" for one item | P1 | Labelled variant fields ("رنگ کرم · سایز M", "تعداد ۱"), Latin sizes isolated in `<bdi>` | S |
| D6.3 | cart, mini cart | `cart-filled-390` | Remove is instant and irreversible | P1 | In-place "حذف شد · بازگرداندن" row with focus on undo | M |
| D6.4 | mini cart · ≥ 821 | `states/mini-cart-1440` | Drawer opens on the right (inline-start) while the cart icon is on the left (inline-end) | P1 | Logical `inset-inline-end`; slide from the icon's side | S |
| D6.5 | checkout | `states/checkout-errors-1440` | Labels wrap the error text, so errors become part of each field's name; nothing links errors via `aria-describedby`; validation only on submit | P1 | `label` + `aria-describedby` error/hint ids; validate on blur once touched; error summary | M |
| D6.6 | checkout | source | `autocomplete="off"` everywhere; demo copy asks people not to use real data | P2 | Correct `autocomplete` tokens, notice that nothing leaves the browser, "پر کردن با اطلاعات نمونه" helper | S |
| D6.7 | checkout · ≥ 1081 | `checkout-filled-1440` | Summary is not sticky; total scrolls away | P2 | Sticky summary | S |
| D6.8 | header cart | — | Cart drawer vs page — decision required | — | Decision §D | — |

### Topic 7 — System states and content

| ID | Route · viewport | Evidence | User impact | Sev | Proposed fix | Effort |
| --- | --- | --- | --- | --- | --- | --- |
| D7.1 | all | source | No `error.tsx`; a runtime error shows the framework default in English | P1 | Persian error boundary with retry and a way home | S |
| D7.2 | catalog | source | Generic single-block loading skeleton | P2 | Route skeletons that mirror header + grid | S |
| D7.3 | 404 | `not-found-1440` | English "404 / NOT FOUND" eyebrow, one action | P2 | Persian copy, search, category shortcuts | S |
| D7.4 | static pages | `faq-1440` | Latin eyebrows (ABOUT KASRA, GOOD TO KNOW), inline styles, ~100 chars/line | P2 | Shared content template, Persian kicker, 68ch measure | S |
| D7.5 | all copy | source | "جستجو" vs "جست‌وجو", "سوالات" vs "سؤال‌ها", three names for clearing filters, colloquial and formal registers mixed | P2 | Glossary (§F) applied everywhere | S |

### Topic 8 — Typography, color, RTL and Persian

| ID | Route · viewport | Evidence | User impact | Sev | Proposed fix | Effort |
| --- | --- | --- | --- | --- | --- | --- |
| D8.1 | all | axe | `#786f67` on warm surface = 4.18:1 | P1 | `--color-text-subtle: #6b6158` (5.14:1 on the warm surface) | S |
| D8.2 | forms | contrast calc | Input/select borders `#ded8d1` = 1.41:1 on white (WCAG 1.4.11 needs 3:1) | P1 | `--color-border-strong: #8c8178` (3.80:1) for controls | S |
| D8.3 | all | probe | 142–284 text nodes below 12 px | P2 | 12 px floor (`--text-xs`); the "BOUTIQUE" logotype is the only documented exception | S |
| D8.4 | all | CSS | Weights 400/550/600/650/700/720/750/800 used ad hoc | P2 | 400 body · 500 UI · 600 labels · 700 headings · 800 display | S |
| D8.5 | static pages | probe | ~100 chars/line | P2 | `max-inline-size: 68ch` for prose | S |
| D8.6 | home, search | `home-1440` | `ArrowUpRight` (service links) and "↗" (search category mark) point backwards in RTL | P2 | `ArrowUpLeft` / mirrored chevrons | S |
| D8.7 | badges, search echo | `cart-filled-390` | Latin digits in badges; Latin queries/sizes not bidi-isolated | P2 | `formatNumber`, `<bdi>` for user text and sizes | S |
| D8.8 | — | — | Dark mode | — | Not added: photography-led brand with warm neutral imagery, no tuned dark assets; `color-scheme: light` kept (decision) | — |

### Topic 9 — Motion and feedback

| ID | Route · viewport | Evidence | User impact | Sev | Proposed fix | Effort |
| --- | --- | --- | --- | --- | --- | --- |
| D9.1 | all | CSS | Six ad-hoc durations (140–420 ms), mostly `ease`; dialogs vanish without exit motion; cards scale on hover | P2 | Tokens 120 / 200 / 320 ms with standard / enter / exit curves; dialog enter/exit via `@starting-style`; no decorative scaling; all reduced under `prefers-reduced-motion` | M |

### Topic 10 — Performance as UX

| ID | Route · viewport | Evidence | User impact | Sev | Proposed fix | Effort |
| --- | --- | --- | --- | --- | --- | --- |
| D10.1 | cart, checkout | Lighthouse | Performance 86 from CLS | P1 | See D6.1 | M |
| D10.2 | all | Lighthouse | 16.6 KB render-blocking CSS, much of it dead overrides | P2 | Rewrite (D1.1) | L |
| D10.3 | all | source | Product cards and the header are whole client components → every card hydrates | P2 | Server card + client wishlist island; server header with small client islands | M |

### Topic 11 — Accessibility

| ID | Route · viewport | Evidence | User impact | Sev | Proposed fix | Effort |
| --- | --- | --- | --- | --- | --- | --- |
| D11.1 | all | axe `region` | Announcement outside landmarks | P2 | Move inside the banner landmark | S |
| D11.2 | catalog, FAQ | axe | Heading order | P2 | See D4.8 | S |
| D11.3 | filters, menu | source | Custom overlays: `aria-modal` without an inert background; hand-written focus trap | P1 | One native `<dialog>` primitive for every overlay | M |
| D11.4 | header | source | No announcement when the cart changes | P2 | Polite live region | S |

## Part B — Mobile (360, 390, 412; one hand, mid-range device, average network)

### Topic 1 — Layout and visual system

| ID | Route · viewport | Evidence | User impact | Sev | Proposed fix | Effort |
| --- | --- | --- | --- | --- | --- | --- |
| M1.1 | iOS notch devices | source | No `viewport-fit=cover`, so every `env(safe-area-inset-*)` resolves to 0 and bottom bars can sit under the home indicator | P1 | `viewport.viewportFit = 'cover'`; safe-area padding tokens on header, bottom bars, sheets | S |
| M1.2 | all | source | `.site-shell` uses `100vh`; only some overlays use `dvh` | P2 | `min-block-size: 100svh`; `dvh` for sheets | S |
| M1.3 | PDP, cart | `pdp-sticky-390` | Fixed bottom bars reserve space only inside their own section; the footer end can be covered | P1 | One page-level bottom-bar spacer driven by whichever bar is present | S |
| M1.4 | `/` · 390 | `home-390` | Hero stamp, numbered category labels and 3 demo notes compete in a narrow column | P2 | Fewer decorative layers; one demo note per page area | S |
| M1.5 | all | probe | No horizontal overflow at 360/390/412 | — | Keep (regression test) | — |

### Topic 2 — Navigation and wayfinding

| ID | Route · viewport | Evidence | User impact | Sev | Proposed fix | Effort |
| --- | --- | --- | --- | --- | --- | --- |
| M2.1 | menu · ≤ 820 | `states/menu-open-390` | Menu is a floating card under the header, not a drawer; manual focus trap; no swipe-to-close; scroll lock via `body` overflow | P1 | Sheet primitive: full-height drawer from the inline-start edge, swipe-to-close, focus return | M |
| M2.2 | header · ≤ 600 | probe | Icon buttons 40 × 42 px, brand link 32 px tall | P1 | 44 × 44 targets | S |
| M2.3 | all · ≤ 820 | — | Cart, search and categories live only at the top of tall pages (hard thumb reach on 6"+ phones) | P1 | Bottom navigation — decision §B | M |
| M2.4 | catalog, cart, checkout | screenshots | Primary actions (filter/sort, checkout, submit) at the top or the end of long pages | P1 | Thumb-zone placement: sticky catalog controls, sticky cart bar, sticky submit area | M |

### Topic 3 — Interaction and input

| ID | Route · viewport | Evidence | User impact | Sev | Proposed fix | Effort |
| --- | --- | --- | --- | --- | --- | --- |
| M3.1 | checkout, filters · iOS | CSS | Inputs at 13.6–13.9 px make iOS Safari zoom on focus in the money flow | P1 | 16 px minimum for every text control | S |
| M3.2 | all · ≤ 600 | probe | 448 targets < 44 px at 390 (footer links 20 px, breadcrumbs 18 px, summaries 21 px, "حذف" 36 px, size guide 35 px) | P1 | 44 px hit areas (padding, not bigger text); documented inline-link exception | M |
| M3.3 | all | CSS | Only hover styles; no pressed feedback on touch | P2 | `:active` states, `-webkit-tap-highlight-color: transparent` | S |
| M3.4 | checkout | source | No `enterkeyhint`; phone/postal reject spaces and dashes typed by users ("0912 345 6789", "12345-67890") | P2 | `enterKeyHint`, digit + separator tolerance (Persian/Arabic/Latin digits already accepted) | S |
| M3.5 | PDP gallery | source | Swipe is a touch-end threshold: image does not follow the finger, no momentum or snap | P2 | Native scroll-snap track (momentum, snap, RTL), with buttons and dots as alternatives | M |

### Topic 4 — Catalog, search and discovery

| ID | Route · viewport | Evidence | User impact | Sev | Proposed fix | Effort |
| --- | --- | --- | --- | --- | --- | --- |
| M4.1 | catalog · ≤ 820 | `states/filters-open-390` | Side drawer with stacked apply/clear buttons, no result count, applying reloads the whole page | P1 | Bottom sheet with drag handle and sticky footer "نمایش N کالا" (count updates live), clear-all, swipe-down | M |
| M4.2 | catalog · 360 | `shop-360-fold` | Filter button, sort select, black apply button and count squeezed in one row | P2 | Two equal controls (filter, sort) + count line; sort keeps explicit apply | S |
| M4.3 | catalog, home | `home-390` | Category chips and color pills scroll without snap or an edge cue | P2 | `scroll-snap` + edge fade mask | S |
| M4.4 | search overlay | `states/search-open-390` | No recent searches; idle state lists only categories | P2 | Recent searches (client-only key), colors, categories | S |
| M4.5 | catalog | `/shop` Lighthouse | First-row product images are `loading="lazy"` and are the LCP element | P1 | `priority` for the first row | S |

### Topic 5 — Product detail page

| ID | Route · viewport | Evidence | User impact | Sev | Proposed fix | Effort |
| --- | --- | --- | --- | --- | --- | --- |
| M5.1 | PDP · ≤ 820 | `states/pdp-sticky-390` | Sticky bar has no variant summary; reserve lives inside the PDP layout | P1 | Variant summary line ("کرم · سایز M"), page-level spacer, safe area | S |
| M5.2 | PDP | `states/pdp-sticky-390` | Counter pill only — no dots | P2 | Dots (decorative) + live counter for screen readers | S |
| M5.3 | PDP zoom | `states/zoom-390` | No pinch/double-tap magnification | P2 | Double-tap toggles 2× with pan; native pinch stays enabled | M |
| M5.4 | size guide | `states/size-guide-390` | Bottom sheet without handle or swipe-to-close | P2 | Sheet primitive | S |
| M5.5 | PDP | `product-390` | Three stacked notes between CTA and details | P2 | Same as D5.5 | S |

### Topic 6 — Cart and checkout

| ID | Route · viewport | Evidence | User impact | Sev | Proposed fix | Effort |
| --- | --- | --- | --- | --- | --- | --- |
| M6.1 | `/cart` · 390 | `cart-filled-390` | Total and checkout CTA appear only after every line item (y≈760+) | P1 | Sticky bottom bar: total + "ادامه تا تسویه‌حساب نمایشی" | S |
| M6.2 | `/checkout` · 390 | `checkout-filled-390` | Order summary is below the whole form | P1 | Collapsible summary at the top ("۲ کالا · ۳٬۰۸۵٬۰۰۰ تومان") | S |
| M6.3 | `/checkout` · 390 | `checkout-filled-390` | Submit button at the very end of a long form | P1 | Sticky action area inside the form (thumb zone, ends with the form) | S |
| M6.4 | cart | probe | "حذف" 41 × 36 px next to the stepper | P2 | 44 px remove button with icon + text | S |
| M6.5 | cart/checkout | Lighthouse | CLS 0.157 | P1 | See D6.1 | M |

### Topic 7 — System states and content

| ID | Route · viewport | Evidence | User impact | Sev | Proposed fix | Effort |
| --- | --- | --- | --- | --- | --- | --- |
| M7.1 | empty cart/wishlist | `cart-empty-390` | Empty states give one generic CTA | P2 | Category shortcuts + primary CTA | S |
| M7.2 | search suggestions offline | source | Network failure is reported as "no suggestions" | P2 | "اتصال برقرار نشد" + retry; full search still works | S |

### Topic 8 — Typography and RTL

| ID | Route · viewport | Evidence | User impact | Sev | Proposed fix | Effort |
| --- | --- | --- | --- | --- | --- | --- |
| M8.1 | all · 360 | probe | Announcement 10.9 px, discount tag 9.9 px, category 11.8 px | P2 | 12 px floor | S |
| M8.2 | catalog · 360 | `shop-360` | Price and strike-through stack and wrap in narrow cards | P2 | Proportional figures, smaller currency label, single line | S |

### Topic 9 — Motion

| ID | Route · viewport | Evidence | User impact | Sev | Proposed fix | Effort |
| --- | --- | --- | --- | --- | --- | --- |
| M9.1 | overlays | source | Drawers snap in/out (or 210 ms `ease`); nothing follows the finger | P2 | 320 ms decelerate enter, 200 ms exit, drag-follow with release threshold | M |

### Topic 10 — Performance

| ID | Route · viewport | Evidence | User impact | Sev | Proposed fix | Effort |
| --- | --- | --- | --- | --- | --- | --- |
| M10.1 | `/`, `/shop`, PDP, search | Lighthouse | Mobile LCP 2.56–3.09 s; render delay dominated by ~600 ms script evaluation | P1 | Less hydration (server cards/header/PDP details), first-row `priority`, smaller CSS | M |
| M10.2 | all | Lighthouse | Estedad VF is 121 KB, the single heaviest asset | P2 | **Not changed**: subsetting rewrites the vendored, SHA-pinned binary (provenance in `src/fonts/README.md`). Backlog item | — |

### Topic 11 — Accessibility

| ID | Route · viewport | Evidence | User impact | Sev | Proposed fix | Effort |
| --- | --- | --- | --- | --- | --- | --- |
| M11.1 | filters, menu | source | Screen-reader swipe can leave the custom drawers (background not inert) | P1 | Native modal `<dialog>` (inert background by spec) | M |
| M11.2 | 320 / 400 % zoom | probe | No overflow at 320 px (= 400 % zoom of 1280) | — | Keep; regression test | — |

## 2. Design direction

**Calm · editorial · warm · assured · effortless.** Ivory canvas, charcoal ink, one deep-rose accent,
generous whitespace, sharp-cornered editorial imagery, and controls that are quiet until needed. The
brand identity (KASRA Georgia wordmark, Estedad, ivory/charcoal/rose palette) is refined, not
replaced.

### Tokens (Tailwind 4 `@theme`, emitted as CSS variables)

| Group | Tokens |
| --- | --- |
| Color roles | `surface` #faf8f5 (page), `surface-raised` #ffffff, `surface-muted` #f1ece6, `surface-sunken` #e8dfd4 (image placeholder), `text` #222222, `text-muted` #615852 (5.9:1 on muted), `text-subtle` #6b6158 (5.1:1 on muted), `accent` #7d453f, `accent-soft` #b8847c (decorative only), `border` #ded8d1 (dividers), `border-strong` #8c8178 (controls, 3.8:1), `success` #2e6b4c, `warning` #865a0f, `danger` #9b2f2a, `focus` #7d453f, `inverse` #ffffff |
| Spacing | 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 px (`--space-1` … `--space-9`); page gutter `clamp(16px, 4vw, 48px)` |
| Radii | `xs` 2 px (controls), `sm` 6 px (chips, cards in sheets), `lg` 16 px (sheet corners), `pill` |
| Elevation | `1` sticky bars, `2` popovers/dropdowns, `3` dialogs/drawers |
| Type | Estedad 400 / 500 / 600 / 700 / 800; fluid scale `xs` 12 px → `display` clamp(2.25rem, 1.4rem + 3.4vw, 4.25rem); body line-height 1.85, headings 1.4 |
| Layout | containers: page 1440, editorial 1520, prose 68ch, checkout 1200; breakpoints 600 / 820 / 1080 / 1440 |
| Z-index | raised 2 · sticky 20 · header 40 · bottom-bar 45 · toast 60 · skip-link 80 (overlays use the native top layer) |
| Motion | 120 / 200 / 320 ms; `ease-standard` cubic-bezier(.2,0,0,1), `ease-enter` cubic-bezier(.05,.7,.1,1), `ease-exit` cubic-bezier(.3,0,.8,.15) |

## 3. Decisions

**A. Desktop header — compact disclosure panel, not a full mega menu.** Three categories do not
justify a multi-column mega menu, and they stay as direct one-click links. A single "فروشگاه" button
opens a disclosure panel (WAI-ARIA disclosure pattern, not `role=menu`) that adds what the header
cannot show: category imagery, the six real color families, "تازه‌ترین‌ها" and "تخفیف‌دارها"
(existing query parameters), and the size guide. Hover opens after 150 ms and closes 250 ms after
the pointer leaves; click, Enter/Space and ArrowDown open it; Escape closes and returns focus;
tabbing out closes it.

**B. Mobile bottom navigation — yes, on browsing pages only.** Iranian shoppers know the pattern from
Digikala, Basalam and Snappfood; it puts cart, search and categories in the thumb zone of 6"+ phones.
Five items: خانه، دسته‌ها (`/shop`)، جستجو (opens the search overlay)، علاقه‌مندی‌ها، سبد خرید.
Rule: **browsing pages show the bottom nav; task pages replace it with their contextual action bar**
— product (purchase bar), cart (checkout bar) and checkout (submit area). This guarantees two bars
never stack. It hides while the on-screen keyboard is open, respects the safe area and reserves its
own space so it never covers content.

**C. Desktop filters — persistent sticky sidebar.** Seven facet groups with short option lists fit a
sidebar; Baymard finds visible facets outperform hidden toolbars when there are fewer than ~10
filter types. Discrete filters apply instantly via client navigation (one history entry each, so
Back undoes a filter); price applies on Enter or its button. On ≤ 820 px the same form becomes a
bottom sheet that applies changes behind the sheet so the footer can show the real "نمایش N کالا".

**D. Cart — page and drawer both stay.** The header cart icon keeps going to `/cart` (predictable,
shareable, works without JS). The drawer ("سبد سریع") remains the optional quick check after adding
an item, now sliding from the cart icon's side.

**E. Search — one combobox, two placements.** Desktop: field-styled trigger in the header, dropdown
dialog anchored under it. Mobile: full-screen overlay. Same suggestion list, keyboard model
(`aria-activedescendant`, arrows, Enter, Escape) and recent searches.

**F. Copy glossary.** سبد خرید (never "سبد" alone in labels) · سبد سریع (drawer) · تسویه‌حساب نمایشی ·
علاقه‌مندی‌ها · جستجو · پاک کردن همه فیلترها · سؤال‌های پرتکرار · نمایشی (for anything simulated).
Register: warm, friendly second person (the existing voice), never urgent or salesy.

## 4. Conflicts and constraints flagged

1. **SEO ≥ 95 vs. honesty:** blocked only by the intentional `noindex`; not changed (see §0).
2. **Branch name:** the brief asks for `feat/ux-overhaul-v9`; this session must push to
   `claude/eager-thompson-y99dfz`. Work happens there; the PR can be renamed on merge.
3. **Photo quality:** "large, high-quality imagery" cannot be met — the six demo photos are
   480×640 AVIF files of ~3 KB. Zoom is implemented but magnification is capped and documented.
4. **Font subsetting** would improve LCP on slow networks but changes the vendored binary; deferred.

## 5. Implementation order

Desktop: tokens + CSS rebuild → primitives (Button, Chip, Dialog/Sheet, Disclosure, Toast, Skeleton,
QuantityStepper, Accordion) → home → header/nav/footer → catalog/filters → search → PDP → cart →
checkout → static pages. Mobile: sheet variants, bottom nav, sticky task bars, gestures, safe area.
Each step re-checks the other breakpoints and keeps the existing Playwright suite green.
