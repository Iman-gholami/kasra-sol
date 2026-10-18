'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Clock3, CreditCard, Package, PackageX, RefreshCw, ShoppingBag, TrendingUp, Truck } from 'lucide-react';
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
};
const dayLabel = new Intl.DateTimeFormat('fa-IR', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' });
const shortDate = (date: string) => dayLabel.format(new Date(date + 'T12:00:00Z'));

function Metric({ title, value, hint, icon: Icon, testId, tone = 'neutral' }: {
  title: string; value: string; hint: string; icon: typeof ShoppingBag; testId: string; tone?: 'neutral' | 'warning' | 'danger';
}) {
  return <article data-testid={testId} className="admin-metric" data-tone={tone}>
    <div className="admin-metric-head"><h3>{title}</h3><span aria-hidden="true"><Icon size={19}/></span></div>
    <p className="admin-metric-value">{value}</p>
    <p className="admin-metric-hint">{hint}</p>
  </article>;
}

export function SalesOverview() {
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
              <span className="admin-chart-label">{shortDate(day.date)}</span>
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
