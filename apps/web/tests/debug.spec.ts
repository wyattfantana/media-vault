import { test, expect } from '@playwright/test';

/**
 * Diagnostic test to debug page loading issues
 */

test.describe('Debug Tests', () => {
  test('basic page load - no auth', async ({ page }) => {
    console.log('1. Going to homepage...');
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 });

    console.log('2. Current URL:', page.url());
    console.log('3. Page title:', await page.title());

    // Take a screenshot
    await page.screenshot({ path: 'test-results/debug-homepage.png' });

    // Check what's on the page
    const bodyText = await page.locator('body').textContent();
    console.log('4. Body text preview:', bodyText?.substring(0, 200));

    expect(page.url()).toBeTruthy();
  });

  test('sign in and check response', async ({ page }) => {
    console.log('1. Going to sign-in page...');
    await page.goto('/sign-in', { waitUntil: 'domcontentloaded', timeout: 30000 });

    console.log('2. Waiting for email input...');
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    await emailInput.waitFor({ state: 'visible', timeout: 10000 });

    console.log('3. Filling credentials...');
    await emailInput.fill('test@example.com');
    await page.locator('input[type="password"]').fill('TestPass123');

    console.log('4. Clicking sign in...');
    await page.locator('button[type="submit"]').click();

    console.log('5. Waiting for navigation...');
    await page.waitForTimeout(5000);

    console.log('6. Final URL:', page.url());
    await page.screenshot({ path: 'test-results/debug-after-login.png' });

    const bodyText = await page.locator('body').textContent();
    console.log('7. Body text after login:', bodyText?.substring(0, 200));
  });

  test('check movies page API call', async ({ page }) => {
    // Listen to network requests
    page.on('request', request => {
      if (request.url().includes('movies') || request.url().includes('tmdb')) {
        console.log('>> REQUEST:', request.method(), request.url());
      }
    });

    page.on('response', response => {
      if (response.url().includes('movies') || response.url().includes('tmdb')) {
        console.log('<< RESPONSE:', response.status(), response.url());
      }
    });

    // Try to go directly to movies page
    console.log('Going to /discover?tab=movies...');
    await page.goto('/discover?tab=movies', { waitUntil: 'domcontentloaded', timeout: 30000 });

    await page.waitForTimeout(10000);

    console.log('Final URL:', page.url());
    await page.screenshot({ path: 'test-results/debug-movies-page.png' });
  });
});
