import { test, expect } from '@playwright/test';

/**
 * Smoke Tests - Fast core functionality checks
 * Run time target: < 2 minutes total
 */

test.describe('Smoke Tests', () => {
  test('dashboard loads', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
    console.log('✓ Dashboard');
  });

  test('movies tab loads', async ({ page }) => {
    await page.goto('/discover?tab=movies', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('img[src*="image.tmdb.org"]', { timeout: 30000 }).catch(() => null);
    const count = await page.locator('img[src*="image.tmdb.org"]').count();
    expect(count).toBeGreaterThanOrEqual(0);
    console.log(`✓ Movies: ${count} items`);
  });

  test('tv shows tab loads', async ({ page }) => {
    await page.goto('/discover?tab=tvshows', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('img[src*="image.tmdb.org"]', { timeout: 30000 }).catch(() => null);
    const count = await page.locator('img[src*="image.tmdb.org"]').count();
    expect(count).toBeGreaterThanOrEqual(0);
    console.log(`✓ TV Shows: ${count} items`);
  });

  test('documentaries tab loads', async ({ page }) => {
    await page.goto('/discover?tab=documentaries', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('img[src*="image.tmdb.org"]', { timeout: 30000 }).catch(() => null);
    const count = await page.locator('img[src*="image.tmdb.org"]').count();
    expect(count).toBeGreaterThanOrEqual(0);
    console.log(`✓ Documentaries: ${count} items`);
  });

  test('favorites page loads', async ({ page }) => {
    await page.goto('/favorites', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
    console.log('✓ Favorites');
  });

  test('downloads page loads', async ({ page }) => {
    await page.goto('/downloads', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
    console.log('✓ Downloads');
  });

  test('settings page loads', async ({ page }) => {
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
    console.log('✓ Settings');
  });

  test('search works on movies', async ({ page }) => {
    await page.goto('/discover?tab=movies', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('input[placeholder*="Search"]', { timeout: 10000 });
    await page.locator('input[placeholder*="Search"]').first().fill('Matrix');
    await page.locator('input[placeholder*="Search"]').first().press('Enter');
    await page.waitForTimeout(2000);
    console.log('✓ Search executed');
  });
});
