import Link from 'next/link';
import { Check, ChevronRight, MapPin, ShoppingBag, Wallet } from 'lucide-react';

/** Phone-only header of the purchase flow (hidden from 821px, where the site header stays): back one step,
 * and the wordmark as the way home. Named by its text, not an aria-label, so the label matches what shows. */
export function FlowHeader({ back, backLabel }: { back: string; backLabel: string }) {
  return <div className="flow-header">
    <Link href={back} className="icon-button flow-back" aria-label={backLabel}><ChevronRight size={24} aria-hidden="true"/></Link>
    <Link href="/" className="flow-logo">
      <span className="flow-logo-mark" aria-hidden="true">K</span>
      <span dir="ltr">KASRA</span>
      <span className="sr-only">کسری بوتیک، صفحه اصلی</span>
    </Link>
  </div>;
}

const STEPS = [
  { label: 'سبد خرید', href: '/cart', Icon: ShoppingBag },
  { label: 'اطلاعات ارسال', href: '/checkout', Icon: MapPin },
  { label: 'اطلاعات پرداخت', href: '', Icon: Wallet }
];

/** Three icon steps joined by dashed connectors; finished steps link back. */
export function FlowSteps({ current }: { current: 1 | 2 | 3 }) {
  return <ol className="flow-steps" aria-label="مراحل خرید">
    {STEPS.map(({ label, href, Icon }, index) => {
      const state = index + 1 < current ? 'done' : index + 1 === current ? 'current' : 'next';
      const body = <>
        <span className="flow-step-icon" aria-hidden="true">
          <Icon size={22} strokeWidth={1.7}/>
          {state === 'done' && <span className="flow-step-check"><Check size={11} strokeWidth={3.5}/></span>}
        </span>
        <span className="flow-step-label">{label}{state === 'done' && <span className="sr-only"> (انجام شد)</span>}</span>
      </>;
      return <li key={label} data-state={state} aria-current={state === 'current' ? 'step' : undefined}>
        {state === 'done' && href ? <Link href={href} className="flow-step-body">{body}</Link> : <span className="flow-step-body">{body}</span>}
      </li>;
    })}
  </ol>;
}
