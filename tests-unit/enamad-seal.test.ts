import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ENAMAD_SNIPPET, EnamadSeal, enamadEnabled } from '@/components/layout/enamad-seal';

// The code exactly as eNamad's panel issued it for kasraboutique.ir.
const ISSUED = "<a referrerpolicy='origin' target='_blank' href='https://trustseal.enamad.ir/?id=8198877&Code=8Cs5SUjq6iuI0fu3Zd1Atj4qsk529SHa'><img referrerpolicy='origin' src='https://trustseal.enamad.ir/logo.aspx?id=8198877&Code=8Cs5SUjq6iuI0fu3Zd1Atj4qsk529SHa' alt='' style='cursor:pointer' code='8Cs5SUjq6iuI0fu3Zd1Atj4qsk529SHa'></a>";

describe('eNamad trust seal', () => {
  it('shows only on the production domain', () => {
    assert.equal(enamadEnabled('https://kasraboutique.ir'), true);
    assert.equal(enamadEnabled('https://www.kasraboutique.ir/'), true);
    for (const other of ['http://127.0.0.1:3000', 'https://kasra-astra-demo.vercel.app', 'https://notkasraboutique.ir',
      'https://kasraboutique.ir.example.com', '', undefined]) assert.equal(enamadEnabled(other), false, String(other));
  });

  it('puts the issued code into the page byte for byte', () => {
    assert.equal(ENAMAD_SNIPPET, ISSUED);
    const html = renderToStaticMarkup(createElement(EnamadSeal));
    assert.equal(html, '<div class="footer-enamad">' + ISSUED + '</div>');
    // rel="noopener noreferrer" would hide the referrer eNamad checks, and the seal would not show.
    assert.doesNotMatch(html, /\srel=/);
  });
});
