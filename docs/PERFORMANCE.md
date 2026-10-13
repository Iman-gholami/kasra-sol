# Performance and verification status

## Engineering targets (not measured results)

- Lighthouse mobile Performance **≥90** under a recorded device/network profile
- LCP **≤2.5 s**, INP **≤200 ms**, CLS **≤0.1** at p75 when real-user data exists
- No mobile overflow at widths 320, 375, 390, 430, 768, 1024 and 1440
- Representative page lab tests on production build; separate lab and RUM

## Implemented optimizations

- Server Component rendering for catalog and detail routes; paginated adapter limiting result payloads to 9 products
- URL-driven filters/sort and Persian text normalization on the server layer
- No animation framework or heavyweight carousel; local SVG artwork, reserved 3:4 aspect ratios, prioritized homepage hero
- Small purpose-built React shopping store, CSS motion with reduced-motion fallback
- Next standalone Docker runtime, health endpoint, reverse-proxy/CDN caching guidance

## Measured results

**None claimed in this document.** Lighthouse, p75 Web Vitals, load capacity, production Docker deployment and ParsPack VPS smoke tests have not been recorded by this authoring environment. Do not interpret architectural targets as achieved scores.

GitHub Actions checks are defined in `.github/workflows/ci.yml`. Check the **latest run for the referenced commit** for actual lint, TS, build and Playwright outcomes. Test coverage is a baseline, not an exhaustive WCAG audit.

## Measurement procedure

1. `npm install && npm run build && npm run start`.
2. Run Lighthouse against `/`, `/shop`, `/product/shomiz-01`, `/cart`, `/checkout` with a documented Chrome version, simulated mid-tier mobile, 4G settings, and repeat runs.
3. Record median lab LCP, TBT, CLS, transferred JS and build outputs. Assess responsiveness under variant/cart interactions.
4. On the real deployment, gather real-user LCP/INP/CLS by route and device segment; compare 75th percentiles.
5. Test the seven requested viewport widths and keyboard/screen-reader journeys.
6. Load-test CDN hit and origin-miss scenarios with controlled concurrency and expected product/navigation distribution. Do not issue campaign-scale tests against an unapproved production server.

Known gap: true model photography, licensed optimized self-hosted Persian font and reproducible npm lockfile are still required before release. Current imagery is original vector mock artwork for layout testing.
