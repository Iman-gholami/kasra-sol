import type { Metadata } from 'next';
import { DemoAdminDashboard } from '@/components/admin/demo-admin-dashboard';
import '@/styles/admin-demo.css';

export const metadata: Metadata = {
  title: 'پنل مدیریت نمایشی | کسری بوتیک',
  description: 'نمایش آزمایشی پنل مدیریت با اطلاعات غیرواقعی و بدون اتصال به دیتابیس',
  robots: { index: false, follow: false }
};

export default function AdminDemoPage() {
  return <DemoAdminDashboard/>;
}
