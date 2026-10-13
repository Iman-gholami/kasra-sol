import Link from 'next/link';
export default function NotFound() {
  return <div className="container confirmation"><p className="eyebrow" style={{textAlign:'center'}}>404 / NOT FOUND</p><h1>این صفحه پیدا نشد</h1><p>شاید نشانی تغییر کرده. از صفحه اصلی دوباره شروع کن.</p><Link href="/" className="btn btn-dark">بازگشت به خانه</Link></div>;
}
