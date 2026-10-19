# Kasra design system — «مجله کسری» (Kasra Journal)

Every page is laid out like a magazine spread. Typography and layout carry the brand; the photographs are set
like editorial plates, at sizes where they stay sharp. The clothes are the star, the page is the frame, and buying
is never more than one obvious step away.

## Why this direction

- **It survives any photography.** The identity lives in type, rules and layout, so it works with today's six
  480×640 demo photos and with any future shoot, whatever its backdrop.
- **It keeps photos sharp.** Plates are sized close to the source resolution instead of stretched full-bleed.
- **It is unmistakably Persian and premium.** A classical Naskh display face at magazine sizes, at a mid-range price.
- **Buying stays calm.** Black buttons, clear prices, sizes and colours always visible, nothing behind a hover.

## Principles

1. One wow moment per section, never five.
2. The UI palette is quieter than the photographs: paper, ink and one oxblood accent.
3. Persian is never split into letters and never letter-spaced. Animate by line or by word.
4. Motion uses `transform` and `opacity` only, starts from CSS (no hydration wait), and never hijacks scrolling.
5. The LCP image is still and fully visible from the first paint: never masked, faded or zoomed.
6. Keep entrance choreography small. Even composited animations cost main-thread time while the page hydrates; the
   home hero runs five, all finished within 1.5s. Copy, prices and calls to action never wait for an animation.
7. Hover only enhances. Everything a hover reveals is also reachable by touch or keyboard.

## Tokens (`src/styles/tokens.css`)

### Colour

| Token | Value | Role | Contrast |
| --- | --- | --- | --- |
| `--color-surface` | `#f5f0e8` | Page canvas, warm paper | — |
| `--color-surface-muted` | `#ece5da` | Bands, hovers, summaries | — |
| `--color-surface-sunken` | `#ddd0bf` | Image placeholders, close to the studio sand | — |
| `--color-text` | `#1b1714` | Ink: text, primary buttons, strong rules | 14.2:1 on muted |
| `--color-text-muted` | `#5e554d` | Secondary text | 5.8:1 on muted |
| `--color-text-subtle` | `#675d54` | Meta text | 5.1:1 on muted |
| `--color-accent` | `#6b2a22` | Oxblood: emphasis, numbers, hover of primary buttons | 8.5:1 on muted |
| `--color-border` | `#ddd4c8` | Hairline dividers | — |
| `--color-surface-rgb` | `245 240 232` | The canvas as channels for translucent bars | — |

Strong editorial rules (under section heads, around the hero contents strip) use `--color-text` at 1px.

### Typography

| Role | Face | Where |
| --- | --- | --- |
| UI, body, prices, forms, product names | Estedad (variable 100–900) | Everywhere readable at body size |
| Display | Amiri Regular, Persian subset (`--font-display`) | Headings 28px and up: hero, collection names, menu, section heads |
| Wordmark | Georgia (`--font-wordmark`) | The KASRA lockup only |

- `--text-hero: clamp(3rem, 6.3vw, 6.4rem)` beside the photos and `--text-hero-stacked: clamp(2.5rem, 0.2rem + 12vw,
  4.4rem)` when the hero stacks, with `--leading-display: 1.38`. Both are sized so each cover line fits unwrapped even
  in the wider fallback face (checked from 320 to 1920px), so the font swap never reflows the headline.
- Amiri is loaded with `font-display: swap` and is **not preloaded** (a root-layout preload fetched it on every route
  ahead of the LCP image and cost about 0.6s of simulated mobile LCP). Its layout metrics are overridden to Estedad's
  (ascent 102.5%, descent 50%, no line gap), so swapping between the two moves nothing. Masked display lines are
  fixed boxes that clip to themselves, padded `0.2em 0.25em` for Amiri's real ascenders and descenders.
- Editorial numbering (`۰۱`, `۰۲` …) is set in Amiri in the accent colour and is `aria-hidden`.
- Prices always use Persian digits with `٬` grouping and the تومان label (`Price` component).

### Motion

| Token | Value | Use |
| --- | --- | --- |
| `--ease-editorial` | `cubic-bezier(0.16, 1, 0.3, 1)` | Reveals, zooms, underlines: a long, soft landing |
| `--ease-wipe` | `cubic-bezier(0.65, 0, 0.35, 1)` | Image unmasking |
| `--duration-reveal` | `1100ms` | Headline lines, image wipes |

- Stagger: 60–110ms between lines or items; secondary content follows at 450–600ms.
- RTL: "forward" is the physical left. Underlines draw from the inline start, so `transform-origin: right center`.
  Swipe tracks rely on native RTL scrolling.
- Reduced motion: the global rule in `base.css` collapses every animation and transition to its end state, so all
  content is present immediately and nothing moves.

## Component patterns

### Header (masthead)
`components/layout/header.tsx`, `styles/layout.css`. A three-column grid: navigation at the inline start, the
wordmark centred, actions at the end. The DOM order matches the visual order. Solid paper background with a hairline
(no translucency or blur). Nav links draw a 1px underline from the inline start on hover; the current page keeps it.
Below 1081px the menu button replaces the link row. Search is an underlined field on wide screens, an icon below.

### Menu (≤ 1080px)
`components/layout/mobile-menu.tsx`. A full-screen sheet from the inline start, closed by swiping toward that edge
or by Escape. The collections are set large in Amiri and numbered like a contents page; they rise one after another
on every open, then the rest of the menu fades in.

### Home hero (magazine cover)
`app/page.tsx`, `styles/home.css`. The headline on the start side, with each line rising out of its own mask.
Two overlapping plates show the newest product and the newest one from another collection. Each has a caption with
number, name link and price (`Price`), so the cover is shoppable. The main plate is the LCP image: preloaded, high
priority and still from the first frame. The second plate is fetched at low priority and unmasked by a wipe. A
numbered contents strip links to the collections. Phones stack copy, plates and the strip.

### Product card
`components/products/product-card.tsx`, `styles/catalog.css`. A 3:4 photo with the sale or sold-out label set flush
into the corner as a small ink slug, and a bare heart with a soft paper glow (44px target). With a fine pointer, the
second photo crossfades in on hover or focus over a slow zoom. On touch screens the photos are a scroll-snap track,
and a two-segment bar shows the position (scroll-driven where supported, static otherwise). There is no client
JavaScript: only the wishlist button hydrates. Below the photo: category, name (semibold, underline draws in on hover),
price, colour dots.

### Buttons
Primary buttons are ink and turn oxblood on hover (only where a pointer can hover). Text links keep a 1px underline.

## Performance budget

Measured with Lighthouse 12 (mobile, simulated throttling) against the pre-redesign build, same machine, back to back.
The proof phase is at parity: home median LCP 3.48s vs about 3.4s (7–8 runs each, ±0.4s run-to-run noise), category
and product pages unchanged, CLS 0.000 everywhere, accessibility 100. Home carries +50 KB: the Amiri subset (41 KB)
and the second hero plate. Every later phase is held to the same rule: no page gets slower or shifts.

## Photography

The demo photos are 480×640. Plates are sized so they are rarely upscaled: the hero main plate is about 470px wide
on desktop. Product photography for launch should be at least 1600px on the long edge, 3:4, on a consistent backdrop.

## Rollout status

- [x] Proof: header and menu, home hero, product card (with the tokens they need)
- [ ] Design tokens across all components
- [ ] Shared components (sheets, chips, fields, toasts, breadcrumbs, footer, bottom nav)
- [ ] Home page sections (collections index, shop by colour, editorial band, service links)
- [ ] Category and search pages
- [ ] Product page
- [ ] Cart and checkout (styling only)
