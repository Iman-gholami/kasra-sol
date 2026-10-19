# Kasra Boutique storefront: UI/UX audit and refinement (Claude)

Independent assessment, made in parallel with Astra's `astra/storefront-ux-refinement`. Branch:
`claude/storefront-uiux-parallel`. Scope: customer-facing storefront only. No backend, admin, auth, order, payment,
pricing or deployment code was changed.

## 1. Executive summary

The storefront was already a mature, tokenized design system (V3–V10 iterations), and axe-core found zero
violations on it. I treated it as a pre-launch review, not a redesign. A visual audit of 88 screens per build (desktop,
phone and five extra widths, with overlays and populated cart/checkout states) found **eight concrete defects and
rough edges**. All eight are fixed here with small, local CSS and markup changes that keep the brand as it is:

| # | Priority | Problem (observed) | Fix |
|---|---|---|---|
| 1 | P1 | Phone filter sheet: the drag handle sits *inside* the header row and squeezes «فیلتر محصولات» onto two lines | Bottom-sheet handle gets its own row |
| 2 | P1 | Touch screens keep `:hover` after a tap: the **pay button** on the payment step renders in its washed-out hover shade (`#463d38`), and so does the search submit | Fill-changing hovers only under `@media (hover: hover)` |
| 3 | P1 | Search: «نمایش نتایج «…»» and the no-suggestions sentence break apart (detached guillemets, broken underline, Latin queries wrapping into a separate column) | Each label is one flex item |
| 4 | P2 | Between 1280 and 1535px viewports (1440/1470/1512px laptops) Tailwind's `container` utility silently caps the page at 1280px, while the hero and editorial band use the full width: misalignment of 25–60px per side | `.container` cancels the cap, restoring the documented 1440px width |
| 5 | P2 | Product cards reserve an empty second title line: a 23–27px hole between name and price on every one-line name | Price follows the title; link keeps a ≥44px box via padding/negative margin |
| 6 | P2 | Struck price repeats a crossed-out «تومان»; on 320–360px cards it wraps to a second line | Struck price shows the number; currency stays for screen readers |
| 7 | P2 | Phone PDP letterboxes the 3:4 photo in a 0.88 frame with pale 29px side bands | Full-bleed 4:5 frame, still under the existing 520px compact limit |
| 8 | P3 | Cart line controls sit under the photo; footer wordmark lockup differs from the header; editorial photo cut across the model's eyes; orphaned last words | Photo spans rows; centred lockup; top-anchored crop; `text-wrap` balance/pretty |

Results: lint, typecheck, build and unit tests pass. **87/87 Playwright tests pass** (79 existing + 8 new). axe-core
reports 0 violations before and after. Lab CLS is 0 before and after. The CSS grows by 172 bytes gzipped.

## 2. Baseline

- **Baseline commit:** `54a7af4c5fb6bca65b55d2e2169538833123ea63` (`origin/main`, "Merge PR #12", 2026-10-19).
- Isolated worktree `/home/user/kasra-claude-uiux` on a new branch from `origin/main`. Astra's branch and files were never
  checked out or touched.
- **Visual source:** the public demo `https://kasra-astra-demo.vercel.app` could **not** be reached. This container's
  egress proxy refuses the connection (HTTP 403 on CONNECT), so nothing in this report comes from that deployment.
  Instead I built the baseline SHA as a production standalone server with the bundled demo catalog
  (`NEXT_PUBLIC_BACKEND_ENABLED` unset; 36 products) and kept that build running unchanged for every "before" capture.
- **Browser:** Playwright 1.64.1 driving Chromium 141.0.7390.37, `prefers-reduced-motion: reduce`, fonts awaited, lazy
  images loaded by scrolling before full-page captures. Phones use touch and mobile emulation (`hasTouch`, `isMobile`).

## 3. Visual identity assessment

Kasra's identity is restrained and editorial. It pairs a warm off-white canvas (`#faf8f5`) and sand neutrals with
one deep rosewood accent (`#7d453f`) used sparingly for kickers, current states and links. Typography is Estedad with
bold-to-heavy headlines, and a Latin Georgia **KASRA / BOUTIQUE** wordmark with wide tracking adds a fashion-house
note. Shapes are near-square (2px radius), with pills only for chips. Shadows are reserved for overlays. Photography
is warm and full-length on a beige studio ground. None of this was changed: every fix reuses the existing tokens.

## 4. What already works well

- One token layer (`tokens.css`) drives color, type scale, spacing, motion and z-index. Logical properties throughout give clean RTL.
- Navigation and discovery: sticky header with active state, mega-panel with category photos and colors, `/` search shortcut, phone bottom nav that steps aside on task pages.
- Shopping journey: stock-aware variants, a sticky phone purchase bar that summarises the selection, a free-shipping meter, save-for-later with undo, and a two-step checkout addressable by URL with focus management.
- Accessibility basics are strong: 44px targets, scroll padding for sticky chrome, native `<dialog>` sheets with focus return, Persian digits, sr-only context, reduced-motion support.
- Honest demo labelling: AI-photo notes, "sample" policies, no fake reviews or scarcity.

## 5. Homepage findings

- **Alignment (fixed, #4):** at 1440px the header logo, section headings and footer ended 25px inside the hero and editorial band on each side (`.header-inner` 73→1353 vs `.hero` 48→1377). Root cause: Tailwind's `container` utility (`max-width: 80rem` from the 80rem breakpoint) still applies because `.container` never set `max-inline-size`. The `wide-editorial` variant had already cancelled it, which is why only the editorial rows were wide. Now all of them run 48→1377 at 1440 and 48→1449 at 1512. At 1920 the intentional 40px editorial bleed from DESIGN-V4 is unchanged.
- **Editorial band crop (fixed):** the 3:4 photo in a wide 420px-tall frame at `center 18%` cut across the model's eyes. It is now anchored to the top, so the whole head and the coat are visible.
- **Orphans (fixed):** «…لباس‌های هماهنگ / رو ببین.» and the closing headline «…به / سبک تو.» left single words on their last lines. Headings now use `text-wrap: balance` and paragraphs `text-wrap: pretty` (progressive enhancement).
- Kept as is: hero composition, category tiles (stagger and gradient), Shop by Color, service links, closing CTA.

## 6. Catalog findings

- **Card rhythm (fixed, #5):** `.product-link { min-block-size: max(3.2em, 44px) }` reserved two title lines. With real names fitting one line, the price floated 23–27px below the title on every card. The two-line clamp moves to an inner span, and the link keeps a ≥44px box via `padding-block: 12px; margin-block: -12px`, so the repo's 44px touch-target audit still passes. Info block height: **169→122px at 320, 144→122px at 390, 166→139px at 1440.** The `::after` still stretches the hit area over the whole info block, and keyboard focus now outlines that block instead of a box that cut across the category and price.
- **Struck price (fixed, #6):** «۷۱۰٬۰۰۰ تومان» crossed out next to «۵۸۹٬۰۰۰ تومان» doubled the currency. At 320–360px it wrapped to a second line under the price, making card heights uneven. It now shows only the number, and screen readers still hear «قیمت پیشین: ۷۱۰٬۰۰۰ تومان». The cart line uses the same treatment.
- **Wishlist heart:** a 44px white disc covered about 26–31% of a 140–175px phone card's width and crowded the discount badge. It now draws a 36px disc inside the unchanged 44px target, top-aligned with the badge.
- **Filter sheet (fixed, #1):** see §9.
- Kept as is: explicit «اعمال» for sort. This follows WCAG 3.2.2 (no context change on input), as documented in UX-AUDIT-V9 D3.4.

## 7. Product detail findings

- **Phone gallery (fixed, #7):** a 0.88 frame with `object-fit: contain` letterboxed the 3:4 photo, leaving lighter `surface-sunken` bands about 29px wide on both sides of an edge-to-edge gallery. It is now a full-bleed **4:5** cover frame capped at `min(62svh, 500px)`: 487px tall at 390px and 500px at 430px. That respects the existing "compact gallery < 520px" requirement in `pdp.spec.ts`, so the title and price stay above the sticky bar. The trade-off is that about 6% of the photo (mostly floor) is trimmed at 390px, and about 13% at 430px. The zoom dialog still shows the whole photo. The loading skeleton uses the same frame.
- Tablet (768px): with the quieter struck price, the sale badge now stays on the price line instead of wrapping.
- Kept as is: thumbnail rail, sticky buy column, variant swatches and sizes, size-guide sheet, zoom, sticky purchase bar.

## 8. Cart and checkout findings

- **Pay button (fixed, #2):** after «ادامه و انتخاب روش پرداخت» the pay button appears under the finger. On touch devices it kept `:hover`, so the most important CTA rendered `rgb(70,61,56)` instead of `rgb(34,34,34)`. I verified this with computed styles in mobile emulation (`(hover: none)` is true there). Fill-changing and selected-looking hovers (buttons, icon buttons, chips, stepper, sizes, swatches, choice cards, search previews, filter swatches, service links) now apply only under `@media (hover: hover)`. `:active` still gives touch feedback.
- **Cart line (fixed):** on screens wider than 600px, quantity and actions sat below the 120×160 photo, leaving a gap beside it. The photo now spans both grid rows, so the controls sit next to it. Lines are 34–56px shorter (249→215px with a low-stock note, 249→193px without). Phones keep their full-width control row.
- Kept as is: flow steps, free-shipping meter, discount field, summary card, choice cards, review card, simulated gateway, confirmation. Checkout semantics are untouched.

## 9. Mobile UX findings

- **Filter sheet header (fixed, #1):** the 100%-wide handle was a flex item between the title and close button. The size-guide sheet already wrapped it; the filter sheet did not. A generic `.sheet-bottom .sheet-header:has(> .sheet-handle)` rule now gives every bottom sheet a handle row. Dragging the header to dismiss still works (covered by `mobile-v9.spec.ts`).
- **Search panel (fixed, #3):** the link label and the "no suggestions" sentence were direct flex children split by the flex gap. With a Latin query («zzqq») the sentence broke into a column of fragments.
- Sticky hover (#2), cards (#5, #6) and gallery (#7) are described above.
- Verified with no change needed: no horizontal overflow on any of 88 screens per build (320–1920px), bottom bars reserve their own space, safe-area padding, keyboard hides the bottom nav.

## 10. Accessibility findings

- axe-core 4.14.0 (WCAG 2.0/2.1/2.2 A and AA plus best-practice, **all impact levels**) on 12 routes plus an open overlay, at 1440×900 and 390×844 with a seeded cart: **0 violations before, 0 after.** The repo's own gate (`a11y.spec.ts`, serious/critical) passes.
- Touch targets: the existing ≥44px and ≥12px-text audit at 360/390/412px passes. My first card fix failed it (the title link box was 21px), so I reworked it until the link's own box measured 45–51px. The test itself was not changed.
- Focus: card focus now rings the whole info block. Struck prices keep their full spoken text. RTL, Persian digits and bidi isolation of queries are unchanged.

## 11. Design-system inconsistencies

| Inconsistency | Status |
|---|---|
| `.container` vs `.container.wide-editorial` effectively different widths at 1280–1535px | Fixed (one rule) |
| Bottom sheets: size guide wraps its handle, filter sheet does not | Fixed (generic rule) |
| Footer wordmark left-aligned, header lockup centred | Fixed: footer matches header, tracking balanced |
| Hover styles applied to touch input | Fixed for fills/selected-looking states; link colour hovers left as they are (harmless) |
| Price: currency rendered twice when discounted | Fixed in cards, PDP and cart |
| Card ratio 3:4 vs phone PDP 0.88 letterbox | PDP now full-bleed 4:5 cover (no letterbox) |

## 12. Prioritized improvements

P1: #1 filter sheet, #2 sticky hover on pay/submit, #3 search wording. P2: #4 container, #5 card rhythm, #6 struck price, #7
phone gallery. P3: cart line, footer lockup, editorial crop, text wrapping. All implemented.

## 13. Actual code changes

Eight commits, each one concern (`git log 54a7af4..HEAD`):

| Commit | Files |
|---|---|
| `fix(storefront)`: page container reaches 1440px | `src/styles/base.css` |
| `fix(storefront)`: bottom-sheet handle row | `src/styles/primitives.css` |
| `fix(storefront)`: hover tints off touch screens | `primitives.css`, `catalog.css`, `product.css`, `commerce.css`, `layout.css`, `home.css` |
| `feat(storefront)`: tighter cards, quieter struck price | `catalog.css`, `product-card.tsx`, `price.tsx`, `cart-page.tsx` |
| `feat(storefront)`: edge-to-edge compact phone gallery | `product.css` |
| `fix(search)`: quoted query stays in its sentence | `search-experience.tsx` |
| `style(storefront)`: cart line, footer lockup, editorial crop, text wrapping | `base.css`, `commerce.css`, `layout.css`, `home.css` |
| `test(storefront)`: polish behaviours | `tests/storefront-polish.spec.ts` (new) |

No dependency, data, API, backend or admin file changed. No JavaScript behaviour changed: the TSX edits only add
wrapping spans and sr-only text.

## 14. Before/after evidence

Same build pair, same viewports, demo data, cart contents, fonts and reduced-motion setting. Compressed comparisons are in
[`docs/claude-uiux/`](claude-uiux/):

| Image | Shows |
|---|---|
| [01-desktop-alignment-1440](claude-uiux/01-desktop-alignment-1440.jpg) | Header, hero and section edges now aligned |
| [02-desktop-cards-1440](claude-uiux/02-desktop-cards-1440.jpg) | Price under title, quieter struck price, wider grid |
| [03-editorial-crop-1440](claude-uiux/03-editorial-crop-1440.jpg) | Face no longer cut across the eyes |
| [04-footer-lockup-1440](claude-uiux/04-footer-lockup-1440.jpg) | Footer wordmark matches the header lockup |
| [05-filter-sheet-390](claude-uiux/05-filter-sheet-390.jpg) | One-line title, handle on its own row |
| [06-pay-button-touch-390](claude-uiux/06-pay-button-touch-390.jpg) | Pay button in primary black after the tap |
| [07-search-link-390](claude-uiux/07-search-link-390.jpg), [08-search-empty-390](claude-uiux/08-search-empty-390.jpg) | Search wording intact |
| [09-pdp-gallery-390](claude-uiux/09-pdp-gallery-390.jpg) | Full-bleed gallery, no side bands |
| [10-catalog-cards-320](claude-uiux/10-catalog-cards-320.jpg), [11-catalog-cards-390](claude-uiux/11-catalog-cards-390.jpg) | Compact cards, one-line discounted price |
| [12-cart-line-1440](claude-uiux/12-cart-line-1440.jpg) | Controls beside the photo |
| [13-pdp-tablet-768](claude-uiux/13-pdp-tablet-768.jpg) | Sale badge stays on the price line |

The full sets (88 before, 88 after) were captured locally under `artifacts/claude-uiux/` (gitignored; available on
request). Note: full-page captures paint fixed and sticky bars (bottom nav, checkout submit bar) at their viewport
position or with altered hover emulation, so the pay-button comparison uses viewport captures.

## 15. Tests executed and results

| Check | Result |
|---|---|
| `npm run lint` | Pass, 0 problems |
| `npm run typecheck` | Pass |
| `npm run build` (Next.js 16.3.8) | Pass |
| `npm run test:unit` | 4/4 pass |
| `npm run test:e2e`, baseline `54a7af4` | 79/79 pass |
| `npm run test:e2e`, this branch | **87/87 pass** (79 existing + 8 new) |
| New spec repeated (`--repeat-each=3`) | 24/24 pass |
| New spec against the baseline build | 7 fail, 1 pass (the desktop-hover guard is meant to pass on both) |
| axe-core sweep, all impacts | 0 violations, before and after |
| Horizontal overflow, 88 screens per build | None; console errors only the expected 404 resource on the not-found route; no hydration warnings |

On the way, the first full run had 5 failures: 3× the touch-target audit (card link box 21px), the PDP
compact-gallery limit (my first 3:4 frame was 520–573px tall), and my own cart test (a skeleton race and an
overly strict assertion). The design was adjusted to meet the existing tests, and none of the existing tests was
edited or skipped.

## 16. Failed or unavailable checks

- Public demo deployment: not reachable from this environment (proxy 403), so it was not inspected.
- Backend-enabled mode (`NEXT_PUBLIC_BACKEND_ENABLED=true` with Postgres) and the admin suite (`playwright.admin.config.ts`) were not run. Admin is out of scope and untouched.
- Only Chromium was used. No WebKit or Firefox, and no physical iOS or Android devices. Touch behaviour is verified with Chromium's mobile emulation (`hover: none`, `pointer: coarse`).
- No Lighthouse or field data.

## 17. Performance considerations

- CSS +1,220 bytes raw / **+172 bytes gzip**; no JS, no dependency, no new assets; image requests and `sizes` unchanged.
- Lab (Chromium, unthrottled, warm, interleaved, median of 9) for home/PDP/shop at 390 and 1440: **CLS 0 for every page, before and after**. LCP medians stay within run-to-run noise (for example PDP phone 224→172ms, shop desktop 248→224ms). These are indicative lab numbers only, and no field improvement is claimed.
- The PDP skeleton now has the same frame as the gallery, so no shift on hydration.

## 18. Remaining issues (not fixed)

- Lookbook photos are 480×640 and get upscaled in the 860px hero and on 2–3× phone screens. Replace them with ≥1200px originals (content task).
- Six photos are reused for 36 products, so listings look repetitive. This is a known demo limitation.
- The PDP price's «تومان» at 0.8em is heavy next to the price number. Left alone because it is subjective.
- The announcement bar wraps to two lines at 320px.
- Link-colour hovers and the toast close button are not hover-guarded. They are low impact because tapping navigates or dismisses.
- At 430px the 4:5 gallery trims about 13% of the photo, mostly the feet. The zoom dialog shows the whole photo.
- Catalog offers category as chips and as a sidebar select (redundant but harmless).
- No backend defects were found during this storefront work.

## 19. Potential conflicts with Astra's branch

On 2026-10-19 16:01 UTC, `origin/astra/storefront-ux-refinement` was still identical to `origin/main` (`54a7af4`), so
there was no diff to compare. The risk below is predictive: it is based on which files any storefront polish is
likely to touch.

| File | My change size | Overlap risk |
|---|---|---|
| `src/styles/primitives.css` | hover guards (6 one-line wraps), sheet handle (+3) | **High**: core buttons and sheets |
| `src/styles/catalog.css` | card block (~25 lines), 3 hover wraps | **High**: product cards are a prime audit target |
| `src/components/products/product-card.tsx`, `price.tsx` | 1 and 2 lines | **High**: same reason |
| `src/styles/product.css` | gallery (2 rules), 2 hover wraps | Medium-high |
| `src/styles/base.css` | container (+2 comment lines), text-wrap (+3) | Medium |
| `src/styles/commerce.css`, `home.css`, `layout.css` | 2–5 single-line edits each | Medium |
| `src/components/search/search-experience.tsx`, `cart/cart-page.tsx` | 1–2 lines each | Low-medium |
| `tests/storefront-polish.spec.ts`, `docs/CLAUDE-*`, `docs/claude-uiux/` | new, Claude-specific names | None |

Hunks are small and line-local (mostly single-rule replacements), with no reformatting. Any conflict should be a
side-by-side choice per rule. The one semantic dependency to watch: if Astra changes `.product-link` or the
`.pdp-slide` phone ratio, re-run `mobile-v9` (touch targets) and `pdp.spec.ts` (compact gallery). Those tests are what
shaped my versions.

## 20. Pull request

Draft PR against `main`: [Iman-gholami/kasra-sol#13](https://github.com/Iman-gholami/kasra-sol/pull/13), from
`claude/storefront-uiux-parallel`. It has not been merged or deployed.

## 21. Final design quality assessment

These are subjective 1–10 scores from the evidence above. They are not measured conversion or usability data.

| Dimension | Before | After | Evidence |
|---|---|---|---|
| Visual design | 7.5 | 8 | Same identity; misaligned edges, letterbox bands and face crop removed |
| Typography | 7.5 | 8 | No duplicated currency, no orphaned last words, broken search wording fixed |
| Spacing & layout | 7 | 8 | One page width at laptop sizes; card and cart-line rhythm tightened |
| Mobile experience | 7.5 | 8.5 | Filter sheet header, touch-safe CTAs, full-bleed gallery, denser cards |
| Product discovery | 7.5 | 8 | Info block −15–28%, so more products per screen; readable search panel |
| Product detail UX | 7.5 | 8 | Full-bleed phone gallery within the compact limit; price row no longer wraps at 768px |
| Cart & checkout UX | 8 | 8.5 | Primary pay button keeps its state after the tap; compact cart lines |
| Interaction design | 7.5 | 8 | Hover limited to hover-capable pointers; clearer card focus ring |
| Accessibility | 8.5 | 8.5 | 0 axe violations both; 44px targets kept; struck price fully spoken |
| Overall consistency | 7 | 8 | Container, sheets, wordmark lockup and price treatment now consistent |

The storefront remains recognisably Kasra. The changes remove details that made it look unfinished at common
laptop widths and on phones, and none of them adds visual noise.
