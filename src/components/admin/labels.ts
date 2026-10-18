export type OrderStatus = 'pending_payment' | 'confirmed_cod' | 'preparing' | 'shipped' | 'delivered' | 'cancelled';
export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: Tone }> = {
  pending_payment: { label: 'در انتظار پرداخت', tone: 'warning' },
  confirmed_cod: { label: 'ثبت‌شده، آماده پردازش', tone: 'info' },
  preparing: { label: 'در حال آماده‌سازی', tone: 'info' },
  shipped: { label: 'ارسال‌شده', tone: 'info' },
  delivered: { label: 'تحویل‌شده', tone: 'success' },
  cancelled: { label: 'لغوشده', tone: 'neutral' }
};
export const statusLabel = (status: string) => ORDER_STATUS[status as OrderStatus]?.label ?? status;
export const statusTone = (status: string): Tone => ORDER_STATUS[status as OrderStatus]?.tone ?? 'neutral';

export const TRANSITION_ACTIONS: Record<string, string> = {
  preparing: 'شروع آماده‌سازی', shipped: 'ثبت ارسال', delivered: 'ثبت تحویل به مشتری', cancelled: 'لغو سفارش'
};
export const PAYMENT_METHOD: Record<string, string> = { cod: 'پرداخت در محل', online: 'پرداخت اینترنتی' };
export const SHIPPING_METHOD: Record<string, string> = { post: 'پست پیشتاز', express: 'ارسال سریع', courier: 'پیک تهران' };

/** No payment is ever verified yet: an online order is unpaid, and a COD collection is not recorded. */
export function paymentState(payment: string, status: string): { label: string; tone: Tone } {
  if (status === 'cancelled') return { label: 'بدون دریافت وجه', tone: 'neutral' };
  if (payment === 'online') return { label: 'پرداخت‌نشده', tone: 'danger' };
  return { label: status === 'delivered' ? 'دریافت وجه ثبت نشده' : 'پرداخت هنگام تحویل', tone: 'warning' };
}

export const PRODUCT_STATUS: Record<string, { label: string; tone: Tone }> = {
  active: { label: 'منتشرشده', tone: 'success' },
  draft: { label: 'پیش‌نویس', tone: 'warning' },
  archived: { label: 'آرشیوشده', tone: 'neutral' }
};
export const CATEGORY: Record<string, string> = { manto: 'مانتو', shomiz: 'شومیز', tshirt: 'تیشرت' };
export const ROLE: Record<string, string> = { owner: 'صاحب فروشگاه', manager: 'مدیر فروشگاه', staff: 'کارمند فروشگاه' };

export const PERMISSION: Record<string, { label: string; hint: string }> = {
  'products:read': { label: 'مشاهده محصولات', hint: 'دیدن فهرست و جزئیات کالاها' },
  'products:write': { label: 'ویرایش و انتشار محصول', hint: 'عنوان، توضیحات، تصاویر، انتشار و آرشیو' },
  'products:price': { label: 'تغییر قیمت', hint: 'قیمت فروش و قیمت قبل از تخفیف' },
  'inventory:read': { label: 'مشاهده موجودی', hint: 'موجودی هر رنگ و سایز' },
  'inventory:write': { label: 'تغییر موجودی', hint: 'ثبت موجودی و تعریف رنگ/سایز' },
  'orders:read': { label: 'مشاهده سفارش‌ها', hint: 'شامل نام، تلفن و نشانی مشتری' },
  'orders:fulfill': { label: 'رسیدگی به سفارش', hint: 'آماده‌سازی، ارسال، تحویل و لغو' },
  'reports:read': { label: 'مشاهده گزارش‌ها', hint: 'داشبورد آمار فروشگاه' }
};

export const AUDIT_ACTION: Record<string, string> = {
  'auth.login': 'ورود به پنل', 'auth.login_failed': 'تلاش ناموفق ورود', 'auth.login_locked': 'ورود به حساب قفل‌شده',
  'auth.logout': 'خروج از پنل', 'auth.password_changed': 'تغییر رمز عبور', 'auth.password_change_failed': 'تلاش ناموفق تغییر رمز',
  'staff.created': 'ایجاد حساب کارمند', 'staff.updated': 'تغییر نقش یا دسترسی کارمند', 'staff.password_reset': 'تعیین رمز جدید برای کارمند',
  'products.created': 'ایجاد محصول', 'products.updated': 'ویرایش محصول', 'products.price': 'تغییر قیمت',
  'products.visibility': 'انتشار یا آرشیو محصول', 'inventory.stock': 'تغییر موجودی', 'orders.status': 'تغییر وضعیت سفارش',
  'media.uploaded': 'آپلود تصویر'
};

const numberFormat = new Intl.NumberFormat('fa-IR');
const dateTimeFormat = new Intl.DateTimeFormat('fa-IR', {
  timeZone: 'Asia/Tehran', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
});
export const formatNumber = (value: number | bigint) => numberFormat.format(value);
export const formatToman = (value: number | string) =>
  numberFormat.format(typeof value === 'string' ? BigInt(value) : value) + ' تومان';
export const formatDateTime = (value: string) => dateTimeFormat.format(new Date(value));
