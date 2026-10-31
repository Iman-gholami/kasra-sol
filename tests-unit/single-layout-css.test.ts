import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// The storefront has one (phone) design, shown on wide screens as a centred column (docs/MOBILE-ONLY.md). Its
// breakpoints are container queries on <body>, the column; a viewport media query or a vw unit would size things by the
// screen instead and bring a second, desktop layout back. The back office (admin.css) keeps its own full-width layout.
const STYLES = join(import.meta.dirname, '..', 'src', 'styles');
const storefront = readdirSync(STYLES).filter(name => name.endsWith('.css') && name !== 'admin.css')
  .map(name => ({ name, css: readFileSync(join(STYLES, name), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '') }));

describe('one storefront layout', () => {
  it('sizes by the column: container queries, never viewport-width media queries', () => {
    for (const { name, css } of storefront) {
      assert.doesNotMatch(css, /@media[^{]*\b(min|max)-width/, name);
      for (const [, query] of css.matchAll(/@container([^{]*)\{/g)) assert.match(query, /^ kasra \(max-width: \d+px\)\s*$/, name);
    }
  });

  it('uses column units (cqi), not viewport units (vw), for fluid sizes', () => {
    // The one exception: 1% of the column written out for <body> itself, which cannot use its own container units.
    const columnPercent = /min\(1vw, var\(--app-width\) \/ 100\)/g;
    for (const { name, css } of storefront) assert.doesNotMatch(css.replace(columnPercent, ''), /\d(\.\d+)?vw\b/, name);
  });

  it('makes <body> the column: the query container, phone-wide and centred outside the back office', () => {
    const base = storefront.find(file => file.name === 'base.css')!.css;
    assert.match(base, /body \{ container: kasra \/ inline-size; \}/);
    assert.match(base, /html:not\(:has\(\.site-shell\[data-admin\]\)\) body \{\s*max-inline-size: var\(--app-width\); margin-inline: auto;/);
    assert.match(storefront.find(file => file.name === 'tokens.css')!.css, /--app-width: 480px;/);
  });

  it('holds every full-width fixed bar to the column', () => {
    for (const { name, css } of storefront)
      for (const [rule] of css.matchAll(/[^{}]*\{[^{}]*position: fixed;[^{}]*inset-inline: 0;[^{}]*\}/g))
        assert.match(rule, /max-inline-size: 100cqi|inline-size: max-content/, name + ': ' + rule.trim().split('{')[0]);
  });
});
