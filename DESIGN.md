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
   home hero runs five, all finished within 1.5s. Copy, prices and calls to action never wait for an animation.
7. Text never animates through low contrast. Reveals move text or unmask it; they don't fade small text in.
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
| `--color-surface-rgb` | `245 240 232` | The canvas as channels for translucent bars | — |

### Typography

One family for everything: **Estedad** (variable 100–900, self-hosted). The wordmark stays Georgia.

| Role | Size | Weight |
| --- | --- | --- |
| Cover headline (home hero) | `--text-hero` / `--text-hero-stacked` | 200 (`--font-weight-extralight`), emphasised words 500 |
| Page and section headings | `--text-heading`, `clamp(2rem, 1.35rem + 2.4vw, 3.25rem)` | 300 (`--font-weight-light`), emphasised words 500 |
| Collection names in boxes and the menu | 1.6–2.6rem | 300 |
| Body, product names, prices, forms | the `--text-*` scale | 400–700 as before |

- `--text-hero: clamp(3rem, 6.3vw, 6.4rem)` beside the photos and `--text-hero-stacked: clamp(2.5rem, 0.2rem + 12vw,
  4.4rem)` when the hero stacks, with `--leading-display: 1.3`. Each cover line fits its column unwrapped from 320 to
  1920px (checked).
- Editorial numbering (`۰۱`, `۰۲` …) comes from `editorialNumber()` in `lib/format.ts`, is set light in the accent
  colour and is `aria-hidden`.
- Prices always use Persian digits with `٬` grouping and the تومان label (`Price` component).

### Shape

Soft, rounded boxes. Pick the radius by role, not by size:

| Token | Value | Role |
| --- | --- | --- |
| `--radius-pill` | `999px` | Buttons, chips, size options, steppers, pagination, tags, nav hover states, search field |
| `--radius-lg` | `24px` | Panels, cards, sheets and dialogs, hero plates, collection boxes, empty states |
| `--radius-md` | `16px` | Product photos, notices, option boxes, toasts, skeletons |
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

### Home hero (magazine cover)
`app/page.tsx`, `styles/home.css`. The headline on the start side, with each line rising out of its own mask: the
first line extra-light, the second medium in oxblood. Two overlapping rounded plates show the newest product and the
newest one from another collection. Each has a caption with number, name link and price (`Price`), so the cover is
shoppable. The main plate is the LCP image: preloaded, high priority and still from the first frame. The second plate
is fetched at low priority and unmasked by a wipe. Three soft boxes (number, collection, round arrow button) lead into
the collections. Phones stack copy, plates and boxes.

### Home sections
`app/page.tsx`, `styles/home.css`.
- **Collections:** three sand rooms (`--color-studio`, `--radius-lg`). Each model is feathered into her panel (mask on
  all four sides, only a thin strip at the top because the photos have almost no headroom), so she seems to stand in
  the page; the name in light type, a line, and a round arrow disc. The figure settles in as the room scrolls into
  view. Side by side from 1081px, stacked below. If future photography uses another backdrop, retune `--color-studio`.
- **Shop by colour:** a soft panel; colour choices are paper pills, the chosen one ringed in ink.
- **Editorial band:** a soft panel with the photograph as a rounded plate capped at 460px wide (about its real size, so
  it stays sharp); it settles from a slow zoom as it scrolls in.
- **Service links:** three soft boxes with a round arrow disc, matching the boxes under the hero.
- **Closing call to action:** a last sand room. A model is feathered into the panel at the inline end like the
  collections, with the invitation and an ink pill button beside her; she settles in as the room scrolls into view.
  On phones she stands at the panel's foot and the copy narrows beside her.
- `.arrow-disc` is the shared round paper arrow button for every soft box; it nudges toward its arrow on hover.

### Product card
`components/products/product-card.tsx`, `styles/catalog.css`. A rounded 3:4 photo with a paper pill tag for sale or
sold-out, and the heart on a paper disc (44px target). With a fine pointer, the second photo crossfades in on hover or
focus over a slow zoom. On touch screens the photos are a scroll-snap track, and a two-segment bar shows the position
(scroll-driven where supported, static otherwise). No client JavaScript: only the wishlist button hydrates. Below the
photo: category, name (semibold, underline draws in on hover), price, colour dots.

### Buttons and controls
Pill-shaped. Primary buttons are ink and turn oxblood on hover (only where a pointer can hover). Size options,
quantity steppers, chips and pagination are pills; fields are softly rounded (`--radius-sm`).

### Search
`components/search/*`, `styles/catalog.css`. The search field (header panel and the search page) is a soft pill on
`--color-surface-muted`; while typing it turns white with an ink focus ring. Result thumbnails are rounded
(`--radius-sm`); result rows are `--radius-md` boxes.

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
| Category | 91 / 3.39s / 0 | 91 / 3.39s / 0 |
| Product | 92 / 3.24s / 0 | 93 / 3.17s / 0 |

Accessibility is 100 on all three. Home's distributions overlap (both cluster at 3.31–3.32s; the redesign has more
runs in a 3.54s mode), so the difference is within the simulator's noise. Home carries +12 KB, mostly the second hero
plate. Every later phase is held to the same rule: no page gets slower or shifts.

Lessons kept from the proof: a root-layout font preload competes with every page's LCP image; nineteen simultaneous
entrance animations cost real main-thread time during hydration even when composited.

## Photography

The demo photos are 480×640. Plates are sized so they are rarely upscaled: the hero main plate is about 470px wide
on desktop. Product photography for launch should be at least 1600px on the long edge, 3:4, on a consistent backdrop.

## Rollout status

- [x] Proof: header and menu, home hero, product card
- [x] Design tokens across all components (colour, type weights, radius roles, outline token)
- [x] Shared components (search, sheets and dialogs, toasts, desktop nav panel, footer, bottom nav)
- [x] Home page sections (collections, shop by colour, editorial band, service links, closing call to action)
- [ ] Category and search pages
- [ ] Product page
- [ ] Cart and checkout (styling only)
