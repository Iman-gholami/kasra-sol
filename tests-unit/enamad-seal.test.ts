import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EnamadSeal, enamadEnabled } from '@/components/layout/enamad-seal';

describe('eNamad trust seal', () => {
  it('shows only on the production domain', () => {
    assert.equal(enamadEnabled('https://kasraboutique.ir'), true);
    assert.equal(enamadEnabled('https://www.kasraboutique.ir/'), true);
    for (const other of ['http://127.0.0.1:3000', 'https://kasra-astra-demo.vercel.app', 'https://notkasraboutique.ir',
      'https://kasraboutique.ir.example.com', '', undefined]) assert.equal(enamadEnabled(other), false, String(other));
  });

  it('keeps the markup eNamad issued: its link and image, the origin referrer, and no rel', () => {
    // React may also emit an image preload ahead of it, which carries a rel of its own; check the seal itself.
    const markup = renderToStaticMarkup(createElement(EnamadSeal));
    const html = markup.slice(markup.indexOf('<a '));
    const query = '?id=8198877&amp;Code=8Cs5SUjq6iuI0fu3Zd1Atj4qsk529SHa';
    assert.match(html, /^<a [^>]*href="https:\/\/trustseal\.enamad\.ir\/\?id=8198877&amp;Code=8Cs5SUjq6iuI0fu3Zd1Atj4qsk529SHa"/);
    assert.ok(html.includes('src="https://trustseal.enamad.ir/logo.aspx' + query + '"'), html);
    assert.ok(html.includes('code="8Cs5SUjq6iuI0fu3Zd1Atj4qsk529SHa"'), html);
    assert.equal(html.match(/referrerpolicy="origin"/gi)?.length, 2, html);
    assert.match(html, /target="_blank"/);
    // rel="noopener noreferrer" would hide the referrer eNamad checks, and the seal would not show.
    assert.doesNotMatch(html, /\srel=/);
    assert.match(html, /aria-label="نماد اعتماد الکترونیکی کسری بوتیک"/);
  });
});
