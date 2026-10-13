/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS CLI needs project-relative Playwright resolution. */
/* A small, dependency-free (apart from the project's existing Playwright) synthetic browser check.
 * Same script runs against the pinned V3 and the V4 production builds in GitHub Actions.
 * Measurements are unthrottled, single-run lab observations, NOT Lighthouse/RUM/Core Web Vitals certification. */
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const requireFromProject = createRequire(path.join(process.cwd(), 'package.json'));
const { chromium } = requireFromProject('@playwright/test');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:3000';
const filename = process.env.OUTPUT_FILE || 'artifacts/screenshots/lab-metrics.json';
const routes = [['home','/'],['catalog','/shop'],['product','/product/shomiz-01']];

async function collect(page, route) {
  await page.addInitScript(() => {
    const state = { lcpMs: 0, cls: 0 };
    window.__kasraLab = state;
    try {
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) state.lcpMs = entry.startTime;
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    } catch { /* Unsupported API: recorded as null */ }
    try {
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) state.cls += entry.value;
        }
      }).observe({ type: 'layout-shift', buffered: true });
    } catch { /* Unsupported API: recorded as null */ }
  });
  await page.goto(baseURL + route, {waitUntil:'networkidle'});
  await page.waitForTimeout(300);
  return page.evaluate(() => {
    const paint = performance.getEntriesByName('first-contentful-paint')[0];
    const navigation = performance.getEntriesByType('navigation')[0];
    const resources = performance.getEntriesByType('resource');
    const total = selector => resources.filter(selector).reduce((sum, item) => sum + (item.transferSize || 0), 0);
    const state = window.__kasraLab || { lcpMs:0, cls:0 };
    return {
      fcpMs: paint ? Math.round(paint.startTime) : null,
      lcpMs: state.lcpMs ? Math.round(state.lcpMs) : null,
      cls: Math.round(state.cls * 10000) / 10000,
      domContentLoadedMs: navigation ? Math.round(navigation.domContentLoadedEventEnd) : null,
      resourceTransferBytes: total(() => true),
      scriptTransferBytes: total(entry => entry.initiatorType === 'script'),
      imageTransferBytes: total(entry => entry.initiatorType === 'img'),
      resourceCount: resources.length,
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  });
}
(async () => {
  const browser = await chromium.launch({headless:true});
  const results = [];
  try {
    for (const width of [390, 1440]) {
      for (const [name, route] of routes) {
        const page = await browser.newPage({viewport:{width,height:width===390?844:900},deviceScaleFactor:1});
        try {
          const metrics = await collect(page, route);
          results.push({width, page:name, route, ...metrics});
        } finally { await page.close(); }
      }
    }
  } finally { await browser.close(); }
  fs.mkdirSync(path.dirname(filename), {recursive:true});
  fs.writeFileSync(filename, JSON.stringify({
    method:'Single-run, unthrottled Chromium on Ubuntu GitHub Actions; no Lighthouse/RUM percentile',
    timestamp:new Date().toISOString(), baseURL, results
  }, null, 2));
  console.log(JSON.stringify(results, null, 2));
})().catch(error => { console.error(error); process.exitCode=1; });
