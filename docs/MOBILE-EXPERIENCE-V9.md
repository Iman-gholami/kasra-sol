# Kasra Boutique — Mobile Experience 9.0

This release covers the mobile header, persistent navigation and how fixed controls share the bottom of the
screen. It extends the V9 architecture in place. Product data, the cart/wishlist store contract, routes,
query parameters, APIs, the search algorithm, the demo-only checkout and the deployment setup are unchanged.
No dependencies were added.

No mockup image was available to this implementation. The layout follows the written specification, and
§7 lists the judgement calls made where a mockup would have decided.

## 1. What a phone (≤ 600 px) shows

| Route | Top | Bottom |
| --- | --- | --- |
| `/` | Announcement · header · search entry · quick categories, then the existing hero | Bottom nav |
| `/product/…` | Announcement · header | Purchase bar (when the main button is not visible) on top of the bottom nav |
| `/cart` (with items) | Announcement · header | Total + checkout bar on top of the bottom nav |
| `/checkout` | Announcement · header | Sticky submit bar inside the form; **no bottom nav** (§6) |
| Every other route | Announcement · header | Bottom nav |

Tablet (601–820 px) and desktop keep the V9 header: start-aligned logo, desktop nav or menu drawer, and the
field-styled search. None of the phone-only UI is rendered visibly there, and its lazy thumbnails are never fetched.

## 2. Components

| Component | Kind | Role |
| --- | --- | --- |
| `data/announcements.ts` | data | `Announcement { id, message, href?, enabled, priority? }` plus `activeAnnouncement()`, which picks the enabled entry with the highest priority. It holds verified messages only. The active one is the demo-status notice; a neutral welcome line is the fallback |
| `layout/announcement-bar.tsx` | server | One line, 32 px plus the top safe area. No timers or rotation. Renders nothing when all entries are disabled |
| `layout/header.tsx` | server | Unchanged markup. On phones CSS turns it into a `1fr auto 1fr` grid (menu · wordmark · search and bag), which puts the wordmark on the viewport's true center |
| `layout/count-badge.tsx` | shared | `CountBadge`, `countLabel` and `useCountBump`, used by both the header and the bottom nav. Badges are absolutely positioned, so appearing after hydration never shifts layout |
| `layout/header-actions.tsx` | client | Uses the shared badge. It stays the only place that announces cart changes to screen readers |
| `layout/bottom-nav.tsx` | client | One `DESTINATIONS` config: خانه · فروشگاه · جستجو · علاقه‌مندی · سبد. The active state is derived from the route (§4) |
| `search/search-launcher.tsx` | client | Still the only search dialog. It now exports `openSearch(opener)` and `useSearchOpen()`, so the homepage entry and the bottom nav open the same dialog and reflect its open state |
| `home/home-search-entry.tsx` | client | A button styled as a field (not a fake input). It opens the dialog, which focuses the real input within the same tap, so iOS raises the keyboard |
| `home/quick-categories.tsx` | server | Built from `categories` in `data/facets.ts` plus «جدیدها» (`catalogHref('/shop', { sort: 'newest' })`, pictured with the newest product's photo). It is a CSS grid that fills the width, and becomes a native RTL horizontal scroller once more categories are configured than fit |
| `ui/document-flags.ts` | client | `markModal`, `useBottomNav`, `useTaskBar(kind, ref)` and `useKeyboardFlag`. Each sets an attribute on `<html>` that CSS reads |

The category photos moved into the category config (`photo`). The homepage tiles, the desktop nav panel and the quick
categories now read that config instead of keeping three separate lists.

## 3. Bottom-of-screen contract

Before this release one attribute (`data-bottom-bar="nav|pdp|cart"`) chose a single bar. Persistent navigation needs
two layers at once, so the contract is now additive (`styles/tokens.css`):

| Token | Meaning |
| --- | --- |
| `--bottom-nav-h` | 60 px: the nav including its top border, excluding the safe area |
| `--task-bar-pad` | 8 px of block padding around a task bar's content |
| `--task-bar-content-h` | The task bar's content height, measured by `useTaskBar` with a `ResizeObserver` (content box) |
| `--task-bar-offset` | Where the task bar sits: nav height plus safe area when the nav is shown, otherwise 0 |
| `--task-bar-safe` | Safe-area padding the task bar adds itself: 0 when the nav below already pads it |
| `--bottom-bar-space` | nav + task bar (content + padding + 1 px border) + safe area. It is used for the page's end padding, `scroll-padding-block`, toasts and the floating filter pill |

The layer that touches the screen edge pads `env(safe-area-inset-bottom)`, and nothing else does, so the safe area
is never counted twice. A test emulates a 34 px inset and asserts nav = 94 px, purchase bar = 63 px and the
reserved space equals the sum of the two.

**Visibility.** `html[data-modal-open]` and `html[data-keyboard]` hide the nav and both task bars with
`visibility: hidden`. They become unfocusable, but their space stays reserved, so nothing in the page moves.
- **Dialogs** (menu, search, filters, mini cart, size guide, zoom) use the native top layer, so they need no
  z-index at all.
- **The keyboard flag** is set only for text-entry fields outside dialogs. Radios and checkboxes don't raise a
  keyboard, and modals are already covered by the modal flag. Keeping dialog fields out also prevents a stale
  flag from blocking focus return to a nav button when a dialog closes; a test caught exactly that.
- **Route changes** re-check the flag, because a focused field removed by navigation doesn't always fire `focusout`.

**Stacking.** The order is page content · raised 2 · sticky 20 · header 40 · task bar 44 · bottom nav 45 ·
toast 60 · skip link 80, then the top layer. The task bar and the nav never overlap, because the task bar sits on
top of the nav.

## 4. Active-state policy

The active item is derived from `usePathname()` on every render and never stored, so client navigation and Back
can't leave a stale indicator.

| Route | Current item |
| --- | --- |
| `/`, `/shop`, `/wishlist`, `/cart` | That link, `aria-current="page"` |
| `/search` (the results page) | The search button, `aria-current="page"` |
| `/category/…`, `/product/…` | فروشگاه, `aria-current="true"` (inside the shop section, but not the shop page itself). The home tab is never marked |
| Search opened as a dialog | The search button gets `aria-expanded="true"`, never `aria-current` |
| Content pages, order confirmation, 404 | None |

The visual active state is keyed to `[aria-current]`, so color is never the only cue. It combines the accent
color (7.1:1), a bold label, a heavier icon stroke, and a 24 px rule on the top edge.

## 5. Product page: purchase bar and nav together

- The purchase bar sits directly on top of the nav. It uses an opaque ivory, a 46 px CTA and 8 px padding, so the
  two read as one dock instead of two competing panels: 123 px in total, plus the safe area.
- The bar still appears only while the main button is not visible. "Visible" now excludes the strip behind the
  nav: the `IntersectionObserver` root is shrunk by the nav's height. Without that, a main button sitting
  behind the nav would hide the bar and leave no reachable CTA. Both cases are tested.
- After an add, the confirmation row grows the bar upward. `useTaskBar` re-measures, so the page's reserved space
  grows with it, and the header and nav badges update in the same render.
- Color and size selection stay in the page. The bar's CTA scrolls to and focuses the first missing choice, as
  before.

## 6. Decisions and trade-offs

1. **Checkout has no bottom nav.** It's a focused form with a sticky submit bar, and the keyboard is up most
   of the time, so the nav would be hidden anyway. Leaving global navigation out of checkout is standard
   conversion practice. Every other route, including product and cart, keeps the nav, as the spec asked.
2. **The announcement shows the demo-status notice, not a welcome line.** It's the one verified,
   customer-relevant statement available. The welcome line is configured as the lower-priority fallback; switching
   is a one-line change (`enabled`).
3. **The hero's category links are hidden on phones.** The quick categories directly above carry the same three
   links. The hero image is 288 px instead of 320 px on phones, so the headline still opens above the fold at
   390×844. The hero is otherwise unchanged.
4. **The quick-category circles are cropped onto the garment** (`scale: 1.5` from the upper torso). The ring is
   drawn with `box-shadow` outside the clipped circle. Uncropped, the demo photos showed tiny full-length figures.
5. **The bottom layers are opaque.** At 97% opacity, page text ghosted through the nav. Solid ivory also avoids a
   backdrop blur pass while scrolling. The header keeps its V9 translucent blur.
6. **Prefetch is left at the Next.js default.** Nav links are now visible on product and cart, so those pages
   prefetch two to four more small RSC payloads (+2–4 KB). Tab switches stay instant. Set `prefetch={false}` on the
   nav links if origin load under campaign traffic matters more than switch latency.

## 7. Judgement calls made without a mockup

- Header icon order: search beside the logo and the bag at the far left edge (the existing V9 order).
- The wordmark keeps «BOUTIQUE» at every width. At ≤ 360 px it's set slightly smaller (17 px / 7.5 px) instead of
  being dropped.
- The shop icon is lucide `Store` (storefront). The active indicator is a top-edge rule, not a pill or a raised
  button.
- The search placeholder is «دنبال چه لباسی می‌گردی؟» and the nav label is «ناوبری اصلی موبایل», as specified.

## 8. Verification

Run on a production build (`npm run build && npm run start`), Chromium 141, Playwright 1.64.1.

| Check | Result |
| --- | --- |
| `npm run lint`, `npm run typecheck`, `npm run build` | Pass |
| Full Playwright suite (all 9 files) | **81 / 81 pass** |
| New `tests/mobile-navigation.spec.ts` | 18 tests: announcement config; homepage layers and their absence elsewhere; logo centered within ±1 px; RTL icon order; one shared search dialog from three triggers, with focus return; five nav items in RTL order; route-derived active states including product, category, search and FAQ; checkout without the nav; fixed while scrolling; safe area counted once (34 px emulated inset); header and nav cart badges in sync through add, refresh, decrement and remove; purchase bar on the nav with the main CTA never covered; size guide, menu and filter sheet suppressing the nav; filter pill above the nav; keyboard flag (and not for radios); quick categories scrolling natively in RTL; 320/375/390/430 px without overflow or clipped labels; 768/1024/1440 px without phone UI |
| `tests/mobile-v9.spec.ts` | One existing test was **intentionally changed**: it asserted the V9 policy of no nav on product and cart. It now asserts the nav on product and cart and none on checkout, under the new label. No other assertion changed |
| axe-core (17 routes plus overlays, 1440 and 390) | 0 violations of any impact |
| Geometry probe (9 viewports × 6 routes) | Logo offset 0 px from center at every phone width; no horizontal overflow anywhere; announcement 32 px, header 58 px |

### Lab performance (A/B, same machine, interleaved)

Baseline `19f1b5a` against this change, phone 390×844, 4× CPU, 150 ms RTT / 1.6 Mbps. These are lab numbers,
not field Core Web Vitals.

| Route | LCP median (min–max) | CLS | TBT median | JS transfer | Requests | Total transfer |
| --- | --- | --- | --- | --- | --- | --- |
| `/` (13 runs) | 1316 (1272–1388) → 1308 (1256–1448) ms | 0.001 → 0.001 | 565 → 546 ms | 181.9 → 182.8 KB | 34 → 38 | 360.1 → 374.3 KB |
| `/shop` (7) | 1188 → 1164 ms | 0.001 → 0.001 | 592 → 518 ms | 192.9 → 193.7 KB | 44 → 44 | 392.8 → 393.9 KB |
| `/product/shomiz-01` (7) | 1236 → 1272 ms | 0.001 → 0.001 | 510 → 541 ms | 185.9 → 188.9 KB | 25 → 30 | 346.2 → 353.8 KB |
| `/cart` (7) | 2176 → 2180 ms | 0 → 0 | 267 → 266 ms | 179.7 → 182.8 KB | 27 → 30 | 323.3 → 328.7 KB |

Interaction latency (Event Timing, 4× CPU, 9 runs) moved from 176 to 184 ms (median) for opening search from the
nav, and from 104 to 120 ms for add to cart, which now renders the nav badge on the product page too.

LCP and TBT differences are within run-to-run spread; the home page's +78 ms TBT in a 7-run sample came out
−19 ms over 13 runs. The added home requests are the four quick-category thumbnails (+14 KB). The added product
and cart requests are the nav links' default prefetches (§6).
