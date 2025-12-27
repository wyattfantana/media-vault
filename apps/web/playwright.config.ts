import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false, // Run tests sequentially to avoid rate limiting
  forbidOnly: !!process.env.CI,
  retries: 2, // Retry failed tests to handle auth flakiness
  workers: 1, // Run tests sequentially to prevent auth rate limiting
  reporter: 'html',
  timeout: 180000, // 3 minutes per test for comprehensive testing

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    navigationTimeout: 60000, // 60 seconds for page navigation
    actionTimeout: 15000, // 15 seconds for actions
  },

  projects: [
    // Main tests - no auth setup dependency, test handles its own auth
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
      testIgnore: /.*\.setup\.ts/,
    },
    // Firefox and Safari disabled for faster test runs
    // Uncomment when needed for cross-browser testing
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
