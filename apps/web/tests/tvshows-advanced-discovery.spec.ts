import { test, expect } from '@playwright/test';

/**
 * TV Shows Advanced Discovery Tests
 * Tests core UI functionality of filter tabs
 */

test.describe('TV Shows Advanced Discovery', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/discover?tab=tvshows', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('input[placeholder*="Search TV shows by title"]', { timeout: 30000 });
    await page.waitForTimeout(1500);
  });

  test('search input is visible and can be used', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search TV shows by title"]');
    await expect(searchInput).toBeVisible();

    await searchInput.fill('Breaking Bad');
    await page.waitForTimeout(2000);
    console.log('✓ Search executed');
  });

  test('can switch between all filter tabs', async ({ page }) => {
    // Network tab
    await page.locator('button:has-text("Network"):visible').click();
    await page.waitForTimeout(300);
    await expect(page.locator('input[placeholder*="networks/studios"]')).toBeVisible();
    console.log('✓ Network tab');

    // Creator tab
    await page.locator('button:has-text("Creator"):visible').click();
    await page.waitForTimeout(300);
    await expect(page.locator('input[placeholder*="creators/showrunners"]')).toBeVisible();
    console.log('✓ Creator tab');

    // Actor tab
    await page.locator('button:has-text("Actor"):visible').click();
    await page.waitForTimeout(300);
    await expect(page.locator('input[placeholder*="actors"]')).toBeVisible();
    console.log('✓ Actor tab');

    // Back to Search
    await page.locator('button:has-text("Search"):visible').click();
    await page.waitForTimeout(300);
    await expect(page.locator('input[placeholder*="Search TV shows by title"]')).toBeVisible();
    console.log('✓ Search tab');
  });

  test('quick example buttons populate search fields', async ({ page }) => {
    // TV show example
    const wireBtn = page.locator('button:has-text("The Wire"):visible');
    if (await wireBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await wireBtn.click();
      await page.waitForTimeout(500);
      const searchInput = page.locator('input[placeholder*="Search TV shows by title"]');
      await expect(searchInput).toHaveValue('The Wire');
      console.log('✓ "The Wire" example works');
    }

    // Network example
    await page.locator('button:has-text("Network"):visible').click();
    await page.waitForTimeout(500);

    const hboBtn = page.locator('button:has-text("HBO"):visible');
    if (await hboBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await hboBtn.click();
      await page.waitForTimeout(500);
      const networkInput = page.locator('input[placeholder*="networks/studios"]');
      await expect(networkInput).toHaveValue('HBO');
      console.log('✓ "HBO" example works');
    }
  });
});
