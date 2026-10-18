import { expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const API = 'http://127.0.0.1:4000';
// Outside test-results/, which CI uploads as an artifact on failure: these are (throwaway) credentials.
export const ACCOUNTS_FILE = join(tmpdir(), 'kasra-admin-e2e-accounts.json');
export type Account = { username: string; password: string };
export type Accounts = { owner: Account; manager: Account; staff: Account };
export const accounts = (): Accounts => JSON.parse(readFileSync(ACCOUNTS_FILE, 'utf8')) as Accounts;
export const SCREENSHOTS = join('artifacts', 'screenshots');

let visitor = 0;
/** Each signed-in page acts as its own visitor address (as Nginx would report it), so per-address login
 * and API rate limits apply per test like they would per employee, instead of to the whole suite. */
export const visitorAddress = () => '10.220.' + Math.floor(++visitor / 250) + '.' + (visitor % 250 + 1);

export async function signIn(page: Page, account: Account) {
  await page.setExtraHTTPHeaders({ 'X-Forwarded-For': visitorAddress() });
  await page.goto('/admin/login');
  await page.getByLabel('نام کاربری').fill(account.username);
  await page.getByLabel('رمز عبور', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: /ورود به پنل مدیریت/ }).click();
  await expect(page).toHaveURL(/\/admin(\?|$)/);
  await expect(page.getByTestId('admin-app')).toBeVisible();
}

/** Collects console errors, uncaught exceptions and React hydration warnings for a page. */
export function watchConsole(page: Page) {
  const problems: string[] = [];
  page.on('console', message => { if (message.type() === 'error') problems.push(message.text()); });
  page.on('pageerror', error => problems.push(error.message));
  return problems;
}

/** A small valid PNG (solid color), so uploads go through real signature checks. */
export const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAABgAAAAeCAIAAAC5TEmyAAAAI0lEQVR4nGMQtbakCmIYNWjUoFGDRg0aNWjUoFGDRg0iBwEAIQ6BYBfu56YAAAAASUVORK5CYII=', 'base64');

/** Elements sticking out of the viewport sideways (ignoring content inside scrollable or clipped boxes). */
export async function overflowing(page: Page) {
  return page.evaluate(() => {
    const width = window.innerWidth;
    const insideScroller = (element: Element) => {
      for (let parent = element.parentElement; parent; parent = parent.parentElement)
        if (['auto', 'scroll', 'hidden', 'clip'].includes(getComputedStyle(parent).overflowX)) return true;
      return false;
    };
    const offenders = [...document.querySelectorAll('body *')].filter(element => {
      const box = element.getBoundingClientRect();
      return box.width > 1 && (box.left < -1 || box.right > width + 1) && !insideScroller(element);
    }).map(element => element.tagName.toLowerCase() + '.' + String(element.className).split(' ')[0]);
    if (document.documentElement.scrollWidth > width + 1) offenders.unshift('document ' + document.documentElement.scrollWidth);
    return offenders.slice(0, 8);
  });
}
