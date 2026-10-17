'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowUpLeft, Clock3, CreditCard, Package, RefreshCw, ShoppingBag, TrendingUp } from 'lucide-react';

type Report = {
  timezone: 'Asia/Tehran'; currency: 'IRT'; paymentVerificationAvailable: boolean; note: string;
  orders: { today: number; month: number; pendingOnline: number; codInProgress: number };
  delivered: { todayOrders: number; todayValue: string; monthOrders: number; monthValue: string };
  products: { total: number; active: number; archived: number; low_variants: number; out_of_stock_variants: number };
  trend: { date: string; deliveredOrders: number; deliveredValue: string }[];
  topProducts: { id: string; name: string; units: number; orders: number }[];
  lowStock: { id: string; name: string; colorId: string; colorName: string; size: string; stock: number }[];
};
const number = new Intl.NumberFormat('fa-IR');
const digits = (value: number | bigint) => number.format(value);
const money = (value: string) => digits(BigInt(value)) + ' تومان';
const shortDate = (date: string) => new Date(date + 'T12:00:00Z').toLocaleDateString('fa-IR', {
  timeZone: 'UTC', month: 'numeric', day: 'numeric'
});

function Metric({ title, value, hint, icon: Icon, testId }: {
  title: string; value: string; hint: string; icon: typeof ShoppingBag; testId: string;
}) {
  return <article data-testid={testId} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
    <div className="flex items-start justify-between gap-3">
      <p className="text-sm text-neutral-600">{title}</p>
      <span className="rounded-xl bg-neutral-100 p-2 text-neutral-700"><Icon size={19} aria-hidden="true"/></span>
    </div>
    <p className="mt-2 text-xl font-bold tabular-nums sm:text-2xl">{value}</p>
    <p className="mt-2 text-xs leading-6 text-neutral-600">{hint}</p>
  </article>;
}

export function SalesOverview() {
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    async function load() {
      try {
        const response = await fetch('/api/admin/reports/overview', {
          cache: 'no-store', signal: abort.signal
        });
        if (!response.ok) throw new Error(response.status === 403
          ? 'مجوز مشاهده گزارش‌های فروش را ندارید.'
          : response.status === 401 ? 'نشست منقضی شده؛ دوباره وارد شوید.'
            : 'دریافت گزارش ناموفق بود. دوباره امتحان کنید.');
        const result = await response.json() as Report;
        if (!abort.signal.aborted) { setReport(result); setError(''); }
      } catch (cause) {
        if (!abort.signal.aborted) setError(cause instanceof Error ? cause.message : 'خطا در دریافت آمار');
      } finally { if (!abort.signal.aborted) setBusy(false); }
    }
    void load();
    return () => abort.abort();
  }, [version]);

  const maxValue = Math.max(1, ...(report?.trend ?? []).map(row => Number(row.deliveredValue)));
  return <div className="grid gap-5" data-testid="sales-overview">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-2xl font-bold">داشبورد فروشگاه</h2>
        <p className="mt-1 text-sm text-neutral-600">آمار زنده پایگاه داده · منطقه زمانی تهران · تومان</p>
      </div>
      <button type="button" disabled={busy} onClick={() => { setBusy(true); setVersion(n => n + 1); }}
        className="flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm disabled:opacity-50">
        <RefreshCw size={16} aria-hidden="true"/> به‌روزرسانی آمار
      </button>
    </div>
    {error && <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
    {busy && <p role="status" className="rounded-lg border bg-white p-5">در حال دریافت آمار فروشگاه…</p>}
    {!busy && !report && <p>داده‌ای برای نمایش موجود نیست.</p>}
    {report && <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Metric testId="orders-today" icon={ShoppingBag} title="سفارش‌های امروز"
          value={digits(report.orders.today)} hint="همه سفارش‌های ثبت‌شده امروز، با هر وضعیت پرداخت"/>
        <Metric testId="orders-month" icon={TrendingUp} title="سفارش‌های این ماه"
          value={digits(report.orders.month)} hint="تعداد سفارش‌های ثبت‌شده از ابتدای ماه میلادی، به وقت تهران"/>
        <Metric testId="products-active" icon={Package} title="محصولات فعال"
          value={digits(report.products.active)} hint={digits(report.products.total) + ' محصول ثبت‌شده · ' +
            digits(report.products.archived) + ' آرشیوشده'}/>
        <Metric testId="delivered-today" icon={ArrowUpLeft} title="ارزش سفارش‌های تحویل‌شده امروز"
          value={money(report.delivered.todayValue)}
          hint={digits(report.delivered.todayOrders) + ' سفارش پرداخت در محل؛ دریافت وجه تأیید نشده'}/>
        <Metric testId="delivered-month" icon={CreditCard} title="ارزش سفارش‌های تحویل‌شده این ماه"
          value={money(report.delivered.monthValue)}
          hint={digits(report.delivered.monthOrders) + ' سفارش پرداخت در محل؛ درآمد قطعی نیست'}/>
        <Metric testId="low-stock-count" icon={AlertTriangle} title="تنوع‌های کم‌موجودی یا ناموجود"
          value={digits(report.products.low_variants + report.products.out_of_stock_variants)}
          hint={digits(report.products.low_variants) + ' ترکیب با موجودی ۱ تا ۳ · ' +
            digits(report.products.out_of_stock_variants) + ' ترکیب ناموجود'}/>
      </div>
      <section className="rounded-xl border border-amber-200 bg-amber-50 p-4" aria-label="توضیحات وضعیت پرداخت">
        <p className="font-semibold text-amber-950">توجه به وضعیت پرداخت</p>
        <p className="mt-1 text-sm leading-7 text-amber-950">{report.note}</p>
        <p className="mt-1 text-sm text-amber-900">سفارش‌های آنلاین در انتظار پرداخت: {digits(report.orders.pendingOnline)} ·
          سفارش‌های پرداخت در محل در حال انجام: {digits(report.orders.codInProgress)}
        </p>
      </section>
      <section className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-6"
        aria-labelledby="delivery-trend-heading">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 id="delivery-trend-heading" className="text-lg font-bold">روند ارزش سفارش‌های تحویل‌شده، ۷ روز اخیر</h3>
            <p className="mt-1 text-xs leading-6 text-neutral-600">بر اساس تاریخ ثبت وضعیت تحویل، نه تاریخ سفارش؛ درآمد وصول‌شده نیست.</p>
          </div>
          <span className="rounded-lg bg-neutral-100 px-3 py-1 text-xs text-neutral-600">۷ روز به وقت تهران</span>
        </div>
        <div className="mt-6 flex h-56 items-end gap-2 border-b border-neutral-200 pb-1 sm:gap-4"
          role="group" aria-label="نمودار ارزش سفارش‌های تحویل‌شده به تفکیک روز">
          {report.trend.map(day => {
            const value = Number(day.deliveredValue);
            const height = value > 0 ? Math.max(6, value / maxValue * 100) : 0;
            return <div key={day.date} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
              <div className="relative flex h-full w-full items-end justify-center">
                <div role="img"
                  aria-label={shortDate(day.date) + '؛ ' + money(day.deliveredValue) + '، ' +
                    digits(day.deliveredOrders) + ' سفارش'}
                  title={shortDate(day.date) + ' — ' + money(day.deliveredValue)}
                  className="w-full max-w-16 rounded-t-lg bg-neutral-800 transition-[height]"
                  style={{ height: height + '%' }}/>
                {value === 0 && <span aria-hidden="true" className="absolute bottom-0 h-1 w-full max-w-16 rounded bg-neutral-200"/>}
              </div>
              <span className="whitespace-nowrap text-center text-[11px] text-neutral-600">{shortDate(day.date)}</span>
            </div>;
          })}
        </div>
        {report.trend.every(day => day.deliveredOrders === 0) &&
          <p className="mt-4 text-center text-sm text-neutral-500">در ۷ روز اخیر سفارشی با وضعیت تحویل‌شده ثبت نشده است.</p>}
      </section>
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-6" aria-labelledby="top-products-title">
          <h3 id="top-products-title" className="text-lg font-bold">محصولات پرتکرار در سفارش‌ها</h3>
          <p className="mt-1 text-xs leading-6 text-neutral-600">فقط سفارش‌های ثبت‌شده پرداخت در محل؛ لزوماً پرداخت‌شده نیستند.</p>
          {report.topProducts.length === 0
            ? <p className="py-8 text-sm text-neutral-500">هنوز سفارشی برای رتبه‌بندی محصولات ثبت نشده است.</p>
            : <ol className="mt-4 grid gap-3">
              {report.topProducts.map((item, index) => <li key={item.id}
                className="flex items-center justify-between gap-3 rounded-lg bg-neutral-50 p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border bg-white text-sm">
                    {digits(index + 1)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{item.name}</p>
                    <p dir="ltr" className="text-xs text-neutral-500">{item.id}</p>
                  </div>
                </div>
                <span className="shrink-0 text-sm">{digits(item.units)} عدد</span>
              </li>)}
            </ol>}
        </section>
        <section className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-6" aria-labelledby="low-stock-title">
          <h3 id="low-stock-title" className="text-lg font-bold">کالاهای نیازمند تأمین موجودی</h3>
          <p className="mt-1 text-xs text-neutral-600">۸ ترکیب رنگ و سایز با کمترین موجودی</p>
          {report.lowStock.length === 0
            ? <p className="py-8 text-sm text-neutral-500">هیچ تنوع فعالی با موجودی ۳ یا کمتر وجود ندارد.</p>
            : <ul className="mt-4 grid gap-3">
              {report.lowStock.map(item => <li key={item.id + ':' + item.colorId + ':' + item.size}
                className="flex items-center justify-between gap-2 rounded-lg bg-neutral-50 p-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{item.name}</p>
                  <p className="text-xs text-neutral-600">رنگ {item.colorName} · سایز {item.size}</p>
                </div>
                <span className="shrink-0 rounded-lg border border-neutral-200 bg-white px-2 py-1 text-sm">
                  {item.stock === 0 ? 'ناموجود' : digits(item.stock) + ' عدد'}
                </span>
              </li>)}
            </ul>}
        </section>
      </div>
      <p className="flex items-start gap-2 text-sm text-neutral-600">
        <Clock3 size={17} aria-hidden="true" className="mt-1 shrink-0"/>
        این گزارش با هر بار ورود یا فشردن «به‌روزرسانی آمار» از دیتابیس خوانده می‌شود و دادهٔ ساختگی ندارد.
      </p>
    </>}
  </div>;
}
