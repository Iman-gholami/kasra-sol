/** eNamad trust seal for kasraboutique.ir, exactly as eNamad's panel issued it. eNamad asks for the code unchanged,
 * and its checker may look for this very text in the page, so it is inserted verbatim (single quotes, raw &,
 * no rel: eNamad verifies the seal through the referrer, and rel="noopener noreferrer" would hide it). */
export const ENAMAD_SNIPPET = "<a referrerpolicy='origin' target='_blank' href='https://trustseal.enamad.ir/?id=8198877&Code=8Cs5SUjq6iuI0fu3Zd1Atj4qsk529SHa'><img referrerpolicy='origin' src='https://trustseal.enamad.ir/logo.aspx?id=8198877&Code=8Cs5SUjq6iuI0fu3Zd1Atj4qsk529SHa' alt='' style='cursor:pointer' code='8Cs5SUjq6iuI0fu3Zd1Atj4qsk529SHa'></a>";

/** Only the production domain shows the seal: elsewhere (local builds, CI, previews) it would be an invalid seal
 * and a third-party image in every page. */
export function enamadEnabled(siteUrl = process.env.NEXT_PUBLIC_SITE_URL) {
  try { return /(^|\.)kasraboutique\.ir$/.test(new URL(siteUrl ?? '').hostname); } catch { return false; }
}

export function EnamadSeal() {
  return <div className="footer-enamad" dangerouslySetInnerHTML={{ __html: ENAMAD_SNIPPET }}/>;
}
