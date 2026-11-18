'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronLeft, Clock3, CreditCard, FilePen, Package, PackageX, RefreshCw, ScanBarcode, ShoppingBag,
  TrendingUp, Truck } from 'lucide-react';
import type { ProductFilter } from '@/components/admin/admin-dashboard';
import { adminApi, errorMessage } from '@/components/admin/admin-api';
import { formatNumber, formatToman } from '@/components/admin/labels';
import { Loading, Notice } from '@/components/admin/ui';

type Report = {
  timezone: 'Asia/Tehran'; currency: 'IRT'; paymentVerificationAvailable: boolean; note: string;
  period: { calendar: 'persian'; monthStart: string; monthLabel: string };
  orders: { today: number; month: number; monthCancelled: number; pendingOnline: number; pendingOnlineValue: string; codInProgress: number };
  delivered: { todayOrders: number; todayValue: string; monthOrders: number; monthValue: string };
  products: { total: number; active: number; draft: number; archived: number; low_variants: number;
    out_of_stock_variants: number; low_stock_products: number; out_of_stock_products: number };
  trend: { date: string; orders: number; codOrders: number; onlineOrders: number; deliveredOrders: number; deliveredValue: string }[];
  topProducts: { id: string; name: string; units: number; orders: number }[];
  lowStock: { id: string; name: string; colorId: string; colorName: string; size: string; stock: number }[];
  // Counter sales (absent from an API older than this panel).
  store?: { todaySales: number; todayValue: string; monthSales: number; monthValue: string };
};
const dayLabel = new Intl.DateTimeFormat('fa-IR', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' });
const weekday = new Intl.DateTimeFormat('fa-IR', { timeZone: 'UTC', weekday: 'short' });
const dayMonth = new Intl.DateTimeFormat('fa-IR', { timeZone: 'UTC', day: 'numeric', month: 'short' });
const todayLong = new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', weekday: 'long', day: 'numeric', month: 'long' });
const asDay = (date: string) => new Date(date + 'T12:00:00Z');
const shortDate = (date: string) => dayLabel.format(asDay(date));

type Task = { key: string; count: number; text: string; action: string; tone: 'info' | 'warning' | 'danger'; icon: typeof Package;
  run?: () => void };
/** «امروز در یک نگاه»: today's money and orders, and what is waiting for someone, each a click away from where it is done. */
function Today({ report, newOrders, openOrders, openProducts }: {
  report: Report; newOrders: number | null; openOrders?: () => void; openProducts?: (filter: ProductFilter) => void;
}) {
  const tasks = ([
    { key: 'orders', count: newOrders ?? 0, tone: 'info', icon: ShoppingBag, action: 'رسیدگی به سفارش‌ها', run: openOrders,
      text: 'سفارش جدید سایت منتظر آماده‌سازی و ارسال است' },
    { key: 'out', count: report.products.out_of_stock_products, tone: 'danger', icon: PackageX, action: 'نمایش محصولات',
      run: openProducts && (() => openProducts({ stock: 'out' })), text: 'محصول منتشرشده کاملاً تمام شده و در سایت قابل خرید نیست' },
    { key: 'low', count: report.products.low_stock_products, tone: 'warning', icon: AlertTriangle, action: 'نمایش محصولات',
      run: openProducts && (() => openProducts({ stock: 'low' })), text: 'محصول رو به اتمام است (رنگ و سایزی با ۱ تا ۳ عدد)' },
    { key: 'draft', count: report.products.draft, tone: 'info', icon: FilePen, action: 'نمایش پیش‌نویس‌ها',
      run: openProducts && (() => openProducts({ status: 'draft' })), text: 'محصول پیش‌نویس هنوز در فروشگاه منتشر نشده است' }
  ] satisfies Task[]).filter(task => task.count > 0);
  const store = report.store;
  return <section className="admin-panel admin-today" aria-labelledby="today-title" data-testid="today">
    <div className="admin-panel-head"><div>
      <h2 id="today-title">امروز در یک نگاه</h2>
      <p>{todayLong.format(new Date())}</p>
    </div></div>
    <div className="admin-panel-body admin-stack-sm">
      <div className="admin-today-stats">
        {store && <p data-testid="store-today"><ScanBarcode size={18} aria-hidden="true"/><span>فروش حضوری امروز</span>
          <strong>{formatToman(store.todayValue)}</strong><small>{formatNumber(store.todaySales)} فاکتور</small></p>}
        <p><ShoppingBag size={18} aria-hidden="true"/><span>سفارش‌های سایت امروز</span>
          <strong>{formatNumber(report.orders.today)} سفارش</strong>
          <small>{formatNumber(report.trend.at(-1)?.codOrders ?? 0)} پرداخت در محل</small></p>
        {store && <p data-testid="store-month"><TrendingUp size={18} aria-hidden="true"/><span>فروش حضوری {report.period.monthLabel}</span>
          <strong>{formatToman(store.monthValue)}</strong><small>{formatNumber(store.monthSales)} فاکتور</small></p>}
      </div>
      <h3 className="admin-section-title">کارهای در انتظار</h3>
      {tasks.length ? <ul className="admin-tasks">
        {tasks.map(task => <li key={task.key} data-tone={task.tone}>
          <task.icon size={18} aria-hidden="true"/>
          <span><strong>{formatNumber(task.count)}</strong> {task.text}</span>
          {task.run && <button type="button" className="admin-btn admin-btn-outline admin-btn-small" onClick={task.run}>
            {task.action} <ChevronLeft size={14} aria-hidden="true"/></button>}
        </li>)}
      </ul> : <p className="admin-tasks-done"><CheckCircle2 size={18} aria-hidden="true"/> کار عقب‌افتاده‌ای نیست؛ سفارش تازه‌ای منتظر نیست و همه محصولات موجودی دارند.</p>}
    </div>
  </section>;
}

function Metric({ title, value, hint, icon: Icon, testId, tone = 'neutral' }: {
  title: string; value: string; hint: string; icon: typeof ShoppingBag; testId: string; tone?: 'neutral' | 'warning' | 'danger';
}) {
  return <article data-testid={testId} className="admin-metric" data-tone={tone}>
    <div className="admin-metric-head"><h3>{title}</h3><span aria-hidden="true"><Icon size={19}/></span></div>
    <p className="admin-metric-value">{value}</p>
    <p className="admin-metric-hint">{hint}</p>
  </article>;
}

/** `openProduct` (when the account may see products) jumps from a low-stock row to that product in the product list;
 * `openOrders` and `openProducts` open the lists the to-do items point at. `newOrders` is null when orders are hidden. */
export function SalesOverview({ openProduct, openOrders, openProducts, newOrders = null }: {
  openProduct?: (id: string) => void; openOrders?: () => void; openProducts?: (filter: ProductFilter) => void; newOrders?: number | null;
}) {
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    adminApi<Report>('reports/overview', { signal: abort.signal })
      .then(result => { setReport(result); setError(''); })
      .catch(cause => { if (!abort.signal.aborted) setError(errorMessage(cause)); })
      .finally(() => { if (!abort.signal.aborted) setBusy(false); });
    return () => abort.abort();
  }, [version]);

  const maxOrders = Math.max(1, ...(report?.trend ?? []).map(row => row.orders));
  return <div className="admin-stack" data-testid="sales-overview">
    <div className="admin-toolbar">
      <div>
        <h2 className="admin-toolbar-heading">نمای کلی فروشگاه</h2>
        <p className="admin-toolbar-desc">آمار زنده پایگاه داده · روزها به وقت تهران · ماه {report?.period.monthLabel ?? 'جاری'} (تقویم خورشیدی) · تومان</p>
      </div>
      <button type="button" disabled={busy} onClick={() => { setBusy(true); setVersion(n => n + 1); }}
        className="admin-btn admin-btn-outline"><RefreshCw size={16} aria-hidden="true"/> به‌روزرسانی آمار</button>
    </div>
    {error && <Notice tone="error">{error}</Notice>}
    {busy && !report && <Loading label="در حال دریافت آمار فروشگاه…"/>}
    {report && <>
      <Today report={report} newOrders={newOrders} openOrders={openOrders} openProducts={openProducts}/>
      <div className="admin-metrics" aria-busy={busy}>
        <Metric testId="orders-today" icon={ShoppingBag} title="سفارش‌های امروز" value={formatNumber(report.orders.today)}
          hint={'سفارش‌های لغونشده امروز؛ ' + formatNumber(report.trend.at(-1)?.codOrders ?? 0) + ' پرداخت در محل، ' +
            formatNumber(report.trend.at(-1)?.onlineOrders ?? 0) + ' اینترنتی پرداخت‌نشده'}/>
        <Metric testId="orders-month" icon={TrendingUp} title={'سفارش‌های ' + report.period.monthLabel}
          value={formatNumber(report.orders.month)}
          hint={'از ابتدای ماه خورشیدی جاری؛ ' + formatNumber(report.orders.monthCancelled) + ' سفارش لغوشده جدا شمرده شده'}/>
        <Metric testId="cod-in-progress" icon={Truck} title="سفارش‌های پرداخت در محل در جریان"
          value={formatNumber(report.orders.codInProgress)} hint="ثبت‌شده، در حال آماده‌سازی یا ارسال‌شده"/>
        <Metric testId="pending-online" icon={CreditCard} title="سفارش اینترنتی در انتظار پرداخت" tone="warning"
          value={formatNumber(report.orders.pendingOnline)}
          hint={formatToman(report.orders.pendingOnlineValue) + ' پرداخت‌نشده؛ درگاه هنوز متصل نیست و این مبلغ دریافت نشده است'}/>
        <Metric testId="products-active" icon={Package} title="محصولات منتشرشده" value={formatNumber(report.products.active)}
          hint={formatNumber(report.products.draft) + ' پیش‌نویس · ' + formatNumber(report.products.archived) + ' آرشیوشده · ' +
            formatNumber(report.products.total) + ' محصول در کل'}/>
        <Metric testId="low-stock-count" icon={report.products.out_of_stock_products ? PackageX : AlertTriangle}
          tone={report.products.out_of_stock_products ? 'danger' : report.products.low_stock_products ? 'warning' : 'neutral'}
          title="محصولات ناموجود"
          value={formatNumber(report.products.out_of_stock_products)}
          hint={formatNumber(report.products.low_stock_products) + ' محصول دیگر ترکیب کم‌موجود (۱ تا ۳ عدد) دارند · ' +
            formatNumber(report.products.out_of_stock_variants) + ' ترکیب رنگ و سایز ناموجود'}/>
      </div>
      <section className="admin-panel" aria-labelledby="delivered-title">
        <div className="admin-panel-head"><div>
          <h3 id="delivered-title">ارزش سفارش‌های پرداخت در محل تحویل‌شده</h3>
          <p>{report.note}</p>
        </div></div>
        <div className="admin-panel-body admin-split">
          <p data-testid="delivered-today"><span>امروز</span><strong>{formatToman(report.delivered.todayValue)}</strong>
            <small>{formatNumber(report.delivered.todayOrders)} سفارش تحویل‌شده</small></p>
          <p data-testid="delivered-month"><span>{report.period.monthLabel}</span><strong>{formatToman(report.delivered.monthValue)}</strong>
            <small>{formatNumber(report.delivered.monthOrders)} سفارش تحویل‌شده؛ درآمد قطعی نیست</small></p>
        </div>
      </section>
      <section className="admin-panel" aria-labelledby="trend-title">
        <div className="admin-panel-head"><div>
          <h3 id="trend-title">سفارش‌های ۷ روز اخیر</h3>
          <p>تعداد سفارش‌های لغونشده هر روز به وقت تهران؛ جزئیات در جدول زیر نمودار</p>
        </div></div>
        <div className="admin-panel-body">
          <div className="admin-chart" aria-hidden="true">
            {report.trend.map(day => <div key={day.date} className="admin-chart-col">
              <span className="admin-chart-value">{formatNumber(day.orders)}</span>
              <div className="admin-chart-track"><div className="admin-chart-bar"
                style={{ height: day.orders ? Math.max(6, day.orders / maxOrders * 100) + '%' : '0' }}/></div>
              <span className="admin-chart-label"><span>{weekday.format(asDay(day.date))}</span>
                <span>{dayMonth.format(asDay(day.date))}</span></span>
            </div>)}
          </div>
          <div className="admin-table-scroll">
            <table className="admin-table admin-table-compact">
              <caption className="sr-only">سفارش‌ها و تحویل‌های ۷ روز اخیر</caption>
              <thead><tr><th scope="col">روز</th><th scope="col">سفارش</th><th scope="col">پرداخت در محل</th>
                <th scope="col">اینترنتی پرداخت‌نشده</th><th scope="col">تحویل‌شده</th><th scope="col">ارزش تحویل‌شده</th></tr></thead>
              <tbody>{report.trend.map(day => <tr key={day.date}>
                <th scope="row">{shortDate(day.date)}</th><td>{formatNumber(day.orders)}</td><td>{formatNumber(day.codOrders)}</td>
                <td>{formatNumber(day.onlineOrders)}</td><td>{formatNumber(day.deliveredOrders)}</td>
                <td>{formatToman(day.deliveredValue)}</td></tr>)}</tbody>
            </table>
          </div>
          {report.trend.every(day => day.orders === 0) && <p className="admin-empty-inline">در ۷ روز اخیر سفارشی ثبت نشده است.</p>}
        </div>
      </section>
      <div className="admin-two-col">
        <section className="admin-panel" aria-labelledby="top-products-title">
          <div className="admin-panel-head"><div><h3 id="top-products-title">محصولات پرتکرار در سفارش‌ها</h3>
            <p>سفارش‌های پرداخت در محل لغونشده؛ لزوماً تسویه‌شده نیستند.</p></div></div>
          <div className="admin-panel-body">
            {report.topProducts.length === 0 ? <p className="admin-empty-inline">هنوز سفارشی برای رتبه‌بندی ثبت نشده است.</p>
              : <ol className="admin-rank">{report.topProducts.map((item, index) => <li key={item.id}>
                <span className="admin-rank-n">{formatNumber(index + 1)}</span>
                <span className="admin-rank-name"><strong>{item.name}</strong><bdi dir="ltr">{item.id}</bdi></span>
                <span>{formatNumber(item.units)} عدد در {formatNumber(item.orders)} سفارش</span>
              </li>)}</ol>}
          </div>
        </section>
        <section className="admin-panel" aria-labelledby="low-stock-title">
          <div className="admin-panel-head"><div><h3 id="low-stock-title">نیازمند تأمین موجودی</h3>
            <p>۸ ترکیب رنگ و سایز منتشرشده با کمترین موجودی</p></div></div>
          <div className="admin-panel-body">
            {report.lowStock.length === 0 ? <p className="admin-empty-inline">هیچ ترکیب منتشرشده‌ای موجودی ۳ یا کمتر ندارد.</p>
              : <ul className="admin-rank">{report.lowStock.map(item => <li key={item.id + ':' + item.colorId + ':' + item.size}>
                <span className="admin-rank-name"><strong>{item.name}</strong><span>رنگ {item.colorName} · سایز <bdi>{item.size}</bdi></span></span>
                <span className={item.stock === 0 ? 'admin-stock-none' : 'admin-stock-low'}>
                  {item.stock === 0 ? 'ناموجود' : formatNumber(item.stock) + ' عدد'}</span>
                {openProduct && <button type="button" className="admin-btn admin-btn-outline admin-btn-small"
                  onClick={() => openProduct(item.id)} aria-label={'نمایش ' + item.name + ' در فهرست محصولات'}>
                  نمایش</button>}
              </li>)}</ul>}
          </div>
        </section>
      </div>
      <p className="admin-footnote"><Clock3 size={16} aria-hidden="true"/>
        این گزارش هنگام باز کردن یا «به‌روزرسانی آمار» مستقیماً از پایگاه داده خوانده می‌شود و داده ساختگی ندارد.
        تا ثبت و تأیید دریافت وجه پیاده نشده، هیچ عددی در این صفحه درآمد قطعی نیست.</p>
    </>}
  </div>;
}
