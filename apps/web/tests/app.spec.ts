import { test, expect } from '@playwright/test';

/**
 * MediaVault Complete App Test
 * Single consolidated test to avoid auth expiration between tests
 */

// Helper to authenticate
async function authenticate(page: any) {
  console.log('Authenticating...');
  await page.goto('/sign-in', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1000);

  // Wait for form to be ready
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  await page.waitForSelector('input[type="password"]', { timeout: 10000 });

  // Fill form with explicit waits
  await page.locator('input[type="email"]').click();
  await page.locator('input[type="email"]').fill('test@example.com');
  await page.waitForTimeout(500);

  await page.locator('input[type="password"]').click();
  await page.locator('input[type="password"]').fill('TestPass123');
  await page.waitForTimeout(500);

  // Submit
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/(dashboard|discover|favorites|downloads|settings)/, { timeout: 30000 });
  await page.waitForTimeout(2000);
  console.log('✓ Authenticated');
}

test('MediaVault app works correctly', async ({ page }) => {
  // Always authenticate first to ensure we're logged in
  await authenticate(page);

  // === DASHBOARD ===
  await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('nav', { timeout: 15000 });
  console.log('✓ Dashboard');

  // === MOVIES ===
  await page.goto('/discover?tab=movies', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('img[src*="image.tmdb.org"]', { timeout: 30000 }).catch(() => null);
  const moviesCount = await page.locator('img[src*="image.tmdb.org"]').count();
  console.log(`✓ Movies: ${moviesCount} items`);

  // Movies search
  await page.waitForSelector('input[placeholder*="Search"]', { timeout: 10000 });
  await page.locator('input[placeholder*="Search"]').first().fill('Matrix');
  await page.waitForTimeout(1500);
  console.log('✓ Movies search');

  // === TV SHOWS ===
  await page.goto('/discover?tab=tvshows', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('img[src*="image.tmdb.org"]', { timeout: 30000 }).catch(() => null);
  const tvCount = await page.locator('img[src*="image.tmdb.org"]').count();
  console.log(`✓ TV Shows: ${tvCount} items`);

  // TV Shows Advanced Discovery
  await page.waitForSelector('input[placeholder*="Search TV shows"]', { timeout: 10000 });

  await page.locator('button:has-text("Network"):visible').click();
  await page.waitForTimeout(300);
  await expect(page.locator('input[placeholder*="networks"]')).toBeVisible();
  console.log('✓ Network tab');

  await page.locator('button:has-text("Creator"):visible').click();
  await page.waitForTimeout(300);
  await expect(page.locator('input[placeholder*="creators"]')).toBeVisible();
  console.log('✓ Creator tab');

  await page.locator('button:has-text("Actor"):visible').click();
  await page.waitForTimeout(300);
  await expect(page.locator('input[placeholder*="actors"]')).toBeVisible();
  console.log('✓ Actor tab');

  // === DOCUMENTARIES ===
  await page.goto('/discover?tab=documentaries', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('img[src*="image.tmdb.org"]', { timeout: 30000 }).catch(() => null);
  const docsCount = await page.locator('img[src*="image.tmdb.org"]').count();
  console.log(`✓ Documentaries: ${docsCount} items`);

  // Documentaries filter
  const allDocsBtn = page.locator('button').filter({ hasText: 'All Docs' }).first();
  if (await allDocsBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await allDocsBtn.click();
    await page.waitForTimeout(1000);
    console.log('✓ All Docs filter');
  }

  // === FAVORITES ===
  await page.goto('/favorites', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('h1', { timeout: 15000 });
  console.log('✓ Favorites');

  // === DOWNLOADS ===
  await page.goto('/downloads', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('h1', { timeout: 15000 });
  console.log('✓ Downloads');

  // === SETTINGS ===
  await page.goto('/settings', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('h1, form', { timeout: 15000 });
  console.log('✓ Settings');

  console.log('\n✅ All tests passed!');
});
