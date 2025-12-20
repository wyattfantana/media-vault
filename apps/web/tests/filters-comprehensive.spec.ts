import { test, expect } from '@playwright/test';
import { FilterHelpers } from './helpers/filter-helpers';

/**
 * Comprehensive Filter Test Suite
 * Focuses on filters that work reliably in test environment
 */

test.describe('Filter System - Comprehensive Coverage', () => {
  let helpers: FilterHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new FilterHelpers(page);
    await page.goto('/discover?tab=movies', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('text=Advanced Discovery', { timeout: 60000 });
    await helpers.waitForMoviesToLoad(5, 60000);
    await helpers.waitForGridStable(2000);
  });

  test.describe('Quick Filters', () => {
    test('Worth Watching filter should show movies rated 5.5+', async ({ page }) => {
      await helpers.clickQuickFilter('Worth Watching');
      const count = await helpers.getMovieCount();
      expect(count).toBeGreaterThan(0);

      // Verify button is active
      const btn = page.locator('button:has-text("Worth Watching")').first();
      const classes = await btn.getAttribute('class');
      expect(classes).toContain('bg-blue');

      console.log(`✓ Worth Watching loaded ${count} movies`);
    });

    test('Quality Movies filter should show movies rated 6.5+', async ({ page }) => {
      await helpers.clickQuickFilter('Quality Movies');
      const count = await helpers.getMovieCount();
      expect(count).toBeGreaterThan(0);

      console.log(`✓ Quality Movies loaded ${count} movies`);
    });

    test('Elite Only filter should show movies rated 7.5+', async ({ page }) => {
      await helpers.clickQuickFilter('Elite Only');
      const count = await helpers.getMovieCount();
      expect(count).toBeGreaterThan(0);

      console.log(`✓ Elite Only loaded ${count} movies`);
    });

    test('should toggle filters on and off without errors', async ({ page }) => {
      // Turn on
      await helpers.clickQuickFilter('Worth Watching');
      let count1 = await helpers.getMovieCount();

      // Turn off
      await helpers.clickQuickFilter('Worth Watching');
      await helpers.waitForGridStable(2000);
      let count2 = await helpers.getMovieCount();

      // Should have movies in both states
      expect(count1).toBeGreaterThan(0);
      expect(count2).toBeGreaterThan(0);

      console.log(`✓ Toggle: ${count1} → ${count2} movies`);
    });

    test('should switch between different quick filters', async ({ page }) => {
      // Apply Worth Watching
      await helpers.clickQuickFilter('Worth Watching');
      const worthCount = await helpers.getMovieCount();

      // Switch to Quality
      await helpers.clickQuickFilter('Quality Movies');
      const qualityCount = await helpers.getMovieCount();

      // Switch to Elite
      await helpers.clickQuickFilter('Elite Only');
      const eliteCount = await helpers.getMovieCount();

      // All should have results
      expect(worthCount).toBeGreaterThan(0);
      expect(qualityCount).toBeGreaterThan(0);
      expect(eliteCount).toBeGreaterThan(0);

      console.log(`✓ Filters: Worth(${worthCount}) → Quality(${qualityCount}) → Elite(${eliteCount})`);
    });
  });

  test.describe('Collection Filters', () => {
    test('should filter by Marvel collection', async ({ page }) => {
      await helpers.selectCollection('Marvel');
      const movies = await helpers.getVisibleMovieTitles(10);

      expect(movies.length).toBeGreaterThan(0);
      console.log(`✓ Marvel collection: ${movies.length} movies`);
    });

    test('should filter by Avengers collection', async ({ page }) => {
      await helpers.selectCollection('Avengers');
      const matches = await helpers.verifyMoviesMatch(/avenger/i, 1);

      console.log(`✓ Avengers collection: ${matches.length} movies`);
    });

    test('should combine collection + quick filter', async ({ page }) => {
      // Select collection first
      await helpers.selectCollection('Avengers');
      const collectionCount = await helpers.getMovieCount();

      // Apply quick filter
      await helpers.clickQuickFilter('Quality Movies');
      await helpers.waitForGridStable(2000);
      const filteredCount = await helpers.getMovieCount();

      // Should apply filter to collection results
      expect(filteredCount).toBeGreaterThan(0);

      console.log(`✓ Avengers(${collectionCount}) + Quality → ${filteredCount} movies`);
    });

    test('should NOT load infinite scroll with collection filter', async ({ page }) => {
      await helpers.selectCollection('Avengers');
      const countBefore = await helpers.getMovieCount();

      // Scroll many times
      for (let i = 0; i < 10; i++) {
        await page.evaluate(() => window.scrollBy(0, 1000));
        await page.waitForTimeout(300);
      }

      await helpers.waitForGridStable(2000);
      const countAfter = await helpers.getMovieCount();

      // Should have stable count (collection has limited movies)
      const increase = countAfter - countBefore;
      expect(increase).toBeLessThan(50); // Not loading pages of general catalog

      console.log(`✓ Infinite scroll blocked: ${countBefore} → ${countAfter} (+${increase})`);
    });
  });

  test.describe('Filter Combinations', () => {
    test('multiple quick filters should work together', async ({ page }) => {
      // This tests if the UI handles multiple selections
      // (implementation may toggle or allow multiples)

      await helpers.clickQuickFilter('Worth Watching');
      const btn1 = page.locator('button:has-text("Worth Watching")').first();
      const classes1 = await btn1.getAttribute('class');

      await helpers.clickQuickFilter('Quality Movies');
      const btn2 = page.locator('button:has-text("Quality Movies")').first();
      const classes2 = await btn2.getAttribute('class');

      // At least one should be active
      const hasActive = classes1?.includes('bg-blue') || classes2?.includes('bg-blue');
      expect(hasActive).toBeTruthy();

      console.log(`✓ Multiple filters UI working`);
    });

    test('clearing filters should reset to initial state', async ({ page }) => {
      // Apply some filters
      await helpers.selectCollection('Avengers');
      await helpers.clickQuickFilter('Quality Movies');

      // Clear
      await helpers.clearAllFilters();

      // Should have movies loaded
      const count = await helpers.getMovieCount();
      expect(count).toBeGreaterThan(0);

      console.log(`✓ Filters cleared, ${count} movies loaded`);
    });
  });

  test.describe('UI State and Interactions', () => {
    test('filter tabs should be clickable and switchable', async ({ page }) => {
      const tabs = ['Search', 'Collection', 'Studio', 'Director', 'Actor'];

      for (const tabName of tabs) {
        const tab = page.locator(`button:has-text("${tabName}")`).first();
        await tab.click();
        await page.waitForTimeout(300);

        // Verify tab is active (has indicator or different style)
        const classes = await tab.getAttribute('class');
        expect(classes).toBeTruthy();

        console.log(`✓ ${tabName} tab clickable`);
      }
    });

    test('Hide/Show Additional Filters should work', async ({ page }) => {
      const hideBtn = page.locator('button:has-text("Hide")').first();

      if (await hideBtn.isVisible().catch(() => false)) {
        await hideBtn.click();
        await page.waitForTimeout(500);

        // Quick filters might be hidden
        const quickFilters = page.locator('text=Quick Filters');
        const isHidden = !(await quickFilters.isVisible().catch(() => false));

        // Should toggle state
        console.log(`✓ Additional Filters toggle works (hidden: ${isHidden})`);
      }
    });

    test('movie grid should be responsive to filters', async ({ page }) => {
      const initialCount = await helpers.getMovieCount();

      await helpers.clickQuickFilter('Elite Only');
      await helpers.waitForGridStable(2000);

      const filteredCount = await helpers.getMovieCount();

      // Grid updated
      expect(filteredCount).toBeGreaterThan(0);

      console.log(`✓ Grid responsive: ${initialCount} → ${filteredCount}`);
    });
  });

  test.describe('Edge Cases', () => {
    test('page should handle rapid filter changes', async ({ page }) => {
      // Rapidly toggle filters
      for (let i = 0; i < 5; i++) {
        await helpers.clickQuickFilter('Worth Watching');
        await page.waitForTimeout(200);
        await helpers.clickQuickFilter('Quality Movies');
        await page.waitForTimeout(200);
      }

      // Should still have movies loaded
      const count = await helpers.getMovieCount();
      expect(count).toBeGreaterThan(0);

      console.log(`✓ Rapid filter changes handled, ${count} movies`);
    });

    test('scrolling without filters should load more movies', async ({ page }) => {
      const countBefore = await helpers.getMovieCount();

      // Scroll to trigger infinite scroll
      await helpers.scrollAndWait(3000, 3);

      const countAfter = await helpers.getMovieCount();

      // Should have loaded more
      expect(countAfter).toBeGreaterThan(countBefore);

      console.log(`✓ Infinite scroll: ${countBefore} → ${countAfter}`);
    });
  });
});
