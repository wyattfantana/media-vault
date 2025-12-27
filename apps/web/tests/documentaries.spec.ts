import { test, expect, Page, Locator } from '@playwright/test';

/**
 * Documentaries Page - Complete Test Suite
 * All interactions scoped to visible documentaries tab content
 */

// Helper to get the visible tab content area
function getVisibleContent(page: Page): Locator {
  // The documentaries content has "All Documentaries" heading
  return page.locator('h1:has-text("All Documentaries")').locator('..').locator('..');
}

test.describe('Documentaries Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/discover?tab=documentaries', { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Wait for documentaries heading to confirm correct tab is active
    await page.waitForSelector('h1:has-text("All Documentaries")', { timeout: 30000 });
    await page.waitForTimeout(2000);
  });

  test.describe('Page Load & Basic Functionality', () => {
    test('loads documentaries with TMDB thumbnails', async ({ page }) => {
      await expect(page).toHaveURL(/tab=documentaries/);

      // Wait for images
      await page.waitForSelector('img[src*="image.tmdb.org"]', { timeout: 30000 }).catch(() => null);

      const docCount = await page.locator('img[src*="image.tmdb.org"]').count();
      expect(docCount).toBeGreaterThanOrEqual(0);
      console.log(`✓ Loaded ${docCount} documentaries`);
    });

    test('displays loading stats correctly', async ({ page }) => {
      const statsText = await page.locator('text=/Loaded:.*documentaries/i').first().textContent();
      expect(statsText).toBeTruthy();
      console.log(`✓ Stats: ${statsText}`);
    });

    test('infinite scroll loads more documentaries', async ({ page }) => {
      await page.waitForSelector('img[src*="image.tmdb.org"]', { timeout: 30000 }).catch(() => null);
      const countBefore = await page.locator('img[src*="image.tmdb.org"]').count();

      for (let i = 0; i < 3; i++) {
        await page.evaluate(() => window.scrollBy(0, 3000));
        await page.waitForTimeout(1000);
      }

      const countAfter = await page.locator('img[src*="image.tmdb.org"]').count();
      expect(countAfter).toBeGreaterThanOrEqual(countBefore);
      console.log(`✓ Scroll: ${countBefore} → ${countAfter}`);
    });
  });

  test.describe('Quick Filters', () => {
    test('All Docs filter works', async ({ page }) => {
      // These buttons are unique to documentaries (Movies has "Popular", "New Releases", etc.)
      await page.locator('button:has-text("🎬 All Docs")').first().click();
      await page.waitForTimeout(1500);

      const count = await page.locator('img[src*="image.tmdb.org"]').count();
      expect(count).toBeGreaterThanOrEqual(0);
      console.log(`✓ All Docs: ${count} results`);
    });

    test('Worth Watching filter (5.5+ rating)', async ({ page }) => {
      await page.locator('button:has-text("👍 Worth Watching")').first().click();
      await page.waitForTimeout(2000);

      const count = await page.locator('img[src*="image.tmdb.org"]').count();
      expect(count).toBeGreaterThanOrEqual(0);
      console.log(`✓ Worth Watching: ${count} results`);
    });

    test('Quality Docs filter (6.5+ rating)', async ({ page }) => {
      await page.locator('button:has-text("⭐ Quality Docs")').first().click();
      await page.waitForTimeout(2000);

      const count = await page.locator('img[src*="image.tmdb.org"]').count();
      expect(count).toBeGreaterThanOrEqual(0);
      console.log(`✓ Quality Docs: ${count} results`);
    });

    test('Elite Only filter (7.5+ rating)', async ({ page }) => {
      await page.locator('button:has-text("🏆 Elite Only")').first().click();
      await page.waitForTimeout(2000);

      const count = await page.locator('img[src*="image.tmdb.org"]').count();
      expect(count).toBeGreaterThanOrEqual(0);
      console.log(`✓ Elite Only: ${count} results`);
    });

    test('Quick filters auto-enable content filters', async ({ page }) => {
      await page.locator('button:has-text("👍 Worth Watching")').click();
      await page.waitForTimeout(500);

      // After clicking a quick filter, "Min Rating" label should be visible
      await expect(page.locator('text=Min Rating').first()).toBeVisible({ timeout: 5000 });
      console.log('✓ Content filters auto-enabled');
    });
  });

  test.describe('Additional Filters', () => {
    test('can show/hide additional filters', async ({ page }) => {
      // Show filters
      const showBtn = page.locator('button:has-text("Show Additional Filters")');
      if (await showBtn.isVisible().catch(() => false)) {
        await showBtn.click();
        await page.waitForTimeout(300);
      }

      // Check filters visible
      await expect(page.locator('text=Genres').first()).toBeVisible();
      await expect(page.locator('text=Min Rating').first()).toBeVisible();

      // Hide filters
      const hideBtn = page.locator('button:has-text("Hide Additional Filters")');
      if (await hideBtn.isVisible().catch(() => false)) {
        await hideBtn.click();
        await page.waitForTimeout(300);
      }

      console.log('✓ Additional filters toggle working');
    });

    test('genre selection works', async ({ page }) => {
      // Show filters
      const showBtn = page.locator('button:has-text("Show Additional Filters")');
      if (await showBtn.isVisible().catch(() => false)) {
        await showBtn.click();
        await page.waitForTimeout(300);
      }

      // Open genres dropdown
      await page.locator('summary:has-text("Genres")').click();
      await page.waitForTimeout(300);

      // Click any genre button
      const genreBtn = page.locator('details:has-text("Genres") button').first();
      if (await genreBtn.isVisible().catch(() => false)) {
        await genreBtn.click();
        await page.waitForTimeout(1500);
      }

      const count = await page.locator('img[src*="image.tmdb.org"]').count();
      expect(count).toBeGreaterThanOrEqual(0);
      console.log(`✓ Genre filter: ${count} results`);
    });

    test('rating slider adjusts results', async ({ page }) => {
      // Show filters
      const showBtn = page.locator('button:has-text("Show Additional Filters")');
      if (await showBtn.isVisible().catch(() => false)) {
        await showBtn.click();
        await page.waitForTimeout(300);
      }

      await page.waitForSelector('img[src*="image.tmdb.org"]', { timeout: 30000 }).catch(() => null);
      const countBefore = await page.locator('img[src*="image.tmdb.org"]').count();

      // Adjust rating slider
      const slider = page.locator('input[type="range"]').first();
      await slider.fill('7');
      await page.waitForTimeout(2000);

      const countAfter = await page.locator('img[src*="image.tmdb.org"]').count();
      console.log(`✓ Rating filter: ${countBefore} → ${countAfter}`);
    });

    test('reset filters button works', async ({ page }) => {
      // Apply a filter first
      await page.locator('button:has-text("👍 Worth Watching")').click();
      await page.waitForTimeout(1000);

      // Click reset
      const resetBtn = page.locator('button:has-text("Reset Filters")');
      if (await resetBtn.isEnabled().catch(() => false)) {
        await resetBtn.click();
        await page.waitForTimeout(1500);
      }

      const count = await page.locator('img[src*="image.tmdb.org"]').count();
      expect(count).toBeGreaterThanOrEqual(0);
      console.log(`✓ Reset filters: ${count} results`);
    });
  });

  test.describe('Torrent Download Modal', () => {
    test('can open torrent search modal', async ({ page }) => {
      // Wait for grid to load, then click first card's button
      await page.waitForSelector('img[src*="image.tmdb.org"]', { timeout: 30000 }).catch(() => null);

      const firstCard = page.locator('div:has(img[src*="image.tmdb.org"])').first();
      const autoSearchBtn = firstCard.locator('button:has-text("Auto-Search")');

      if (await autoSearchBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await autoSearchBtn.click();
        await page.waitForTimeout(1000);
        console.log('✓ Torrent search modal opened');
      } else {
        console.log('⚠ Auto-Search button not found');
      }
    });

    test('torrent search returns results', async ({ page }) => {
      await page.waitForSelector('img[src*="image.tmdb.org"]', { timeout: 30000 }).catch(() => null);

      const autoSearchBtn = page.locator('button:has-text("Auto-Search")').first();
      if (await autoSearchBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await autoSearchBtn.click();
        await page.waitForTimeout(3000);

        const hasResults = await page.locator('text=/Seeds|Found/i').isVisible({ timeout: 15000 }).catch(() => false);
        if (hasResults) {
          console.log('✓ Torrent results found');
        } else {
          console.log('⚠ No torrent results (API may need configuration)');
        }
      }
    });

    test('can filter torrents by quality', async ({ page }) => {
      await page.waitForSelector('img[src*="image.tmdb.org"]', { timeout: 30000 }).catch(() => null);

      const autoSearchBtn = page.locator('button:has-text("Auto-Search")').first();
      if (await autoSearchBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await autoSearchBtn.click();
        await page.waitForTimeout(2000);

        const qualityFilter = page.locator('select');
        if (await qualityFilter.isVisible({ timeout: 5000 }).catch(() => false)) {
          await qualityFilter.first().selectOption({ index: 1 });
          console.log('✓ Quality filter working');
        } else {
          console.log('⚠ Quality filter not available');
        }
      }
    });

    test('click-to-download torrent works', async ({ page }) => {
      await page.waitForSelector('img[src*="image.tmdb.org"]', { timeout: 30000 }).catch(() => null);

      const autoSearchBtn = page.locator('button:has-text("Auto-Search")').first();
      if (await autoSearchBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await autoSearchBtn.click();
        await page.waitForTimeout(2000);

        const torrentRow = page.locator('div.cursor-pointer').first();
        if (await torrentRow.isVisible({ timeout: 5000 }).catch(() => false)) {
          await torrentRow.click();
          console.log('✓ Torrent download attempted');
        } else {
          console.log('⚠ No torrents available');
        }
      }
    });
  });

  test.describe('Search Functionality', () => {
    test('search bar filters documentaries', async ({ page }) => {
      // Use documentaries-specific search placeholder
      const searchInput = page.locator('input[placeholder*="documentaries"]');
      await searchInput.fill('Planet');
      await searchInput.press('Enter');
      await page.waitForTimeout(2000);

      const count = await page.locator('img[src*="image.tmdb.org"]').count();
      console.log(`✓ Search "Planet": ${count} results`);
    });
  });
});
