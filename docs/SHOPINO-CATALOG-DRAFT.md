# Shopino marketplace: catalog and tracking foundation (draft)

This is **not a complete Shopino integration** and is not the API document to upload to Shopino.
Order intake is not implemented, so no Shopino order can yet be imported or linked to a Kasra order.
In particular, an inbound Shopino order must not be represented as paid until the marketplace's payment
and verification contract is agreed.

## Catalog reads

The following public, read-only endpoints expose published products using the field names in the supplied
Shopino Marketplace API document. Set the existing `NEXT_PUBLIC_SITE_URL` to the store's public origin so
the backend can construct absolute product and image URLs. The existing Compose files pass this value to it.
If the origin is missing or malformed, the endpoints return `503` rather than returning unusable URLs.

- `GET /api/shopino/products?page=1&per_page=50` returns an array. `page` starts at 1; `per_page` is 1–100.
  Request the next page until an empty array is returned.
- `GET /api/shopino/products/{product_id}` returns the same product object or `404` if it is not published.

The list and individual product read current variant IDs, stock, prices, product descriptions and images
from PostgreSQL. Both endpoints send `Cache-Control: no-store`. Prices are integer toman. There is no
separate authentication for these reads, which contain public catalog information; the Shopino document
makes catalog authentication optional. No order or customer information is returned.

The current product model does not associate images with a particular variant, so product images appear in
`images` and each variant has an empty `images` array. A removed and later re-added variant receives a new
ID and must be refreshed by Shopino before ordering it.

## Tracking lookup

`POST /api/shopino/tracking` accepts `{ "order_ids": [12, 13] }` and returns codes in the same order,
e.g. `{ "codes": ["POST123", null] }`. Unknown references and orders without a code return `null`.
This is authenticated with `Authorization: Bearer <token>`; requests fail closed until a distinct
64-character lowercase hexadecimal `SHOPINO_API_TOKEN` is set in the backend environment. Generate it with
`openssl rand -hex 32` and share it with Shopino through a secure channel, never in the repository or URL.

Migration `011_shopino_order_links` additively maps each marketplace order to a numeric Kasra reference and
stores its tracking code. A staff member with `orders:fulfill` can edit the code in a linked order's detail;
the action is audited, and does not assert or change payment state. **The table stays empty until order intake
is implemented**, so this endpoint alone cannot yet complete the Shopino workflow.

## Required before a complete integration

1. Confirm whether Shopino sends an order only after a successful payment, how that payment can be verified,
   and how cancellation, returns and repeated notifications are communicated.
2. Agree with Shopino on the authentication scheme for order and tracking requests and the retry/error contract.
3. Implement authenticated, idempotent order intake and inventory handling, linking each order to a numeric
   reference without treating unverified payments as paid.
4. Test the complete flow against Shopino and create the final API document containing the actual public URLs
   and authentication instructions; give credentials to Shopino through an appropriate secure channel.
