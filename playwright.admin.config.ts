import { defineConfig, devices } from '@playwright/test';

/** Back-office end-to-end tests against the real Fastify API and PostgreSQL (see tests-admin/).
 * Needs: DATABASE_URL (migrated + demo seed, no owner yet), ORDER_TOKEN_SECRET, `npm run build` in backend/,
 * and a storefront build made with NEXT_PUBLIC_BACKEND_ENABLED=true and NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3000. */
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
const browser = { ...devices['Desktop Chrome'], ...(executablePath ? { launchOptions: { executablePath } } : {}) };
export const ADMIN_API = 'http://127.0.0.1:4000';

export default defineConfig({
  testDir: './tests-admin',
  // One shared database: tests build on each other's records, so they run in order.
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: { baseURL: 'http://127.0.0.1:3000', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'setup', testMatch: /admin\.setup\.ts/, use: browser },
    { name: 'admin', testMatch: /\.spec\.ts/, dependencies: ['setup'], use: browser }
  ],
  webServer: [
    {
      command: 'node dist/index.js', cwd: 'backend', url: ADMIN_API + '/health/ready',
      reuseExistingServer: !process.env.CI, timeout: 60_000,
      env: { ...process.env as Record<string, string>, API_PORT: '4000', TRUST_PROXY: 'true',
        MEDIA_DIR: process.env.MEDIA_DIR ?? '/tmp/kasra-e2e-media' }
    },
    {
      command: 'npm run start -- --hostname 127.0.0.1 --port 3000', url: 'http://127.0.0.1:3000/api/health',
      reuseExistingServer: !process.env.CI, timeout: 120_000,
      env: { ...process.env as Record<string, string>, BACKEND_INTERNAL_URL: ADMIN_API, NEXT_PUBLIC_SITE_URL: 'http://127.0.0.1:3000' }
    }
  ]
});
