# Cart & Checkout 10.0 — add to cart, cart, two-step checkout, simulated payment

V10 redesigns the purchase flow from the moment a shopper adds an item to the confirmation page.
Everything stays demo-only: no order, payment, card data or address leaves the browser. The site-wide
announcement bar remains the place that says so, instead of a disclaimer in every block.

## Problems found in V9

| Area | Problem | Effect |
| --- | --- | --- |
| Whole flow | "نمایشی" repeated about eight times, including inside CTAs ("ادامه تا تسویه‌حساب نمایشی") and a mandatory "می‌دانم این سفارش واقعی نیست" checkbox | Noise, an extra required step, and a flow that could not be evaluated as a real purchase |
| Add to cart | A small text line and two links; no image, cart total or next step | Weak confirmation; shoppers re-check the header badge |
| Add to cart | Adding a variant already fully in the cart reported success while nothing was added | Wrong feedback |
| Cart | "صرفه‌جویی نمونه" shown next to a total it was not subtracted from; shipping "هنوز محاسبه نشده" | Totals hard to read |
| Checkout | No shipping method, payment method or discount code; total never final; step 3 was "پایان آزمایش" | The core decisions of a purchase could not be designed or tested |
| Confirmation | No order summary, address, tracking code or next steps | No reassurance at the end |

## Decisions

1. **Realistic but simulated.** Shipping methods, payment methods, discount codes and a payment gateway
   all exist with sample rules (`src/lib/checkout.ts`). The gateway asks for no card data: the tester
   picks the outcome, so the success *and* the failure path can be designed and checked.
2. **Add-to-cart confirmation sheet** replaces the quick-cart drawer as the post-add surface. Bottom
   sheet on phones, a panel under the header cart icon on larger screens (see *Mobile flow 10.1* for its
   current content). Its state lives in `ShopProvider` (`showAdded`/`dismissAdded`) and the layout renders
   it, so any future add surface (e.g. quick add on cards) can reuse it. The drawer had no other entry
   point and was removed.
3. **Cart + two-step checkout** read as three steps: ۱ سبد خرید → ۲ اطلاعات ارسال (address + shipping
   method) → ۳ اطلاعات پرداخت (review, payment method). The checkout step is in the URL
   (`/checkout?step=payment`), so browser Back goes back one step. A payment URL without a complete
   address falls back to step one.
4. **Draft survives refresh** in `sessionStorage` only (this tab, cleared on completion or when the tab
   closes). The form says so: «اطلاعاتت فقط در همین تب مرورگر نگه داشته می‌شود…».

## What changed, by screen

### Product page
- After adding: the confirmation sheet opens; focus returns to the add button when it closes.
- Stock-aware: the quantity stepper and the add button account for what the cart already holds; the
  note reads «موجودی نمونه: ۳ عدد، ۱ عدد در سبد خریدت». When everything is in the cart the button says
  «همه موجودی در سبد خریدت» and explains instead of reporting a false success.

### Cart
- Free-shipping meter (sentence carries the meaning, the bar is decoration).
- Summary: «قیمت کالاها (n)», «سود تو از تخفیف کالاها» (green, no minus sign — bidi can move it to
  the wrong side of Persian digits), «هزینه ارسال: از ۸۵٬۰۰۰ تومان، در مرحله بعد» or «رایگان با پست
  پیشتاز», «جمع سبد خرید», CTA «ادامه فرایند خرید» (see *Mobile flow 10.1* for the layout and the inline discount code).
- Calm stock notes: «از این رنگ و سایز ۳ عدد موجود است», «همه موجودی این رنگ و سایز در سبد توست».
- «ذخیره برای بعد» moves a line to the wishlist, with the same in-place undo as removal.

### Checkout — step 1, ارسال
- Address fields unchanged in behaviour (inline validation, Persian digits, error summary); the
  optional courier note is behind «افزودن توضیح برای مأمور ارسال» to keep the form short.
- Shipping method radio cards, cheapest preselected:

  | Method | Price (toman) | ETA | Rule |
  | --- | --- | --- | --- |
  | پست پیشتاز | 85,000 — free from 2,500,000 | ۳ تا ۵ روز کاری | — |
  | ارسال سریع | 145,000 | ۱ تا ۲ روز کاری | — |
  | پیک همان‌روز | 120,000 | امروز، برای سفارش تا ساعت ۱۶ | Tehran city only |

  Unavailable methods stay visible, disabled, with their reason. If an address change makes the chosen
  method unavailable, it switches to پست پیشتاز and says so.

### Checkout — step 2, پرداخت
- Review rows for address and method with «ویرایش» / «تغییر» (the latter lands on the method list).
- Payment: «پرداخت اینترنتی» or «پرداخت در محل» (only with the courier; otherwise disabled with reason).
- An applied discount code (entered in the cart) is confirmed above the pay button and itemised in the
  summary.
- The pay button carries the amount: «پرداخت ۶۱۵٬۱۰۰ تومان»; with pay-on-delivery «ثبت نهایی سفارش».
- Gateway dialog: merchant, amount, a note that no card data is collected, and two outcomes.
  Failure → «پرداخت انجام نشد. سبد خریدت محفوظ است…» (alert, next to the pay button, focus back on it).
  Cancel (close/Escape) → neutral «پرداخت را لغو کردی…».

### Confirmation
- «پرداخت آزمایشی موفق بود» / «سفارش آزمایشی ثبت شد», a demo tracking code, a four-step timeline,
  address and method with ETA, payment and price breakdown, items with thumbnails. It still states that
  no real order or payment happened. A direct visit without an order shows the previous generic page.
  The order is replaced into history, so Back does not return to the payment step.

## Mobile flow 10.1 — modelled on benedito.ir, in Kasra's style

The phone flow follows the interaction pattern of benedito.ir (from the shopper's screenshots), with
Kasra's colours, Estedad, shapes and voice.

- **Added-to-cart sheet**: a success badge (bag + check on `success-wash`), a warm kicker «انتخاب قشنگیه!»,
  the title «به سبد خرید اضافه شد», a small card with the added variant, then two stacked full-width
  buttons — «ادامه خرید» (outlined, focused) above «مشاهده سبد خرید» (primary, in the thumb zone).
- **Focused flow chrome** on `/cart` and `/checkout` (≤ 820 px): the site header and footer give way to a
  back button (one step back: shop ← cart ← shipping ← payment) and the centred KASRA wordmark. The
  announcement bar stays, so the demo statement is still visible. `SiteShell` sets `data-flow` from the
  pathname during the server render, so nothing swaps after hydration. Desktop keeps the site header.
- **Icon stepper** on all three steps (سبد خرید · اطلاعات ارسال · اطلاعات پرداخت) joined by dashed
  connectors; the current step uses the accent on `accent-wash`, finished steps get a check and link back.
- **Cart as step 1**: free-shipping sentence over a thick bar at the top; compact lines (unit price with the
  struck-through original, «تعداد:» with square 44 px stepper buttons, save-for-later and red delete
  icons); the **discount code inline in the cart** (field + «ثبت کد», sample codes `KASRA10` and
  `WELCOME`, stored in the checkout draft so checkout uses it); a rounded summary card; the large
  «ادامه فرایند خرید» button; and a calm note that adding to the cart does not reserve stock.
  The floating total-and-action bar appears only while that large button is off-screen.
- On phones the cart and checkout sit in one white card (`radius-lg`, `shadow-2`) on a soft accent tint.

Deviations from the reference, on purpose: touch targets stay at 44 px (the reference's stepper buttons
are smaller), the sheet keeps a close button and Escape for keyboard and screen-reader users, the page
`h1` stays in the document (visually hidden on phones), and colours come from Kasra's tokens (dark primary
buttons, rose-brown accent) rather than the reference's pink.

## Files

| File | Role |
| --- | --- |
| `src/lib/checkout.ts` | Sample rules: shipping/payment methods and restrictions, free-shipping threshold, discount codes, totals |
| `src/components/checkout/checkout-storage.ts` | sessionStorage draft and last demo order (`useLastOrder`) |
| `src/components/checkout/checkout-page.tsx` | Step routing, progress, summary, completion |
| `src/components/checkout/shipping-step.tsx`, `payment-step.tsx` | The two steps, discount field, gateway dialog |
| `src/components/checkout/fields.tsx` | Text/select fields, validation, `ChoiceCard` radio card |
| `src/components/checkout/order-summary.tsx` | Summary lines and price rows shared by cart, checkout and confirmation |
| `src/components/checkout/order-confirmation.tsx` | Confirmation page |
| `src/components/cart/added-to-cart.tsx`, `free-shipping-meter.tsx` | Post-add sheet, meter |
| `src/components/checkout/flow-chrome.tsx`, `discount-field.tsx` | Phone flow header, icon stepper, inline discount field |
| `src/components/layout/site-shell.tsx` | Marks `/cart` and `/checkout` as the purchase flow (`data-flow`) |

## Accessibility

- Radio cards: the whole card is the hit area; the radio is named by title (+ price) and described by
  the detail and, when disabled, the reason.
- Step changes move focus to the new step's heading (or the anchored method list).
- Errors and payment outcomes use `role="alert"`; neutral outcomes `role="status"`.
- `tests/checkout.spec.ts` runs axe on the cart, both steps (with errors), the gateway, the
  confirmation and the added sheet at 1440 and 390. It excludes `.brand`, `.footer-wordmark` and
  `.bottom-nav`, which already fail axe-core 4.14's `label-content-name-mismatch` rule before this
  change (the same failure makes the three route/overlay tests in `a11y.spec.ts` fail).

## Before a real launch

Shipping prices, ETAs, the free-shipping threshold, codes and totals must come from the backend; the
gateway must be a real PSP redirect with server-side verification and an idempotent order endpoint.
`src/lib/checkout.ts` is the adapter boundary to replace.
