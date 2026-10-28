import { defineConfig, devices } from '@playwright/test';

// iPhone Safari (WebKit) checks for flows that have behaved differently on iOS than on Android.
// CI installs WebKit; locally run it where `npx playwright install --with-deps webkit` works.
export default defineConfig({
  testDir: './tests-webkit',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://127.0.0.1:3000', trace: 'retain-on-failure' },
  projects: [{ name: 'iphone', use: { ...devices['iPhone 14'] } }],
  webServer: {
    command: 'npm run start -- --hostname 127.0.0.1',
    url: 'http://127.0.0.1:3000/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 120000
  }
});
