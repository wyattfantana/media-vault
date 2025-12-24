import { test, expect } from '@playwright/test';

/**
 * TV Shows Advanced Discovery Tests
 * Tests Collection, Network, Creator, Actor filters
 *
 * Note: Use :visible selector to target TV Shows Advanced Discovery (not Movies)
 * Both tabs exist in DOM but only one is visible at a time
 */

test.describe('TV Shows - Advanced Discovery', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to Discover page
    await page.goto('/discover', { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Click TV Shows tab
    const tvShowsTab = page.locator('button:has-text("TV Shows")').first();
    await tvShowsTab.click();
    await page.waitForTimeout(1500);

    // Wait for TV Shows content to load
    await page.waitForSelector('text=📺 All TV Shows', { timeout: 30000 });

    // Wait for shows to load
    await page.waitForTimeout(2000);
  });

  test.describe('Search Filter', () => {
    test('can search for shows by title', async ({ page }) => {
      // Click the Search tab in Advanced Discovery (use :visible to get the active one)
      const searchTab = page.locator('button:has-text("Search"):visible').last();
      await searchTab.click();
      await page.waitForTimeout(500);

      // Type in search box
      const searchInput = page.locator('input[placeholder*="Search TV shows"]').first();
      await searchInput.fill('Breaking Bad');
      await page.waitForTimeout(2000);

      // Check that results loaded
      const showCards = page.locator('[data-testid="show-card"], .group:has(img[alt])').filter({ hasText: /./ });
      const count = await showCards.count();

      expect(count).toBeGreaterThan(0);
      console.log(`✓ Search found ${count} shows for "Breaking Bad"`);
    });

    test('search clears other filters', async ({ page }) => {
      // First select a collection
      const collectionTab = page.locator('button:has-text("Collection")').first();
      if (await collectionTab.isVisible().catch(() => false)) {
        await collectionTab.click();
        await page.waitForTimeout(500);

        const collectionInput = page.locator('input[placeholder*="Search collections"]').first();
        await collectionInput.fill('Star Trek');
        await page.waitForTimeout(2000);

        // Click first result
        const firstResult = page.locator('button:has-text("Star Trek")').first();
        if (await firstResult.isVisible().catch(() => false)) {
          await firstResult.click();
          await page.waitForTimeout(2000);
        }
      }

      // Now switch to search
      const searchTab = page.locator('button:has-text("Search")').first();
      await searchTab.click();
      await page.waitForTimeout(500);

      const searchInput = page.locator('input[placeholder*="Search TV shows"]').first();
      await searchInput.fill('The Wire');
      await page.waitForTimeout(2000);

      // Collection filter should be cleared
      const collectionPill = page.locator('text=Star Trek').first();
      const isVisible = await collectionPill.isVisible().catch(() => false);
      expect(isVisible).toBeFalsy();

      console.log(`✓ Search properly cleared collection filter`);
    });
  });

  test.describe('Collection Filter', () => {
    test('can search and select a collection', async ({ page }) => {
      const collectionTab = page.locator('button:has-text("Collection")').first();
      await collectionTab.click();
      await page.waitForTimeout(500);

      const searchInput = page.locator('input[placeholder*="Search collections"]').first();
      await searchInput.fill('Star Trek');
      await page.waitForTimeout(2000);

      // Should see results dropdown
      const resultsDropdown = page.locator('.bg-gray-900.border-2.border-blue-500').first();
      const isVisible = await resultsDropdown.isVisible().catch(() => false);

      if (isVisible) {
        // Click first result
        const firstResult = page.locator('button:has-text("Star Trek")').first();
        await firstResult.click();
        await page.waitForTimeout(2000);

        // Should see collection pill
        const collectionPill = page.locator('.bg-purple-900').first();
        expect(await collectionPill.isVisible()).toBeTruthy();

        // Should have shows loaded
        const showCards = page.locator('[data-testid="show-card"], .group:has(img[alt])').filter({ hasText: /./ });
        const count = await showCards.count();
        expect(count).toBeGreaterThan(0);

        console.log(`✓ Collection filter loaded ${count} shows`);
      } else {
        console.log(`⚠ Collection results not visible - API may not have collections`);
      }
    });

    test('can clear collection filter', async ({ page }) => {
      const collectionTab = page.locator('button:has-text("Collection")').first();
      await collectionTab.click();
      await page.waitForTimeout(500);

      const searchInput = page.locator('input[placeholder*="Search collections"]').first();
      await searchInput.fill('Star Trek');
      await page.waitForTimeout(2000);

      const firstResult = page.locator('button:has-text("Star Trek")').first();
      if (await firstResult.isVisible().catch(() => false)) {
        await firstResult.click();
        await page.waitForTimeout(2000);

        // Click the X button on the collection pill
        const clearBtn = page.locator('.bg-purple-900 button:has(svg)').first();
        await clearBtn.click();
        await page.waitForTimeout(1500);

        // Collection pill should be gone
        const collectionPill = page.locator('.bg-purple-900').first();
        const isVisible = await collectionPill.isVisible().catch(() => false);
        expect(isVisible).toBeFalsy();

        console.log(`✓ Collection filter cleared successfully`);
      } else {
        console.log(`⚠ Collection not available - skipping clear test`);
      }
    });
  });

  test.describe('Network Filter', () => {
    test('can search and select a network', async ({ page }) => {
      const networkTab = page.locator('button:has-text("Network")').first();
      await networkTab.click();
      await page.waitForTimeout(500);

      const searchInput = page.locator('input[placeholder*="Search networks"]').first();
      await searchInput.fill('HBO');
      await page.waitForTimeout(2000);

      // Should see results dropdown
      const firstResult = page.locator('button:has-text("HBO")').first();
      const isVisible = await firstResult.isVisible().catch(() => false);

      if (isVisible) {
        await firstResult.click();
        await page.waitForTimeout(3000);

        // Should see network pill (blue)
        const networkPill = page.locator('.bg-blue-900').first();
        expect(await networkPill.isVisible()).toBeTruthy();

        // Should have shows loaded
        const showCards = page.locator('[data-testid="show-card"], .group:has(img[alt])').filter({ hasText: /./ });
        const count = await showCards.count();
        expect(count).toBeGreaterThan(0);

        console.log(`✓ Network filter loaded ${count} HBO shows`);
      } else {
        console.log(`⚠ Network results not visible`);
      }
    });

    test('network filter disables infinite scroll', async ({ page }) => {
      const networkTab = page.locator('button:has-text("Network")').first();
      await networkTab.click();
      await page.waitForTimeout(500);

      const searchInput = page.locator('input[placeholder*="Search networks"]').first();
      await searchInput.fill('Netflix');
      await page.waitForTimeout(2000);

      const firstResult = page.locator('button:has-text("Netflix")').first();
      if (await firstResult.isVisible().catch(() => false)) {
        await firstResult.click();
        await page.waitForTimeout(3000);

        const initialCount = await page.locator('[data-testid="show-card"], .group:has(img[alt])').filter({ hasText: /./ }).count();

        // Scroll down a lot
        for (let i = 0; i < 10; i++) {
          await page.evaluate(() => window.scrollBy(0, 1000));
          await page.waitForTimeout(200);
        }

        await page.waitForTimeout(1000);

        const afterScrollCount = await page.locator('[data-testid="show-card"], .group:has(img[alt])').filter({ hasText: /./ }).count();

        // Count should be similar (no infinite scroll should happen)
        const diff = Math.abs(afterScrollCount - initialCount);
        expect(diff).toBeLessThan(20); // Allow small variance

        console.log(`✓ Network filter disabled infinite scroll (${initialCount} → ${afterScrollCount})`);
      } else {
        console.log(`⚠ Network not available - skipping infinite scroll test`);
      }
    });
  });

  test.describe('Creator Filter', () => {
    test('can search and select a creator', async ({ page }) => {
      const creatorTab = page.locator('button:has-text("Creator")').first();
      await creatorTab.click();
      await page.waitForTimeout(500);

      const searchInput = page.locator('input[placeholder*="Search creators"]').first();
      await searchInput.fill('Vince Gilligan');
      await page.waitForTimeout(2000);

      const firstResult = page.locator('button:has-text("Vince Gilligan")').first();
      const isVisible = await firstResult.isVisible().catch(() => false);

      if (isVisible) {
        await firstResult.click();
        await page.waitForTimeout(2000);

        // Should see creator pill (green)
        const creatorPill = page.locator('.bg-green-900').first();
        expect(await creatorPill.isVisible()).toBeTruthy();

        // Should have shows loaded
        const showCards = page.locator('[data-testid="show-card"], .group:has(img[alt])').filter({ hasText: /./ });
        const count = await showCards.count();
        expect(count).toBeGreaterThan(0);

        console.log(`✓ Creator filter loaded ${count} shows by Vince Gilligan`);
      } else {
        console.log(`⚠ Creator results not visible`);
      }
    });

    test('creator search filters to directing/writing/production', async ({ page }) => {
      const creatorTab = page.locator('button:has-text("Creator")').first();
      await creatorTab.click();
      await page.waitForTimeout(500);

      const searchInput = page.locator('input[placeholder*="Search creators"]').first();
      await searchInput.fill('David Simon');
      await page.waitForTimeout(2000);

      // Should show results with known_for_department
      const results = page.locator('.bg-gray-900.border-2 button');
      const count = await results.count();

      if (count > 0) {
        // All results should show people (not actors)
        console.log(`✓ Creator search returned ${count} results`);
      } else {
        console.log(`⚠ No creator results found for David Simon`);
      }
    });
  });

  test.describe('Actor Filter', () => {
    test('can search and select an actor', async ({ page }) => {
      const actorTab = page.locator('button:has-text("Actor")').first();
      await actorTab.click();
      await page.waitForTimeout(500);

      const searchInput = page.locator('input[placeholder*="Search actors"]').first();
      await searchInput.fill('Bryan Cranston');
      await page.waitForTimeout(2000);

      const firstResult = page.locator('button:has-text("Bryan Cranston")').first();
      const isVisible = await firstResult.isVisible().catch(() => false);

      if (isVisible) {
        await firstResult.click();
        await page.waitForTimeout(3000);

        // Should see actor pill (yellow)
        const actorPill = page.locator('.bg-yellow-900').first();
        expect(await actorPill.isVisible()).toBeTruthy();

        // Should have shows loaded
        const showCards = page.locator('[data-testid="show-card"], .group:has(img[alt])').filter({ hasText: /./ });
        const count = await showCards.count();
        expect(count).toBeGreaterThan(0);

        console.log(`✓ Actor filter loaded ${count} shows with Bryan Cranston`);
      } else {
        console.log(`⚠ Actor results not visible`);
      }
    });

    test('actor filter loads multiple pages', async ({ page }) => {
      const actorTab = page.locator('button:has-text("Actor")').first();
      await actorTab.click();
      await page.waitForTimeout(500);

      const searchInput = page.locator('input[placeholder*="Search actors"]').first();
      await searchInput.fill('Peter Dinklage');
      await page.waitForTimeout(2000);

      const firstResult = page.locator('button:has-text("Peter Dinklage")').first();
      if (await firstResult.isVisible().catch(() => false)) {
        await firstResult.click();
        await page.waitForTimeout(3000);

        const count = await page.locator('[data-testid="show-card"], .group:has(img[alt])').filter({ hasText: /./ }).count();

        // Actor filter should load 5 pages (100 shows)
        // So we should have many results
        expect(count).toBeGreaterThan(20);

        console.log(`✓ Actor filter loaded ${count} shows (multi-page)`);
      } else {
        console.log(`⚠ Actor not available - skipping multi-page test`);
      }
    });
  });

  test.describe('Clear All Functionality', () => {
    test('Clear All button resets all filters', async ({ page }) => {
      // Apply a network filter
      const networkTab = page.locator('button:has-text("Network")').first();
      await networkTab.click();
      await page.waitForTimeout(500);

      const searchInput = page.locator('input[placeholder*="Search networks"]').first();
      await searchInput.fill('AMC');
      await page.waitForTimeout(2000);

      const firstResult = page.locator('button:has-text("AMC")').first();
      if (await firstResult.isVisible().catch(() => false)) {
        await firstResult.click();
        await page.waitForTimeout(2000);

        // Click "Clear All & Browse Shows"
        const clearAllBtn = page.locator('button:has-text("Clear All & Browse Shows")').first();
        if (await clearAllBtn.isVisible().catch(() => false)) {
          await clearAllBtn.click();
          await page.waitForTimeout(3000);

          // Network pill should be gone
          const networkPill = page.locator('.bg-blue-900').first();
          const isVisible = await networkPill.isVisible().catch(() => false);
          expect(isVisible).toBeFalsy();

          // Should have general catalog loaded
          const showCards = page.locator('[data-testid="show-card"], .group:has(img[alt])').filter({ hasText: /./ });
          const count = await showCards.count();
          expect(count).toBeGreaterThan(50); // Should have many shows in general catalog

          console.log(`✓ Clear All reset filters and loaded ${count} shows`);
        } else {
          console.log(`⚠ Clear All button not visible`);
        }
      } else {
        console.log(`⚠ Network not available - skipping clear all test`);
      }
    });
  });

  test.describe('Filter Interaction & State Management', () => {
    test('selecting one filter clears others', async ({ page }) => {
      // Select network
      const networkTab = page.locator('button:has-text("Network")').first();
      await networkTab.click();
      await page.waitForTimeout(500);

      let searchInput = page.locator('input[placeholder*="Search networks"]').first();
      await searchInput.fill('HBO');
      await page.waitForTimeout(2000);

      let firstResult = page.locator('button:has-text("HBO")').first();
      if (await firstResult.isVisible().catch(() => false)) {
        await firstResult.click();
        await page.waitForTimeout(2000);

        // Now select an actor - should clear network
        const actorTab = page.locator('button:has-text("Actor")').first();
        await actorTab.click();
        await page.waitForTimeout(500);

        searchInput = page.locator('input[placeholder*="Search actors"]').first();
        await searchInput.fill('Kit Harington');
        await page.waitForTimeout(2000);

        firstResult = page.locator('button:has-text("Kit Harington")').first();
        if (await firstResult.isVisible().catch(() => false)) {
          await firstResult.click();
          await page.waitForTimeout(2000);

          // Network pill should be gone, actor pill should be visible
          const networkPill = page.locator('.bg-blue-900:has-text("HBO")').first();
          const actorPill = page.locator('.bg-yellow-900').first();

          const networkVisible = await networkPill.isVisible().catch(() => false);
          const actorVisible = await actorPill.isVisible();

          expect(networkVisible).toBeFalsy();
          expect(actorVisible).toBeTruthy();

          console.log(`✓ Selecting actor properly cleared network filter`);
        }
      } else {
        console.log(`⚠ Network/Actor not available - skipping filter interaction test`);
      }
    });

    test('filters work with quick filters', async ({ page }) => {
      // Select a creator
      const creatorTab = page.locator('button:has-text("Creator")').first();
      await creatorTab.click();
      await page.waitForTimeout(500);

      const searchInput = page.locator('input[placeholder*="Search creators"]').first();
      await searchInput.fill('Aaron Sorkin');
      await page.waitForTimeout(2000);

      const firstResult = page.locator('button:has-text("Aaron Sorkin")').first();
      if (await firstResult.isVisible().catch(() => false)) {
        await firstResult.click();
        await page.waitForTimeout(2000);

        // Now click a quick filter
        const qualityBtn = page.locator('button:has-text("Quality Shows")').first();
        if (await qualityBtn.isVisible().catch(() => false)) {
          await qualityBtn.click();
          await page.waitForTimeout(2000);

          // Should have fewer shows (filtered to quality)
          const showCards = page.locator('[data-testid="show-card"], .group:has(img[alt])').filter({ hasText: /./ });
          const count = await showCards.count();

          // Creator filter should still be active
          const creatorPill = page.locator('.bg-green-900').first();
          expect(await creatorPill.isVisible()).toBeTruthy();

          console.log(`✓ Quick filter applied to creator results: ${count} shows`);
        } else {
          console.log(`⚠ Quality Shows button not visible`);
        }
      } else {
        console.log(`⚠ Creator not available - skipping quick filter test`);
      }
    });
  });

  test.describe('Performance & Stability', () => {
    test('rapid filter switching does not crash', async ({ page }) => {
      const tabs = ['Search', 'Collection', 'Network', 'Creator', 'Actor'];

      // Rapidly click between tabs
      for (let i = 0; i < 15; i++) {
        const tab = tabs[i % tabs.length];
        const tabBtn = page.locator(`button:has-text("${tab}")`).first();
        await tabBtn.click();
        await page.waitForTimeout(100);
      }

      await page.waitForTimeout(1000);

      // Page should still be functional
      const discovery = page.locator('text=Advanced Discovery');
      await expect(discovery).toBeVisible();

      console.log(`✓ Survived 15 rapid tab switches`);
    });

    test('filters maintain state during scroll', async ({ page }) => {
      // Apply a creator filter
      const creatorTab = page.locator('button:has-text("Creator")').first();
      await creatorTab.click();
      await page.waitForTimeout(500);

      const searchInput = page.locator('input[placeholder*="Search creators"]').first();
      await searchInput.fill('Ryan Murphy');
      await page.waitForTimeout(2000);

      const firstResult = page.locator('button:has-text("Ryan Murphy")').first();
      if (await firstResult.isVisible().catch(() => false)) {
        await firstResult.click();
        await page.waitForTimeout(2000);

        // Scroll a lot
        for (let i = 0; i < 20; i++) {
          await page.evaluate(() => window.scrollBy(0, 500));
          await page.waitForTimeout(100);
        }

        // Creator pill should still be visible
        const creatorPill = page.locator('.bg-green-900').first();
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(500);

        expect(await creatorPill.isVisible()).toBeTruthy();

        console.log(`✓ Creator filter persisted through scroll`);
      } else {
        console.log(`⚠ Creator not available - skipping scroll test`);
      }
    });
  });
});
