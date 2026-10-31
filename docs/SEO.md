# Search engines: launch switch, sitemap and Search Console

The store is kept out of search engines until it is launched for real. One switch opens it, and everything that
tells search engines what to do follows that switch together, so they can never disagree.

## The switch

| | Closed (default: demo, preview, IP address) | Open (launch) |
| --- | --- | --- |
| `robots.txt` | `Disallow: /` for every crawler, no sitemap | `Allow: /`, product photos (`/api/media/`) allowed, private pages disallowed, `Sitemap: https://kasraboutique.ir/sitemap.xml` |
| Robots meta tag of public pages | `noindex, nofollow` | `index, follow` |
| Private pages (cart, checkout, account, wishlist, order confirmation, search, admin) | `noindex` | `noindex` (always) |
| `/sitemap.xml` | Built on every request from the published products of the API | The same |

It is the repository variable **`SITE_INDEXABLE`**, baked into the storefront image by the Release workflow
(`NEXT_PUBLIC_SITE_INDEXABLE`, read through `next.config.ts` `env` by [`src/lib/seo.ts`](../src/lib/seo.ts)). It only
takes effect for an HTTPS domain: a build for the server's IP address or a local copy always stays closed.

Pages rendered per request and prerendered pages read their settings at different moments; they once disagreed (open
`robots.txt`, closed product pages). Storefront CI therefore builds the store both ways and checks robots.txt, the
robots tag of public and private pages and the sitemap against a running server (`scripts/check-indexing.mjs`).

## The sitemap

`/sitemap.xml` lists the home page, the shop, the three categories, every **published** product the API returns at
that moment (with its first photo) and the five information pages. A product created in the admin appears in it, an
archived one disappears, without a release. If the API does not answer, the sitemap fails (HTTP 500) instead of
being empty, so search engines retry later instead of dropping the products.

## Opening the store (at launch, not before)

Search engines remember what they find. Before opening:

1. The real products are published and the demo catalog is removed ([DEPLOYMENT.md](DEPLOYMENT.md#removing-the-demo-catalog-before-launch)).
2. Policies, contact details and prices are real (README, "Before commercial launch").
3. `PRODUCTION_SITE_URL` is `https://kasraboutique.ir` and the site answers there with a trusted certificate.

Then:

1. GitHub → repository **Settings → Secrets and variables → Actions → Variables → New repository variable**:
   name `SITE_INDEXABLE`, value `true`.
2. **Actions → Release → Run workflow** on `main`, and approve the deployment as usual.
3. Check: `https://kasraboutique.ir/robots.txt` shows `Allow: /` and the `Sitemap:` line; the page source of a product
   page contains `<meta name="robots" content="index, follow"/>`.

To close the store again, set the variable to `false` and run the Release workflow again.

## Registering the site in Google Search Console (owner, once)

Only the owner can do this: it needs a Google account and access to the DNS of `kasraboutique.ir` (ParsPack CDN DNS).

1. Open <https://search.google.com/search-console>, sign in, **Add property → Domain**, enter `kasraboutique.ir`.
   A Domain property covers `https://`, `http://` and `www` at once.
2. Google shows a `TXT` record (`google-site-verification=…`). In the ParsPack CDN panel open the domain's **DNS**
   records, add a `TXT` record for `@` with exactly that value, save, then click **Verify** in Search Console (DNS can
   take from minutes to a few hours).
3. After the store is opened (above): **Sitemaps** → enter `sitemap.xml` → **Submit**. The status should become
   *Success* with the number of discovered pages.
4. **URL inspection** → the home page and one product page → **Test live URL** → **Request indexing**.
5. In the following days check **Pages**: only private pages should be *Excluded by 'noindex' tag* or *Blocked by
   robots.txt*. Under **Enhancements → Products / Merchant listings** Google reports problems with product data.

Optional: [Bing Webmaster Tools](https://www.bing.com/webmasters) can import the site from Search Console in one step.
Indexing takes from days to a few weeks; nothing in the store speeds it up beyond the steps above.

## Canonical addresses, product data and link previews

- **Canonical addresses.** The home page, the shop, the categories, every product and the information pages declare
  their own address as canonical (`<link rel="canonical">`, from `pageMetadata` in [`src/lib/seo.ts`](../src/lib/seo.ts)).
  Filtered, sorted or paged lists (`/shop?sort=newest&page=2`) point to the list without them, so search engines
  index one page per list. Private pages have none.
- **Product data.** Every product page carries schema.org `Product` and `Offer` data built from the product it shows
  (API data in production, [`src/lib/structured-data.ts`](../src/lib/structured-data.ts)): name, description, SKU,
  photos, brand, category, colours, sizes, price, availability (in stock while any colour and size has units) and the
  crossed-out price of a discount. Prices are in **rial** (`IRR`): schema.org needs an ISO 4217 currency and the
  toman has none, so the stored toman price is multiplied by 10. Ratings, shipping and return terms are left out until
  the store really has them. Google's [Rich Results Test](https://search.google.com/test/rich-results) shows how a
  product page is read once the site is public.
- **Link previews.** Every main page has Open Graph and Twitter card tags (title, description, address, image). The
  home page card is `public/images/share/kasra-boutique.jpg` (1200×630, made by `scripts/share-images.mts`). A product's
  card is a **JPEG** of its first photo on the studio gray, never the AVIF/WebP photo itself: Telegram, WhatsApp and
  others do not show AVIF, and not all of them show WebP. The API stores `<id>.jpg` next to every uploaded `<id>.webp`
  (and makes it for older uploads the first time it is asked for); demo photos have committed cards in
  `public/images/share/`. Link-preview fetchers (and plain HTTP clients, which the Iranian messengers' fetchers may be)
  receive the tags in `<head>` (`htmlLimitedBots` in `next.config.ts`).

### Checking previews in the messengers (after a deployment)

`tests/share-preview.spec.ts` fetches the pages as the Telegram, WhatsApp and Instagram fetchers and as plain HTTP
clients and checks the tags and the JPEG cards. The apps themselves can only be checked by hand, on the public domain:

1. Send `https://kasraboutique.ir/` and one product link to yourself in **Telegram**, **Bale**, **WhatsApp**, **Eitaa**
   and **Rubika** (and an Instagram direct message). Each preview should show the card, the title and the description.
2. Messengers cache previews. In Telegram, send the link to [@WebpageBot](https://t.me/WebpageBot) to refresh it; in
   the others, add `?v=2` to the link to see the current version.
3. If one of them still shows no picture, note the app and the link and open an issue: the fix is in the tags or the
   card, not in the app.
