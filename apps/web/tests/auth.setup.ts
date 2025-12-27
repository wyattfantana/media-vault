import { test as setup, expect } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Navigate to sign in page
  await page.goto('/sign-in', { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Fill in credentials
  await page.locator('input[type="email"]').fill('test@example.com');
  await page.locator('input[type="password"]').fill('TestPass123');

  // Click sign in
  await page.locator('button[type="submit"]').click();

  // Wait for redirect to dashboard (or any authenticated page)
  await page.waitForURL(/\/(dashboard|discover|favorites|downloads|settings)/, { timeout: 30000 });

  // Wait for page to be ready
  await page.waitForTimeout(2000);

  // Save authenticated state
  await page.context().storageState({ path: authFile });
});
