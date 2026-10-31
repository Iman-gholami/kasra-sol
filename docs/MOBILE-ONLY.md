# One phone layout, centred on wide screens

The storefront has a single design: the phone's. On a tablet or a computer it is shown as a centred column 480 px
wide on the studio-gray backdrop, the way digikalajet.com and behtarino.com do it. Almost every customer arrives on a
phone, so a second, desktop design would cost twice the work for the few who do not. The back office (`/admin`) is
not affected: staff use it on computers at the shop counter, and it keeps the full width.

## How it works

- **`<body>` is the column.** `base.css` makes it the query container `kasra` (`container: kasra / inline-size`) and,
  outside the back office, limits it to `--app-width` (480 px, `tokens.css`) and centres it; `<html>` shows the
  backdrop (`--color-backdrop`) around it. On a phone the column is simply the whole screen, so phones look exactly as
  before.
- **Breakpoints are container queries.** Every storefront rule that used `@media (max-width: …)` uses
  `@container kasra (max-width: …)`: it asks how wide the column is, not the screen. A 1440 px screen therefore gets
  the same rules as a 480 px phone. Rules for wider columns (the old desktop layout) can no longer match anything.
- **Fluid sizes use `cqi`** (1 % of the column) instead of `vw` (1 % of the screen).
- **Fixed bars and dialogs** are positioned against the screen, not the column, so they are held to it: full-width
  bars add `max-inline-size: 100cqi; margin-inline: auto`, side drawers start at `--app-edge` (the distance from the
  screen edge to the column), full-screen sheets are `100cqi` wide and centred.
- `<html>` is outside the container, so a rule on `html` or `:root` inside an `@container` block never applies; such
  rules (for example the space kept for the bottom bar, `html[data-bottom-bar]`) live outside those blocks.

## Writing new styles

- Design for the phone only. Give a rule a breakpoint only for **narrower** phones (`@container kasra (max-width: 360px)`).
- Never use a viewport width media query (`@media (min-width…)`/`(max-width…)`) or `vw` in the storefront stylesheets;
  use `@container kasra` and `cqi`. Media queries about the device itself stay (`hover`, `prefers-reduced-motion`,
  `print`).
- A new fixed bar or dialog must stay inside the column (see above).
- `tests-unit/single-layout-css.test.ts` enforces these rules on `src/styles/*.css` (except `admin.css`).

## Tests

- `tests/single-layout.spec.ts`: wide screens (768–1920 px) show a centred 480 px column on the backdrop with the phone
  navigation; on a 1440 px screen the home page, the shop and a product page are laid out **exactly** like a 480 px
  phone (same positions and sizes); the bottom bar, the product purchase bar and the filter, menu and size-guide
  sheets stay inside the column; phones are unchanged; the back office keeps the full width.
- `tests-webkit/iphone.spec.ts` (Safari's engine): fixed bars stay on the bottom edge of the screen although `<body>`
  is a container, and an iPad shows the centred column with its bars inside.
- The other storefront tests that ran at desktop sizes now check the phone layout there (filter and sort sheets,
  two-column grid, purchase bar, phone purchase-flow header).

## Left to clean up

The old desktop styles and the markup only they showed can no longer appear, but they are still in the code. They can
be deleted step by step; `tests/single-layout.spec.ts` shows that the wide-screen page stays the phone page:

- desktop rules that the container queries override (base rules of `.hero`, `.catalog-body`, `.detail-layout`,
  `.cart-layout`, `.checkout-layout`, the footer grid…), and `@container kasra (max-width: 1180px | 1080px | 820px |
  760px | 600px)` blocks that then become plain rules;
- desktop-only components: the header's category navigation with its shop panel (`primary-nav.tsx`), the catalog
  filter sidebar and sort form, the gallery thumbnails, the checkout summary sidebar (`.checkout-summary`, the phone
  shows `.checkout-summary-mobile`) and the added-to-cart panel's desktop position.
