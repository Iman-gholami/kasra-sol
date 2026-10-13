export default function ProductLoading() {
  return <div className="container detail-loading" role="status" aria-label="در حال آماده‌سازی صفحه محصول">
    <div className="detail-loading-photo" aria-hidden="true"/>
    <div className="detail-loading-info" aria-hidden="true">
      <span className="detail-loading-line short"/>
      <span className="detail-loading-line heading"/>
      <span className="detail-loading-line price"/>
      <span className="detail-loading-line"/>
      <span className="detail-loading-line"/>
      <span className="detail-loading-options"/>
    </div>
  </div>;
}
