// Checks that robots.txt, the robots meta tag of every public page and the sitemap agree with the build's search-engine
// switch (src/lib/seo.ts). Prerendered pages and pages rendered per request once disagreed, so both kinds are checked.
// Usage: node scripts/check-indexing.mjs <base URL of a running storefront> <open|closed> [expected site URL]
const [base, mode, site] = process.argv.slice(2);
if (!base || !['open', 'closed'].includes(mode)) {
  console.error('usage: check-indexing.mjs <base URL> <open|closed> [expected site URL]');
  process.exit(2);
}
const PUBLIC = ['/', '/shop', '/category/manto', '/product/manto-01', '/about', '/faq', '/size-guide'];
const PRIVATE = ['/cart', '/checkout', '/search?q=x', '/wishlist', '/admin/login'];
const failures = [];
const fail = message => failures.push(message);
const text = async path => {
  const response = await fetch(base + path, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' } });
  if (!response.ok) fail(path + ' answered ' + response.status);
  return response.text();
};
const robotsMeta = html => /<meta name="robots" content="([^"]+)"/.exec(html)?.[1] ?? '(none)';

const robots = await text('/robots.txt');
const closed = /^Disallow: \/\s*$/m.test(robots) && !/^Allow:/m.test(robots);
if (mode === 'closed' && !closed) fail('robots.txt should disallow everything:\n' + robots);
if (mode === 'open') {
  if (closed || !/^Allow: \/\s*$/m.test(robots)) fail('robots.txt should allow the store:\n' + robots);
  if (!/^Allow: \/api\/media\/$/m.test(robots)) fail('robots.txt should keep product photos crawlable');
  for (const path of ['/cart', '/checkout', '/admin', '/api/']) if (!robots.includes('Disallow: ' + path)) fail('robots.txt should disallow ' + path);
  const sitemap = /^Sitemap: (\S+)$/m.exec(robots)?.[1];
  if (!sitemap || (site && sitemap !== site + '/sitemap.xml')) fail('robots.txt should point to the sitemap at ' + (site ?? 'the site') + ', not ' + sitemap);
}
for (const path of PUBLIC) {
  const meta = robotsMeta(await text(path));
  if (meta !== (mode === 'open' ? 'index, follow' : 'noindex, nofollow')) fail(path + ' has robots "' + meta + '" in a ' + mode + ' build');
}
for (const path of PRIVATE) {
  const meta = robotsMeta(await text(path));
  if (!meta.startsWith('noindex')) fail(path + ' is private but has robots "' + meta + '"');
}
const locs = [...(await text('/sitemap.xml')).matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
if (locs.length < 10) fail('the sitemap lists only ' + locs.length + ' pages');
if (site && locs.some(loc => !loc.startsWith(site))) fail('the sitemap uses another address than ' + site + ': ' + locs[0]);

if (failures.length) {
  console.error('Search engine switch is inconsistent (' + mode + '):\n- ' + failures.join('\n- '));
  process.exit(1);
}
console.log('robots.txt, ' + (PUBLIC.length + PRIVATE.length) + ' pages and the sitemap (' + locs.length + ' pages) agree: ' + mode);
