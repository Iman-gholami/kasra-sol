'use client';

/** Persian messages for the API's machine-readable error codes. */
const MESSAGES: Record<string, string> = {
  unauthorized: 'نشست شما منقضی شده است؛ دوباره وارد شوید.',
  forbidden: 'مجوز انجام این کار را ندارید.',
  forbidden_origin: 'درخواست از نشانی نامعتبر رد شد؛ صفحه را تازه کنید.',
  rate_limited: 'درخواست‌ها بیش از حد مجاز است؛ یک دقیقه صبر کنید و دوباره تلاش کنید.',
  backend_unavailable: 'ارتباط با سرور برقرار نشد؛ اتصال را بررسی و دوباره تلاش کنید.',
  backend_not_configured: 'اتصال پنل به سرور تنظیم نشده است.',
  payload_too_large: 'حجم اطلاعات ارسالی بیش از حد مجاز است.',
  not_found: 'مورد موردنظر پیدا نشد؛ شاید حذف یا جابه‌جا شده باشد.',
  invalid_payload: 'اطلاعات واردشده کامل یا معتبر نیست.',
  invalid_query: 'فیلترهای جست‌وجو معتبر نیستند.',
  invalid_product: 'برخی از اطلاعات محصول معتبر نیست؛ موارد مشخص‌شده را اصلاح کنید.',
  product_exists: 'شناسه یا آدرس (slug) این محصول قبلاً استفاده شده است.',
  variant_reserved_by_order: 'این رنگ و سایز در سفارش پرداخت در محلِ باز استفاده شده است؛ پیش از حذف آن، سفارش را تعیین تکلیف کنید.',
  restock_variant_missing: 'رنگ یا سایز یکی از اقلام سفارش حذف شده است. لغو انجام نشد؛ ابتدا همان رنگ و سایز را در محصول بازگردانید.',
  product_changed_reload_required: 'مشخصات یا موجودی این محصول از زمان باز کردن فرم تغییر کرده است (مثلاً سفارش تازه). آخرین نسخه را بارگذاری کنید و تغییرات را دوباره اعمال کنید.',
  precondition_required: 'نسخه محصول مشخص نیست؛ فرم را دوباره باز کنید.',
  image_required_to_publish: 'محصول منتشرشده باید دست‌کم یک تصویر داشته باشد؛ برای حذف همه تصاویر، ابتدا آن را آرشیو کنید.',
  price_required_to_publish: 'محصول منتشرشده باید قیمت فروش بیشتر از صفر داشته باشد.',
  price_above_original: 'قیمت فروش نمی‌تواند از «قیمت قبل از تخفیف» بیشتر باشد.',
  stock_changed: 'موجودی این ترکیب در این فاصله تغییر کرده است (احتمالاً سفارش تازه). مقدار جدید نمایش داده شد؛ بررسی و دوباره ثبت کنید.',
  invalid_order_transition: 'وضعیت این سفارش در این فاصله تغییر کرده یا این تغییر مجاز نیست؛ اطلاعات تازه شد.',
  username_taken: 'این نام کاربری قبلاً استفاده شده است.',
  invalid_role: 'نام نقش و مجوزهای انتخاب‌شده را بررسی کنید.',
  role_name_taken: 'نقشی با این نام قبلاً ساخته شده است.',
  role_not_found: 'این نقش دیگر وجود ندارد؛ فهرست را تازه‌سازی کنید.',
  role_in_use: 'این نقش به حساب‌هایی اختصاص داده شده است؛ ابتدا نقش آن حساب‌ها را تغییر دهید.',
  cannot_modify_self: 'دسترسی حساب خودتان را از این بخش نمی‌توانید تغییر دهید.',
  cannot_modify_owner: 'حساب صاحب فروشگاه از این بخش قابل تغییر نیست.',
  use_own_password_change: 'رمز حساب خودتان را از بخش «حساب من» تغییر دهید.',
  invalid_current_password: 'رمز عبور فعلی درست نیست.',
  password_unchanged: 'رمز جدید باید با رمز فعلی متفاوت باشد.',
  invalid_image: 'فایل یک تصویر واقعی JPG، PNG یا WebP نیست.',
  invalid_image_type: 'فقط تصویر JPG، PNG یا WebP پذیرفته می‌شود.',
  unsupported_media_type: 'فقط تصویر JPG، PNG یا WebP پذیرفته می‌شود.',
  image_too_large: 'حجم هر تصویر باید حداکثر ۲ مگابایت باشد.',
  slide_unavailable: 'یکی از محصولات انتخاب‌شده منتشر نیست یا آرشیو شده است؛ آن را از اسلایدر بردارید و دوباره ذخیره کنید.',
  export_too_large: 'تعداد سفارش‌ها برای یک فایل بیش از ۵۰۰۰ است؛ بازه زمانی یا وضعیت را محدودتر کنید.'
};

export class AdminApiError extends Error {
  constructor(readonly status: number, readonly code: string, readonly data: Record<string, unknown>) {
    super(MESSAGES[code] ?? (status === 403 ? MESSAGES.forbidden : status === 401 ? MESSAGES.unauthorized
      : status === 413 ? MESSAGES.payload_too_large : status === 429 ? MESSAGES.rate_limited
        : 'عملیات انجام نشد (کد ' + status + '). دوباره تلاش کنید.'));
  }
}

/** Message for any thrown value, for showing in an alert. */
export const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'خطای ناشناخته رخ داد.';

async function request(path: string, init: {
  method?: string; body?: unknown; headers?: Record<string, string>; signal?: AbortSignal;
}) {
  let response: Response;
  try {
    response = await fetch('/api/admin/' + path, {
      method: init.method ?? 'GET', cache: 'no-store', signal: init.signal,
      headers: { ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }), ...init.headers },
      body: init.body === undefined ? undefined : JSON.stringify(init.body)
    });
  } catch (error) {
    if (init.signal?.aborted) throw error;
    throw new AdminApiError(0, 'backend_unavailable', {});
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (response.status === 401 && typeof window !== 'undefined')
      window.dispatchEvent(new CustomEvent('kasra-admin-unauthorized'));
    throw new AdminApiError(response.status, typeof data.error === 'string' ? data.error : '', data);
  }
  return response;
}

/** Calls the same-origin admin proxy (`/api/admin/*`), which attaches the HttpOnly session cookie. */
export async function adminApi<T>(path: string, init: {
  method?: string; body?: unknown; headers?: Record<string, string>; signal?: AbortSignal;
} = {}): Promise<T> {
  const response = await request(path, init);
  return await response.json().catch(() => ({})) as T;
}

/** Saves a file answered by the admin proxy (e.g. the orders CSV) under the name the server suggests. */
export async function adminDownload(path: string, fallbackName: string) {
  const response = await request(path, {});
  const name = /filename="([^"]+)"/.exec(response.headers.get('content-disposition') ?? '')?.[1] ?? fallbackName;
  const url = URL.createObjectURL(await response.blob());
  const link = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
