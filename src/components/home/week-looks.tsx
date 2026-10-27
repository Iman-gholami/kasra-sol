import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Info } from 'lucide-react';
import { weekLooks } from '@/data/week-looks';

// A sixth of the strip from 821px; on phones and tablets about two and a half looks show and the rest scroll in.
const lookSizes = '(max-width: 600px) 44vw, (max-width: 820px) 30vw, (max-width: 1520px) 17vw, 250px';

/** The home page's one bold moment: six studio photos with no gap between them read as one wide shot of a model in a
 * different outfit for each day. The day and the outfit sit under each photo; each look opens the catalog on its
 * category and color. */
export function WeekLooks() {
  return <section className="container wide-editorial week section-block" aria-labelledby="week-title">
    <div className="section-heading">
      <div>
        <h2 id="week-title">یک هفته، شش استایل</h2>
        <p className="week-lede">هر روز یک ترکیب تازه؛ روی هر کدوم بزن تا لباس‌های همون رنگ رو ببینی.</p>
      </div>
      <Link className="text-link" href="/shop">همه لباس‌ها <ArrowLeft size={18} aria-hidden="true"/></Link>
    </div>
    <div className="week-scroll">
      <ol className="week-strip" aria-label="استایل‌های هفته">
        {weekLooks.map(look => <li key={look.day}>
          <Link className="week-look" href={'/shop?category=' + look.category + '&color=' + look.color}>
            <span className="week-figure"><span><Image src={look.image} alt="" fill sizes={lookSizes}/></span></span>
            <span className="week-day">{look.day}</span>
            <span className="week-title">{look.title}</span>
          </Link>
        </li>)}
      </ol>
    </div>
    <p className="demo-photo-note"><Info size={15} aria-hidden="true"/> عکس‌ها نمایشی‌اند و عکس محصولات واقعی فروشگاه نیستند.</p>
  </section>;
}
