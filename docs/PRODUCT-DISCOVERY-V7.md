# KASRA — Product Discovery Experience 7.0

This is an **in-place** refinement of Persian RTL product discovery on the existing Next.js storefront. All prices, photos, orders and inventory remain **mock-only**, not verified real purchases.

## Existing implementation audit

The V6 catalog already offered URL-driven desktop/mobile filters, query preservation across sort, price range, product cards and mobile category links. It also had several avoidable friction points:

1. The header imported the entire product dataset into a client bundle just to show four suggestions — unsuitable as inventory grows.
2. Suggestions matched a single literal substring, with no strong Persian normalization for half-spaces, color terms, or multiword query ranking.
3. Search used an inline header strip without a distraction-free mobile overlay or arrow-key suggestion selection.
4. Category navigation on results dropped the original search query; selected state was inconsistent for `/shop?category=...`.
5. Sidebar price fields accepted ASCII numbers but not conveniently written Persian groupings.
6. Mobile size filtering hid every choice inside a select rather than direct options.
7. Empty states cleared the original query when users wanted to relax just their filters.
8. Filter toolbar did not show the active selection count.
9. Category cards wrapped into multiple rows on small screens instead of native RTL horizontal scrolling.
10. Search suggestions listed a category label but not the actual sample price.

## Changes

- `src/data/facets.ts` is a small client-safe list of category, color and size choices. Client header/filter modules **no longer import the 36-product catalog**; a future backend can replace the server adapter without sending 5,000 product records to each device.
- `src/lib/format.ts` normalizes Arabic/Persian kaf and ye, digit variants, combining marks, half-spaces, Unicode presentation forms and repeated spaces.
- `src/lib/search.ts` uses transparent token-based relevance ranking: exact/prefix name → name tokens → category/color → other metadata. All query tokens must match available catalog information; there are no invented matches.
- `src/app/api/search-suggestions/route.ts` returns at most **four products and three actual categories**, including image, category and formatted price. There is a small 90ms client debounce, request abort and stale-result protection.
- `src/components/search/search-experience.tsx` is a native modal dialog: one-tap entry, focused and labelled combobox, ArrowUp/ArrowDown, Enter, Escape, clear, focus return and live result count. Desktop uses an editorial popover; mobile has a scrollable full-height overlay.
- `src/lib/catalog.ts` preserves the server-side filtering/pagination boundary, supports multiword ranked search and safely parses Persian/Arabic digits and grouped price numbers.
- Catalog mobile drawer provides directly selectable size radios, labelled color swatches, price fields, active filter count and safe-area-aware sticky actions. Desktop and mobile sorting preserve query/filter URL values.
- The category strip is dynamically generated from facet configuration, has clear current category indicators and allows horizontal RTL swiping on phones.
- Search results keep their query visible; category filtering on `/search` preserves `q`. Empty-result recovery clears filters *without losing the query*.

## Acceptance and QA

Playwright coverage includes Persian and Arabic orthography, real catalog matches, server suggestion caps, keyboard navigation, empty-state recovery, Persian price input, filter/sort preservation, browser Back, and horizontal overflow at 320, 375, 390, 430, 768 and 1440px.

[Storefront CI](https://github.com/Iman-gholami/kasra-sol/actions/workflows/ci.yml) runs ESLint, TypeScript, production build, Chromium tests, screenshots and a lightweight synthetic browser-metrics script. Inspect the latest run before declaring all checks green. Screenshot artifacts contain mobile/desktop search and results, and a mobile filter drawer.

## Known limitations / later work

- The user-supplied brief ends midway through the price-filter section; no later, unseen requirements are assumed.
- Only 36 mock SKUs and six repeated AI lookbook photographs are available. The actual buyer-facing content needs product-specific licensed imagery and stock.
- The in-memory server search adapter is suitable for a mock catalog but is **not** a measured 100k-daily-visitor production search service. At 500–5,000 products, replace it with indexed backend search and server-side facets, preserving the URL contract.
- No actual user-test study, mobile INP percentile, accessibility certification, calibrated Lighthouse score or production VPS deployment has been performed.
- Browser Back normally restores the prior query/filter URL; exact scroll restoration can vary with browser and Next.js navigation timing.

Local check:

```sh
git pull origin main
npm install
npm run dev
```

Then visit `http://localhost:3000`, `/shop` or `/search?q=شومیز`.
