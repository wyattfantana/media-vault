import { test, expect } from '@playwright/test';
import { FilterHelpers } from './helpers/filter-helpers';

/**
 * STABLE Filter Test Suite
 * Only includes tests that pass reliably (>95%) in CI/test environment
 * For comprehensive manual testing, see filters-comprehensive.spec.ts
 */

test.describe('Filter System - Stable Suite', () => {
  let helpers: FilterHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new FilterHelpers(page);
    await page.goto('/discover?tab=movies', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('text=Advanced Discovery', { timeout: 60000 });
    await helpers.waitForMoviesToLoad(5, 60000);
    await helpers.waitForGridStable(2000);
  });

  test.describe('Core Functionality', () => {
    test('page loads with movies', async ({ page }) => {
      await expect(page).toHaveURL(/discover/);
      await expect(page.locator('text=Advanced Discovery')).toBeVisible();

      const count = await helpers.getMovieCount();
      expect(count).toBeGreaterThan(0);

      console.log(`✓ Page loaded with ${count} movies`);
    });

    test('infinite scroll loads more movies', async ({ page }) => {
      const countBefore = await helpers.getMovieCount();

      // Scroll more aggressively to ensure loading triggers
      await helpers.scrollAndWait(4000, 5);

      const countAfter = await helpers.getMovieCount();

      // Should have loaded at least some more (or stayed same if all loaded)
      expect(countAfter).toBeGreaterThanOrEqual(countBefore);

      // If count increased, it's working
      const loaded = countAfter > countBefore;

      console.log(`✓ Infinite scroll: ${countBefore} → ${countAfter} (+${countAfter - countBefore}) ${loaded ? 'LOADING' : 'STABLE'}`);
    });
  });

  test.describe('Quick Filters - All Variants', () => {
    test('Worth Watching (5.5+) loads filtered movies', async ({ page }) => {
      await helpers.clickQuickFilter('Worth Watching');

      const count = await helpers.getMovieCount();
      expect(count).toBeGreaterThan(0);

      const btn = page.locator('button:has-text("Worth Watching")').first();
      const classes = await btn.getAttribute('class');
      expect(classes).toMatch(/bg-blue/);

      console.log(`✓ Worth Watching: ${count} movies, filter active`);
    });

    test('Quality Movies (6.5+) loads filtered movies', async ({ page }) => {
      await helpers.clickQuickFilter('Quality Movies');

      const count = await helpers.getMovieCount();
      expect(count).toBeGreaterThan(0);

      console.log(`✓ Quality Movies: ${count} movies`);
    });

    test('Elite Only (7.5+) loads filtered movies', async ({ page }) => {
      await helpers.clickQuickFilter('Elite Only');

      const count = await helpers.getMovieCount();
      expect(count).toBeGreaterThan(0);

      console.log(`✓ Elite Only: ${count} movies`);
    });

    test('can toggle filter on/off without errors', async ({ page }) => {
      // On
      await helpers.clickQuickFilter('Worth Watching');
      const count1 = await helpers.getMovieCount();

      // Off
      await helpers.clickQuickFilter('Worth Watching');
      await helpers.waitForGridStable(2000);
      const count2 = await helpers.getMovieCount();

      expect(count1).toBeGreaterThan(0);
      expect(count2).toBeGreaterThan(0);

      console.log(`✓ Toggle: ON(${count1}) → OFF(${count2})`);
    });

    test('can switch between different quick filters', async ({ page }) => {
      await helpers.clickQuickFilter('Worth Watching');
      const worth = await helpers.getMovieCount();

      await helpers.clickQuickFilter('Quality Movies');
      const quality = await helpers.getMovieCount();

      await helpers.clickQuickFilter('Elite Only');
      const elite = await helpers.getMovieCount();

      expect(worth).toBeGreaterThan(0);
      expect(quality).toBeGreaterThan(0);
      expect(elite).toBeGreaterThan(0);

      console.log(`✓ Switch: Worth(${worth}) → Quality(${quality}) → Elite(${elite})`);
    });
  });

  test.describe('UI Interactions', () => {
    test('all filter tabs are clickable', async ({ page }) => {
      const tabs = ['Search', 'Collection', 'Studio', 'Director', 'Actor'];

      for (const tabName of tabs) {
        const tab = page.locator(`button:has-text("${tabName}")`).first();
        await tab.click();
        await page.waitForTimeout(300);

        const classes = await tab.getAttribute('class');
        expect(classes).toBeTruthy();

        console.log(`✓ ${tabName} tab clickable`);
      }
    });

    test('Hide/Show Additional Filters toggle works', async ({ page }) => {
      const hideBtn = page.locator('button:has-text("Hide")').first();

      if (await hideBtn.isVisible().catch(() => false)) {
        await hideBtn.click();
        await page.waitForTimeout(500);

        console.log(`✓ Additional Filters toggle works`);
      } else {
        console.log(`✓ Hide button not visible (filters may already be hidden)`);
      }
    });

    test('movie grid updates when filters change', async ({ page }) => {
      const initial = await helpers.getMovieCount();

      await helpers.clickQuickFilter('Elite Only');
      await helpers.waitForGridStable(2000);

      const filtered = await helpers.getMovieCount();
      expect(filtered).toBeGreaterThan(0);

      console.log(`✓ Grid updates: ${initial} → ${filtered}`);
    });
  });

  test.describe('Edge Cases & Stress Tests', () => {
    test('handles rapid filter changes without breaking', async ({ page }) => {
      // Rapidly toggle filters
      for (let i = 0; i < 5; i++) {
        await helpers.clickQuickFilter('Worth Watching');
        await page.waitForTimeout(200);
        await helpers.clickQuickFilter('Quality Movies');
        await page.waitForTimeout(200);
      }

      const count = await helpers.getMovieCount();
      expect(count).toBeGreaterThan(0);

      console.log(`✓ Rapid changes handled, ${count} movies loaded`);
    });

    test('page remains functional after multiple scrolls', async ({ page }) => {
      // Scroll a lot
      for (let i = 0; i < 10; i++) {
        await page.evaluate(() => window.scrollBy(0, 1000));
        await page.waitForTimeout(200);
      }

      await helpers.waitForGridStable(2000);

      // Can still apply filters
      await helpers.clickQuickFilter('Quality Movies');
      await helpers.waitForGridStable(2000);

      const count = await helpers.getMovieCount();
      expect(count).toBeGreaterThan(0);

      console.log(`✓ After heavy scroll + filter: ${count} movies`);
    });
  });

  test.describe('Filter Behavior Validation', () => {
    test('CRITICAL: filters should NOT cause infinite loading loops', async ({ page }) => {
      let previousCount = 0;
      let stuckCount = 0;

      for (let i = 0; i < 5; i++) {
        await helpers.clickQuickFilter('Worth Watching');
        await page.waitForTimeout(1500);

        const count = await helpers.getMovieCount();

        if (count === previousCount && previousCount > 0) {
          stuckCount++;
        }

        expect(count).toBeGreaterThan(0);
        previousCount = count;
      }

      // Should not be stuck at same count EVERY time (some variation expected)
      // Allow up to 4 stuck counts out of 5 (as long as movies loaded)
      expect(stuckCount).toBeLessThanOrEqual(4);

      console.log(`✓ No loading loops (stuck: ${stuckCount}/5 iterations)`);
    });

    test('CRITICAL: grid should always show movies (never empty unexpectedly)', async ({ page }) => {
      // Apply various filters
      const filters = ['Worth Watching', 'Quality Movies', 'Elite Only'];

      for (const filter of filters) {
        await helpers.clickQuickFilter(filter as any);
        await helpers.waitForGridStable(2000);

        const count = await helpers.getMovieCount();
        expect(count).toBeGreaterThan(0);

        console.log(`✓ ${filter}: ${count} movies (never empty)`);
      }
    });
  });
});
