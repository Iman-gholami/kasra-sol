import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { LabelSheet } from '@/components/admin/label-sheet';

export const metadata: Metadata = { title: 'چاپ برچسب بارکد', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';
/** Opened in its own tab from the back office, so the print holds only labels. The API checks the session's
 * permission when the labels load. */
export default async function LabelsPage({ searchParams }: { searchParams: Promise<{ receipt?: string; product?: string }> }) {
  const token = (await cookies()).get('kasra_admin')?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) redirect('/admin/login');
  const { receipt, product } = await searchParams;
  const valid = (value: unknown, pattern: RegExp) => typeof value === 'string' && pattern.test(value) ? value : undefined;
  return <LabelSheet receipt={valid(receipt, /^[1-9]\d{0,15}$/)} product={valid(product, /^[a-z0-9][a-z0-9-]{1,78}$/)}/>;
}
