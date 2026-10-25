# Kasra Wear — Palette B

Approved design: brand red `#B51F2B`, white `#FFFFFF`, quiet gray `#F1F2F4`, charcoal `#181818`. Storefront only; admin colors remain independent.

| Role | Token | Value |
|---|---|---|
| Brand, CTA, sale, announcement, active nav, wordmark | `--color-brand` | `#B51F2B` |
| Hover / pressed | `--color-brand-hover` / `--color-brand-active` | `#981A24` / `#7E1520` |
| Background, header, nav | `--color-surface` | `#FFFFFF` |
| Muted sections | `--color-surface-muted` | `#F1F2F4` |
| Text and footer | `--color-text` | `#181818` |
| Supporting copy | `--color-text-muted` | `#62666D` |
| Border | `--color-border` | `#E5E7EB` |
| Soft accent | `--color-accent-wash` | `#F9EBED` |

Normal prices are charcoal; sale prices are red. Footer text stays white / light gray. Error, success and warning colors are separate semantic roles. The photo-only studio color remains subtly warm because current demo images have sand backdrops; review with production photography.

Contrast examples: brand red against white 6.57:1, muted copy against white 5.77:1, muted copy against gray sections 5.15:1. Playwright color regression assertions live in `tests/storefront-polish.spec.ts`.
