# Kasra design system — «مجله کسری» (Kasra Journal)

Every page is laid out like a magazine spread: a cover headline, photographs set as plates with captions, numbered
contents. The voice is soft and light: one family (Estedad) speaking in its extra-light weight at large sizes, and
rounded, gentle boxes. The clothes are the star, the page is the frame, and buying is never more than one obvious
step away.

The direction combines the layout of pitch A («مجله کسری») with the typography and the box language of pitch B
(«استودیو»), as chosen by the owner.

## Why this direction

- **It survives any photography.** The identity lives in layout, type weight and shape, so it works with today's six
  480×640 demo photos and with any future shoot, whatever its backdrop.
- **It keeps photos sharp.** Plates are sized close to the source resolution instead of stretched full-bleed.
- **It is light and fast.** No extra font: the display voice is Estedad's own extra-light weight.
- **Buying stays calm.** Ink buttons, clear prices, sizes and colours always visible, nothing behind a hover.

## Principles

1. One wow moment per section, never five.
2. The UI palette is quieter than the photographs: paper, ink and one oxblood accent.
3. Persian is never split into letters and never letter-spaced. Animate by line or by word.
4. Motion uses `transform` and `opacity` only, starts from CSS (no hydration wait), and never hijacks scrolling.
5. The LCP image is still and fully visible from the first paint: never masked, faded or zoomed.
6. Keep entrance choreography small. Even composited animations cost main-thread time while the page hydrates; the
   home hero runs three, all finished within 1.5s. Copy, prices and calls to action never wait for an animation.
7. Text never animates through low contrast. Reveals move text or unmask it; they don't fade small text in. The one
   exception is transient feedback (toasts, the floating filter pill, the cart's «removed» row), which keeps its
   short fade-and-rise (`toast-in`, under 300ms).
8. Hover only enhances. Everything a hover reveals is also reachable by touch or keyboard.

## Tokens (`src/styles/tokens.css`)

### Colour

| Token | Value | Role | Contrast |
| --- | --- | --- | --- |
| `--color-surface` | `#f5f0e8` | Page canvas, warm paper | — |
| `--color-surface-muted` | `#ece5da` | Soft boxes, hover pills, summaries | — |
| `--color-surface-sunken` | `#ddd0bf` | Image placeholders and pressed boxes, close to the studio sand | — |
| `--color-text` | `#1b1714` | Ink: text, primary buttons | 14.2:1 on muted |
| `--color-text-muted` | `#5e554d` | Secondary text | 5.8:1 on muted |
| `--color-text-subtle` | `#675d54` | Meta text | 5.1:1 on muted |
| `--color-accent` | `#6b2a22` | Oxblood: emphasis, numbers, sale tags, hover of primary buttons | 8.5:1 on muted |
| `--color-border` | `#ddd4c8` | Hairline dividers | — |
| `--color-outline-soft` | ink at 28% | Rings around colour swatches, inactive indicators | — |
| `--color-studio` | `#c9ab8f` | The photographs' seamless backdrop: the panels models are feathered into | ink 7.9:1 |
| `--color-surface-rgb` | `245 240 232` | The canvas as channels for translucent paper on photos (heart disc, gallery labels and arrows); bars are solid | — |

### Typography

One family for everything: **Estedad** (variable 100–900, self-hosted). The wordmark stays Georgia.

| Role | Size | Weight |
| --- | --- | --- |
| Cover headline (home hero) | `--text-hero` / `--text-hero-stacked` | 200 (`--font-weight-extralight`), emphasised words 500 |
| Page and section headings | `--text-heading`, `clamp(2rem, 1.35rem + 2.4vw, 3.25rem)` | 300 (`--font-weight-light`), emphasised words 500 |
| Collection names in the menu | 1.6–2.6rem | 300 |
| Body, product names, prices, forms | the `--text-*` scale | 400–700 as before |

- `--text-hero: clamp(2.6rem, 5vw, 5.4rem)` beside the slider and `--text-hero-stacked: clamp(2.1rem, 10vw, 2.9rem)`
  when the hero stacks, with `--leading-display: 1.3`. Each cover line fits its column unwrapped from 320 to 1920px
  (checked).
- Editorial numbering (`۰۱`, `۰۲` …) comes from `editorialNumber()` in `lib/format.ts`, is set light in the accent
  colour and is `aria-hidden`.
- Prices always use Persian digits with `٬` grouping and the تومان label (`Price` component).

### Shape

Soft, rounded boxes. Pick the radius by role, not by size:

| Token | Value | Role |
| --- | --- | --- |
| `--radius-pill` | `999px` | Buttons, chips, size options, steppers, pagination, tags, nav hover states, search field, the catalog toolbar |
| `--radius-lg` | `24px` | Panels, cards, sheets and dialogs, the hero room, the product gallery plate, soft link boxes, empty states, the filter sidebar, the buy box |
| `--radius-md` | `16px` | Product photos, notices, option boxes, accordions, toasts, skeletons |
| `--radius-sm` | `10px` | Form fields, small thumbnails |
| `--radius-xs` | `4px` | Focus ring, keyboard hints |

Edge-to-edge elements on phones (the product gallery, checkout cards in the purchase flow) stay square.

### Motion

| Token | Value | Use |
| --- | --- | --- |
| `--ease-editorial` | `cubic-bezier(0.16, 1, 0.3, 1)` | Reveals, hovers, zooms: a long, soft landing |
| `--ease-wipe` | `cubic-bezier(0.65, 0, 0.35, 1)` | Image unmasking |
| `--duration-reveal` | `1100ms` | Headline lines, image wipes |

- Stagger: 60–110ms between lines or items.
- RTL: "forward" is the physical left (`--inline-sign: -1`). Scale-from-start origins are `right center`. Swipe
  tracks rely on native RTL scrolling.
- Scroll-driven settles (`animation-timeline: view()`) move photographs only, never text, and are declared inside
  `@media (prefers-reduced-motion: no-preference)` because a duration override cannot stop a scroll-linked animation.
- Reduced motion: the global rule in `base.css` collapses every time-based animation and transition to its end state,
  so all content is present immediately and nothing moves.

## Component patterns

### Header (masthead)
`components/layout/header.tsx`, `styles/layout.css`. A three-column grid: navigation at the inline start, the
wordmark centred, actions at the end; the DOM order matches the visual order. Solid paper background with a hairline.
Nav links show a soft pill on hover and on the current page; their padding scales with the viewport so the row clears
the wordmark from 1081px up. Below 1081px the menu button replaces the link row. Search is a soft pill field on wide
screens and an icon below.

### Menu (≤ 1080px)
`components/layout/mobile-menu.tsx`. A full-screen sheet from the inline start, closed by swiping toward that edge
or by Escape. The collections are set large and light, numbered like a contents page, and drift up one after another
on every open (movement only, full contrast throughout).

### Home hero (magazine cover with a product slider)
`app/page.tsx`, `components/home/hero-slider.tsx`, `styles/home.css`. One sand room (`--color-studio`) holds the
whole cover. The headline sits on the start side, each line rising out of its own mask: the first line extra-light,
the second medium in oxblood. The other side is a slider: one model at a time, feathered into the sand like the
collection rooms, with a paper tag (discount badge, name, `Price`) that links to the product. Phones stack it: the
headline and the main button over the room, the lede and «تازه‌ترین‌ها» below.

- **Which products:** the owner picks up to eight in the back office (**اسلایدر صفحه اول**, `products:write`), in
  order. With no pick, the cover shows up to five discounted products (one per photo first); with no discounts, the
  three newest. Archived or hidden products drop out on their own.
- **Autoplay:** a new slide every 5 seconds, cross-faded over 700ms. The progress segments at the top are also the
  slide buttons («اسلاید ۲ از ۵»). A pause button stops it (WCAG 2.2.2), and hover or keyboard focus holds the
  current slide. A sideways swipe changes slides (a drag to the right brings the next one, as in the product
  galleries); vertical scrolling is untouched. With reduced motion there is no autoplay and no pause
  button; the segments still change slides.
- **Speed:** only the first slide is in the server HTML; it is the LCP image (preloaded, high priority, still from
  the first frame). The other slides' photos are added once the browser is idle, so they never compete with it.
- **Screen readers:** a region «محصولات ویژه» with `aria-roledescription="اسلایدر"`; each slide is a group, and
  inactive slides are `inert` and hidden. Slide changes are announced only while autoplay is off (paused, or
  reduced motion), never every five seconds.

The collections follow as circles (below).

### Home sections
`app/page.tsx`, `styles/home.css`.
- **Collections:** three sand rooms (`--color-studio`, `--radius-lg`). Each model is feathered into her panel (mask on
  all four sides, only a thin strip at the top because the photos have almost no headroom), so she seems to stand in
  the page; the name in light type, a line, and a round arrow disc. The figure settles in as the room scrolls into
  view. Side by side from 1081px, stacked below. If future photography uses another backdrop, retune `--color-studio`.
- **Shop by colour:** a soft panel; colour choices are paper pills, the chosen one ringed in ink.
- **Editorial band:** a soft panel with the photograph as a rounded plate capped at 460px wide (about its real size, so
  it stays sharp); it settles from a slow zoom as it scrolls in.
- **Service links:** three soft boxes with a round arrow disc.
- **Closing call to action:** a last sand room. A model is feathered into the panel at the inline end like the
  collections, with the invitation and an ink pill button beside her; she settles in as the room scrolls into view.
  On phones she stands at the panel's foot and the copy narrows beside her.
- `.arrow-disc` (`styles/primitives.css`) is the shared round paper arrow button for every soft link box; it nudges
  toward its arrow on hover.

### Product card
`components/products/product-card.tsx`, `styles/catalog.css`. A rounded 3:4 photo with a paper pill tag for sale or
sold-out, and the heart on a paper disc (44px target). With a fine pointer, the second photo crossfades in on hover or
focus over a slow zoom. On touch screens the photos are a scroll-snap track, and a two-segment bar shows the position
(scroll-driven where supported, static otherwise). No client JavaScript: only the wishlist button hydrates. Below the
photo: category, name (semibold, underline draws in on hover), price, colour dots.

### Product page
`components/products/product-detail.tsx`, `product-gallery.tsx`, `purchase-panel.tsx`, `styles/product.css`.
- **Gallery:** a rounded plate (`--radius-lg`) with rounded thumbnails; the chosen thumbnail is ringed in ink. On
  phones the gallery runs edge to edge and square. The first image is the LCP image and is never animated.
- **Buy box:** the title in light type and the price above a soft panel holding colour, size, quantity and the
  buttons. Inside it, options are paper: the chosen colour box is ringed in ink, the chosen size is ink, and
  unavailable options lose their fill for a dashed outline. The stepper and the wishlist disc are paper too. The
  add button keeps 16px side padding so its longest label fits a 320px phone.
- **Details:** «درباره این مدل» in light type; material and shipping are soft accordion boxes; the demo notice is the
  same soft box.
- **Phones:** the purchase bar is solid paper with a hairline, like the bottom navigation.
- **Zoom:** the image is rounded (`--radius-md`); its controls are soft discs.

### Cart and checkout
`components/cart/*`, `components/checkout/*`, `styles/commerce.css`. Styling only: the flow, its rules and its
copy are unchanged.
- **Headings:** the summary, step and order-card headings are light, like every other section heading.
- **Cart lines:** hairline-separated rows; the quantity stepper is two soft discs around the count.
- **Summary:** the soft panel (`--radius-lg`, muted); the form step is a white sheet with a hairline, so fields read
  as fields and the summary as a summary.
- **Phones:** the flow keeps its own header and white card, now on a sand tint (it was a pink accent wash). The cart's
  total bar is solid paper and the checkout submit bar solid white, like every other bottom bar.
- **Choices, review, gateway and confirmation** keep their clear outlines: in the purchase flow a visible state wins
  over softness.

### Accordions
`styles/primitives.css`. Native `details` elements set as stacked soft boxes (`--radius-md`, muted), 8px apart.
Used on the product page and the FAQ.

### Buttons and controls
Pill-shaped. Primary buttons are ink and turn oxblood on hover (only where a pointer can hover). Size options,
quantity steppers, chips and pagination are pills; fields are softly rounded (`--radius-sm`). The quantity stepper is
a soft muted pill without an outline (paper inside the buy box).

Chips are soft pills without an outline: muted on the page, paper on a soft panel (the filter sidebar, empty states,
the 404 card), ink when current or checked. Set `--chip-bg` / `--chip-bg-hover` for a new context instead of
restyling the chip. The same rule holds for any control on a soft panel: it turns paper so it still reads as a
control (the 404 search field does this).

### Collection circles
`components/home/collection-circles.tsx`, `.collection-circles` in `styles/primitives.css`. Story-style circles: the
model's face and shoulders in an oxblood ring with the collection name below, side by side at every width (88–132px,
so all three fit a 320px phone). Under the home hero and on the empty search page.

### Catalog (category, all products, search results)
`components/catalog/*`, `styles/catalog.css`.
- **Heading:** the title in light type; on a category page its contents number (`۰۱`, `۰۲` …, `aria-hidden`) sits
  beside it as on the home strip. The count is a light number plus «مدل», on the baseline of the intro line.
- **Collections row:** chips; the current one ink. On phones the row scrolls with an edge fade.
- **Toolbar (desktop):** a soft pill bar with the range on the start side and the sort pill and its apply button at
  the end (sort keeps its explicit apply button, WCAG 3.2.2).
- **Filter sidebar (desktop):** a sticky soft panel (`--radius-lg`, 256px, 224px up to 1080px). Size chips and
  colour choices inside it are paper; the chosen colour's dot is ringed in ink. Price fields stay white with an
  outline.
- **Phones:** two soft pills (`btn-tertiary`): «فیلتر» opens the filter sheet, where chips are muted and the chosen
  colour sits on a soft ground; the sort pill names the current order and opens a sort sheet of links, where one tap
  applies an order and closes the sheet (two taps in all; links act only when activated, so WCAG 3.2.2 holds). The
  ink floating «فیلترها» pill stays one tap away after scrolling.
- **Demo-photo note:** follows the results, so the first products start right under the controls (340px from the top
  of a phone screen, from 389–409px).
- **Pagination:** soft discs, the current page ink; previous and next are pills that tint on hover.
- **Empty state:** the shared soft box with a light heading.
- **Loading:** the route skeleton mirrors the layout (pill toolbar, panel-width sidebar) so streaming in shifts
  nothing.

### Search
`components/search/*`, `app/search/page.tsx`, `styles/catalog.css`. The search field (header panel and the search
page) is a soft pill on `--color-surface-muted`; while typing it turns white with an ink focus ring. Result thumbnails
are rounded (`--radius-sm`); result rows are `--radius-md` boxes. The search page opens with a light heading and,
before a query, the collection circles; results use the catalog layout above.

### Sheets, dialogs and toasts
`components/ui/sheet.tsx`, `styles/primitives.css`. Centre dialogs and the desktop search dropdown take `--radius-lg`;
bottom sheets round their top corners; side drawers stay square against the screen edge. Toasts are ink with
`--radius-lg`.

### Desktop navigation panel
`components/layout/primary-nav.tsx`. Hangs from the header as a card with rounded lower corners; collection photos
are `--radius-md`.

### Footer
`components/layout/footer.tsx`, `styles/layout.css`. A soft rounded panel (`--radius-lg`, `--color-surface-muted`) at
page width: the panel itself is the page-width box, so its columns line up with the header. The copyright line sits
beneath it, outside the panel.

### Bottom navigation (phones)
`components/layout/bottom-nav.tsx`. Solid paper with a hairline on top (no translucency). The current tab is oxblood
and wears a soft pill behind its icon.

## Performance budget

Measured with Lighthouse 12 (mobile, simulated throttling) against the pre-redesign build, same machine, back to back,
median of 3 runs (run-to-run noise is about ±0.4s of LCP):

| Page | Before: score / LCP / CLS | After: score / LCP / CLS |
| --- | --- | --- |
| Home (8 interleaved runs) | 92 / 3.32s / 0 | 91.5 / 3.43s / 0 |
| Category (10 interleaved runs, phase 5) | 91.5 / 3.39s / 0 | 91 / 3.39s / 0 |
| Search results (10 interleaved runs, phase 5) | 91 / 3.39s / 0 | 91 / 3.39s / 0 |
| Product (10 interleaved runs, phase 6) | 92 / 3.23s / 0 | 93 / 3.17s / 0 |

Accessibility is 100 on every page measured. Home's distributions overlap (both cluster at 3.31–3.32s; the redesign
has more runs in a 3.54s mode), so the difference is within the simulator's noise. Home carries +12 KB, mostly the
second hero plate. Catalog LCP is bimodal on both builds (about 2.6–2.9s or 3.39s per run), so four runs can
mislead; compare at least ten interleaved runs, and the mean as well as the median. When a page looks slower, build
the previous phase too and run all three interleaved: for the product page that showed pre-redesign, phase 5 and
phase 6 at mean LCP 3.12s, 3.16s and 3.12s. Every later phase is held to the same rule: no page gets slower or
shifts.

Final sweep after the last phase (5 interleaved runs per page, medians; CLS is the worst run):

| Page | Before: score / LCP / CLS / TBT | After: score / LCP / CLS / TBT |
| --- | --- | --- |
| Home | 91 / 3.39s / 0 / 38ms | 92 / 3.32s / 0 / 64ms |
| Category | 91 / 3.39s / 0 / 78ms | 91 / 3.39s / 0 / 106ms |
| Product | 92 / 3.24s / 0 / 72ms | 92 / 3.23s / 0 / 94ms |
| Cart | 95 / 2.87s / 0 / 96ms | 95 / 2.87s / 0 / 99ms |
| Checkout | 94 / 3.01s / 0 / 73ms | 94 / 3.01s / 0 / 86ms |

Scores and LCP hold on every page and nothing shifts. Total blocking time is 3–28ms higher in the medians on every
page: small, far under the 200ms “good” threshold and inside run-to-run noise at five runs (the ten-run product
comparison had 74ms before and 79ms after), but consistently in the same direction, so it is the number to watch if
more motion or client code is added.

### Mobile speed pass

After the redesign, two changes that alter nothing visible (5 interleaved Lighthouse mobile runs, medians):

- **Admin styles only on `/admin`** (`app/admin/layout.tsx`): shoppers no longer download the back office's CSS or
  its `html:has()` rules. Storefront CSS: 27.6 KB → 22.0 KB compressed.
- **Persian subset of Estedad** (`fonts/Estedad-VF-fa.woff2`, see `fonts/README.md`): 121 KB → 81 KB. The font is
  preloaded and shares the first seconds of a phone's bandwidth with the LCP image.

| Page | Before: score / FCP / LCP | After: score / FCP / LCP |
| --- | --- | --- |
| Home | 91 / 1.22s / 3.46s | 93 / 0.91s / 3.17s |
| Category | 91 / 1.07s / 3.39s | 95 / 0.92s / 2.89s |
| Product | 94 / 1.06s / 3.16s | 95 / 0.91s / 2.93s |

Tried and rejected: `experimental.inlineCss`. Next.js embeds the stylesheet three times (a style tag plus the RSC
payload), so the home HTML grew from 15 KB to 82 KB compressed and FCP got worse (1.18s).

Not worth doing: deferring the search, menu and cart-confirmation code. Phones download 170 KB of JavaScript, of
which about 114 KB is React DOM and the Next.js router; all of the store's own client components share one 10.7 KB
chunk (the 38.5 KB core-js chunk is `noModule` and never fetched by modern browsers). Deferring search and the menu
would save 3–5 KB, below Lighthouse's run-to-run noise, and make the first search open wait for the network.

### Home cover slider

Home with the slider against the build before it (6 interleaved Lighthouse mobile runs, medians):

| Build | Score | FCP | LCP | CLS | TBT | Bytes |
| --- | --- | --- | --- | --- | --- | --- |
| Before (two plates) | 94 | 0.91s | 3.12s | 0 | 54ms | 330 KB |
| Slider | 94 | 0.92s | 3.05s | 0 | 53ms | 356 KB |

The extra 26 KB are the other slides' photos, fetched at low priority once the browser is idle, after the LCP. A
first run showed CLS 0.002: the pause button appeared only after hydration and narrowed the progress segments. It is
now in the server HTML and hidden by CSS under reduced motion, so the first paint already has the final layout.

Lessons kept from the proof: a root-layout font preload competes with every page's LCP image; nineteen simultaneous
entrance animations cost real main-thread time during hydration even when composited.

## Photography

The demo photos are 480×640. Plates are sized so they are rarely upscaled: the hero slide is about 470px wide on
desktop. Product photography for launch should be at least 1600px on the long edge, 3:4, on a consistent backdrop.

## Rollout status

- [x] Proof: header and menu, home hero, product card
- [x] Design tokens across all components (colour, type weights, radius roles, outline token)
- [x] Shared components (search, sheets and dialogs, toasts, desktop nav panel, footer, bottom nav)
- [x] Home page sections (collections, shop by colour, editorial band, service links, closing call to action)
- [x] Category and search pages (heading, collections row, toolbar, filter sidebar and sheet, pagination, empty
  and loading states, search page)
- [x] Product page (gallery, buy box, details and accordions, zoom, phone purchase bar, loading state)
- [x] Cart and checkout (styling only)
- [x] Home cover as a product slider chosen in the back office; collection circles
