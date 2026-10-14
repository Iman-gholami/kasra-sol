/** Route skeletons that mirror the real layout so streaming in the page does not shift anything. */
export function CatalogSkeleton() {
  return <div className="container catalog-layout" role="status" aria-label="در حال بارگذاری محصولات">
    <div className="catalog-skeleton-head" aria-hidden="true"><span className="skeleton"/><span className="skeleton"/></div>
    <div className="catalog-body" aria-hidden="true">
      <div className="filters-panel filters-skeleton">{[0, 1, 2, 3].map(i => <span key={i} className="skeleton"/>)}</div>
      <div className="catalog-results">
        <span className="skeleton catalog-toolbar-skeleton"/>
        <div className="product-grid">
          {Array.from({ length: 8 }, (_, i) => <div key={i} className="product-card-skeleton">
            <span className="skeleton"/><span className="skeleton"/><span className="skeleton"/>
          </div>)}
        </div>
      </div>
    </div>
  </div>;
}

export function PageSkeleton() {
  return <div className="container page-skeleton" role="status" aria-label="در حال بارگذاری صفحه">
    <span className="skeleton" aria-hidden="true"/><span className="skeleton" aria-hidden="true"/><span className="skeleton" aria-hidden="true"/>
  </div>;
}
