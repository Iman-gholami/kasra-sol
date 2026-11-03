import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Every overlay is a native <dialog> (src/components/ui/sheet.tsx). Safari 18–26 transitions `display` on a dialog but
// has no `overlay` property, and that combination broke the sheets on iPhones: the dialog opened unseen, the page froze
// under it and the next tap closed it. WebKit later turned the transition off for dialogs (Safari 27), so the WebKit
// test in CI cannot see the problem; this test keeps the pattern out of the stylesheets instead.
const STYLES = join(import.meta.dirname, '..', 'src', 'styles');
const sheets = readdirSync(STYLES).filter(name => name.endsWith('.css'))
  .map(name => ({ name, css: readFileSync(join(STYLES, name), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '') }));

const CHROME_ONLY = '@supports (overlay: auto) {';

/** The stylesheet without its `@supports (overlay: auto)` blocks, and the blocks themselves. */
function splitChromeOnly(css: string) {
  let rest = '';
  const blocks: string[] = [];
  let from = 0;
  for (let start = css.indexOf(CHROME_ONLY); start !== -1; start = css.indexOf(CHROME_ONLY, from)) {
    rest += css.slice(from, start);
    let depth = 0;
    let end = start + CHROME_ONLY.length - 1;
    for (; end < css.length; end++) {
      if (css[end] === '{') depth++;
      else if (css[end] === '}' && --depth === 0) break;
    }
    blocks.push(css.slice(start, end + 1));
    from = end + 1;
  }
  return { rest: rest + css.slice(from), blocks };
}

describe('sheet motion', () => {
  it('transitions display or overlay only where the browser has overlay', () => {
    for (const { name, css } of sheets) {
      const { rest } = splitChromeOnly(css);
      for (const [declaration] of rest.matchAll(/transition(-property)?\s*:[^;}]*/g))
        assert.doesNotMatch(declaration, /\b(display|overlay)\b/, name + ': ' + declaration.trim());
    }
  });

  it('keeps the exit motion for browsers with overlay', () => {
    const { blocks } = splitChromeOnly(sheets.find(file => file.name === 'primitives.css')!.css);
    const chrome = blocks.join('\n');
    assert.match(chrome, /\.sheet \{ transition-property: transform, opacity, overlay, display; transition-behavior: allow-discrete; \}/);
    assert.match(chrome, /\.sheet::backdrop \{ transition-property: opacity, overlay, display; transition-behavior: allow-discrete; \}/);
  });

  it('still slides a sheet in from its starting style', () => {
    const css = sheets.find(file => file.name === 'primitives.css')!.css;
    assert.match(css, /@starting-style \{ \.sheet\[open\]::backdrop \{ opacity: 0; \} \}/);
    assert.match(css, /@starting-style \{ \.sheet-bottom\[open\] \{ transform: translateY\(100%\); \} \}/);
  });
});
