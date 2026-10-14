export default function ProductLoading() {
  return <div className="container" role="status" aria-label="در حال آماده‌سازی صفحه محصول">
    <div className="detail-loading" aria-hidden="true">
      <span className="skeleton detail-loading-photo"/>
      <div className="detail-loading-info">
        <span className="skeleton detail-loading-line short"/>
        <span className="skeleton detail-loading-line heading"/>
        <span className="skeleton detail-loading-line price"/>
        <span className="skeleton detail-loading-options"/>
        <span className="skeleton detail-loading-cta"/>
      </div>
    </div>
  </div>;
}
