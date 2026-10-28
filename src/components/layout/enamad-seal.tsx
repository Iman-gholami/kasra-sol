/** eNamad trust seal, issued for kasraboutique.ir and kept as eNamad hands it out. eNamad checks the page's origin
 * through the referrer, so the link must not carry rel="noopener noreferrer" (the seal then stops showing). */
const ID = '8198877';
const CODE = '8Cs5SUjq6iuI0fu3Zd1Atj4qsk529SHa';
const QUERY = '?id=' + ID + '&Code=' + CODE;

/** Only the production domain shows the seal: elsewhere (local builds, CI, previews) it would be an invalid seal
 * and a third-party image in every page. */
export function enamadEnabled(siteUrl = process.env.NEXT_PUBLIC_SITE_URL) {
  try { return /(^|\.)kasraboutique\.ir$/.test(new URL(siteUrl ?? '').hostname); } catch { return false; }
}

export function EnamadSeal() {
  return (
    // No rel on purpose: eNamad verifies the seal through the referrer.
    <a className="footer-enamad" referrerPolicy="origin" target="_blank" href={'https://trustseal.enamad.ir/' + QUERY}
      aria-label="نماد اعتماد الکترونیکی کسری بوتیک">
      {/* eslint-disable-next-line @next/next/no-img-element -- eNamad's own image, served by eNamad as issued. */}
      <img referrerPolicy="origin" src={'https://trustseal.enamad.ir/logo.aspx' + QUERY} alt="" style={{ cursor: 'pointer' }}
        {...{ code: CODE }}/>
    </a>
  );
}
