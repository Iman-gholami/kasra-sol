/** A calm route fallback: avoid the distracting eight-card loading grid. */
export function CatalogLoadingHint() {
  return <div className="container catalog-loading" role="status" aria-label="در حال آماده‌سازی محصولات">
    <div className="catalog-loading-inner">
      <span className="catalog-loading-icon" aria-hidden="true">K</span>
      <span className="catalog-loading-copy">در حال آماده‌سازی کالکشن…</span>
      <span className="catalog-loading-track" aria-hidden="true"><span/></span>
    </div>
  </div>;
}

export function PageSkeleton() {
  return <div className="container page-skeleton" role="status" aria-label="در حال بارگذاری صفحه">
    <span className="skeleton" aria-hidden="true"/><span className="skeleton" aria-hidden="true"/><span className="skeleton" aria-hidden="true"/>
  </div>;
}
