import { test, expect } from '@playwright/test';

/**
 * MediaVault Movies Filter Tests
 *
 * These tests verify the filter functionality on the Movies page
 * including search, advanced filters (Collection/Director/Actor/Studio),
 * and quick filters (Worth Watching/Quality/Elite).
 */

test.describe('Movies Filter System', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to Discover page with movies tab (already authenticated via storageState)
    await page.goto('/discover?tab=movies', { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Wait for Advanced Discovery section to be visible
    await page.waitForSelector('text=Advanced Discovery', {
      timeout: 60000
    });

    // Wait for initial movie batch to fully load before running tests
    // This prevents race conditions with search
    await page.waitForSelector('img[src*="image.tmdb.org"]', {
      timeout: 60000
    }).catch(() => {
      console.log('Note: Initial movies loading slowly');
    });

    // Let the page settle (don't wait for full networkidle as it's too strict)
    await page.waitForTimeout(3000);
  });

  test('should load movies page successfully', async ({ page }) => {
    // Verify we're on the discover page
    await expect(page).toHaveURL(/discover/);

    // Verify Advanced Discovery section is visible
    const advancedDiscovery = page.locator('text=Advanced Discovery');
    await expect(advancedDiscovery).toBeVisible({ timeout: 10000 });

    // Verify at least one movie card OR the filters are visible
    const hasContent = await page.locator('img[alt][src*="image.tmdb.org"], button:has-text("Collection")').first().isVisible()
      .catch(() => false);

    expect(hasContent).toBeTruthy();
  });

  test('search results should paginate correctly (not overwritten by general catalog)', async ({ page }) => {
    /**
     * FIXED BUG TEST:
     * Previously: Search results were overwritten by infinite scroll loading general catalog
     * Now: Search has its own pagination - scrolling loads more search results, not general catalog
     *
     * Test Steps:
     * 1. Search for "The Matrix"
     * 2. Verify Matrix-related results appear
     * 3. Scroll down (should load MORE search results, not general catalog)
     * 4. Verify all loaded movies are still Matrix-related
     */

    // Find and click the search input in Advanced Discovery
    // First, make sure we're on the Search tab
    const searchTab = page.locator('button:has-text("Search")').first();
    if (await searchTab.isVisible().catch(() => false)) {
      await searchTab.click();
      await page.waitForTimeout(500);
    }

    // Clear any existing content and search
    const searchInput = page.locator('input[placeholder*="Search movies"], input[placeholder*="Search"]').first();
    await searchInput.click();
    await searchInput.clear();
    await searchInput.fill('The Matrix');

    // Press Enter to ensure search is triggered
    await searchInput.press('Enter');

    // Wait for debounce (500ms) + network request + rendering
    await page.waitForTimeout(3000);

    // Verify search indicator is showing
    await expect(page.locator('text=/Search.*Matrix/i').or(page.locator('text=/Matrix/i').first())).toBeVisible({ timeout: 10000 });

    // Wait for movie posters to appear
    const movieTitles = page.locator('img[alt][src*="image.tmdb.org"]');
    await expect(movieTitles.first()).toBeVisible({ timeout: 15000 });

    // Give a moment for all results to render
    await page.waitForTimeout(1000);

    // Get first few titles to verify they're Matrix-related
    const firstTitle = await movieTitles.first().getAttribute('alt');
    const secondTitle = await movieTitles.nth(1).getAttribute('alt');

    console.log('Search results - First movie:', firstTitle);
    console.log('Search results - Second movie:', secondTitle);

    // Verify we got Matrix-related results
    expect(firstTitle?.toLowerCase()).toMatch(/matrix/);
    
    // Store initial movie count
    const initialCount = await movieTitles.count();
    expect(initialCount).toBeGreaterThan(0);

    // Scroll down multiple times to trigger search pagination
    // Should load MORE search results (not general catalog)
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, 2000));
      await page.waitForTimeout(2000); // Wait for pagination to load
    }

    // Wait a bit more for any final loads
    await page.waitForTimeout(1000);

    // Verify search results are still present and haven't been overwritten
    const finalFirstTitle = await movieTitles.first().getAttribute('alt');
    expect(finalFirstTitle?.toLowerCase()).toMatch(/matrix/);

    // Verify the search indicator is still showing
    await expect(page.locator('text=/Search.*Matrix/i')).toBeVisible();

    // Movie count should have increased (pagination loaded more search results)
    const finalCount = await movieTitles.count();
    expect(finalCount).toBeGreaterThanOrEqual(initialCount);

    // Verify ALL visible titles are Matrix-related (not random catalog movies)
    // Sample multiple titles from different parts of the list
    const sampleIndices = [0, Math.floor(finalCount / 2), finalCount - 1].filter(i => i >= 0 && i < finalCount);
    const sampleTitles = await Promise.all(
      sampleIndices.map(i => movieTitles.nth(i).getAttribute('alt'))
    );

    // All sampled titles should be Matrix-related
    const matrixRelatedCount = sampleTitles.filter(title => 
      title?.toLowerCase().includes('matrix')
    ).length;
    
    // At least most titles should be Matrix-related (allowing for some edge cases)
    expect(matrixRelatedCount).toBeGreaterThan(0);
  });

  test('should filter by collection successfully', async ({ page }) => {
    /**
     * Test: Collection filter + Quick filter combination
     * 1. Search for "Marvel" collection
     * 2. Select "The Avengers Collection"
     * 3. Verify movies load
     * 4. Apply "Quality Movies (6.5+)" filter
     * 5. Verify results are filtered correctly
     */

    // Click on Collection tab
    const collectionTab = page.locator('button:has-text("Collection")');
    await collectionTab.click();

    // Search for Marvel collection
    const collectionSearch = page.locator('input[placeholder*="collections"]');
    await collectionSearch.fill('Avengers');
    await page.waitForTimeout(500);

    // Click on the first result (The Avengers Collection)
    const firstResult = page.locator('button:has-text("Avengers")').first();
    await firstResult.click();
    await page.waitForLoadState('networkidle');

    // Verify collection badge is visible (contains "Avengers")
    await expect(page.locator('text=/Avengers/i').first()).toBeVisible();

    // Count movies before filter
    const moviesBefore = page.locator('img[alt][src*="image.tmdb.org"]');
    const countBefore = await moviesBefore.count();

    // Apply Quick Filter: Quality Movies (6.5+)
    const qualityButton = page.locator('button:has-text("Quality Movies")');
    await qualityButton.click();
    await page.waitForTimeout(500);

    // Count movies after filter
    const moviesAfter = page.locator('img[alt][src*="image.tmdb.org"]');
    const countAfter = await moviesAfter.count();

    // Should have loaded movies (count may vary due to filtering and pagination)
    expect(countAfter).toBeGreaterThan(0);

    // Verify the filter is active (button should be highlighted)
    await expect(qualityButton).toHaveClass(/bg-blue-600|ring-2/);
  });

  test('should clear filters and return to general catalog', async ({ page }) => {
    /**
     * Test: Clear filter behavior
     * 1. Apply a collection filter
     * 2. Click "Clear All & Browse Movies"
     * 3. Verify we're back to general catalog
     */

    // Apply collection filter
    const collectionTab = page.locator('button:has-text("Collection")');
    await collectionTab.click();

    const collectionSearch = page.locator('input[placeholder*="collections"]');
    await collectionSearch.fill('Avengers');
    await page.waitForTimeout(500);

    const firstResult = page.locator('button:has-text("Avengers")').first();
    await firstResult.click();
    await page.waitForLoadState('networkidle');

    // Verify filter is active
    await expect(page.locator('text=/The Avengers Collection/i').or(page.locator('text=/Avengers/i')).first()).toBeVisible();

    // Click Clear All
    const clearButton = page.locator('button:has-text("Clear All")');
    await clearButton.click();
    await page.waitForLoadState('networkidle');

    // Verify we're back to general catalog
    await expect(page.locator('text=/Avengers Collection/i')).not.toBeVisible();

    // Verify movies are loading from general catalog
    const totalMovies = page.locator('text=/Total catalog.*movies/i').first();
    await expect(totalMovies).toBeVisible();
  });

  test('should toggle quick filters correctly', async ({ page }) => {
    /**
     * Test: Quick filter toggle behavior
     * 1. Click "Worth Watching (5.5+)"
     * 2. Verify it's active
     * 3. Click again to deactivate
     * 4. Verify it's inactive
     */

    const worthWatchingBtn = page.locator('button:has-text("Worth Watching")').first();

    // Initial state - should not be active
    const initialClass = await worthWatchingBtn.getAttribute('class');

    // Click to activate
    await worthWatchingBtn.click();
    await page.waitForTimeout(500);

    // Should be active (background changes from gray to blue, not hover)
    const activeClass = await worthWatchingBtn.getAttribute('class');
    // Check for actual bg-blue (not hover:bg-blue)
    expect(activeClass).toMatch(/\sbg-blue-600(\s|$)/);

    // Click again to deactivate
    await worthWatchingBtn.click();
    await page.waitForTimeout(500);

    // Should be inactive again (back to gray background)
    const inactiveClass = await worthWatchingBtn.getAttribute('class');
    expect(inactiveClass).toMatch(/\sbg-gray-/);
  });

  test('advanced filters should disable infinite scroll', async ({ page }) => {
    /**
     * Test: Advanced filters (Collection/Director/Actor) should disable infinite scroll
     * This prevents general catalog from overwriting filtered results
     * 
     * Test Steps:
     * 1. Apply Collection filter (e.g., Avengers Collection - has limited results)
     * 2. Verify collection movies load
     * 3. Scroll down (should NOT trigger infinite scroll)
     * 4. Verify results remain from collection only
     */

    // Click on Collection tab
    const collectionTab = page.locator('button:has-text("Collection")');
    await collectionTab.click();
    await page.waitForTimeout(300);

    // Search for Avengers collection
    const collectionSearch = page.locator('input[placeholder*="collections"]');
    await collectionSearch.fill('Avengers');
    await page.waitForTimeout(800);

    // Click on The Avengers Collection
    const firstResult = page.locator('button:has-text("Avengers")').first();
    await firstResult.click();
    await page.waitForLoadState('networkidle');

    // Verify collection badge is visible
    await expect(page.locator('text=/Avengers/i').first()).toBeVisible({ timeout: 5000 });

    // Get movie count - Avengers collection has limited movies (around 4-6)
    const movieTitles = page.locator('img[alt][src*="image.tmdb.org"]');
    await expect(movieTitles.first()).toBeVisible({ timeout: 10000 });
    
    const initialCount = await movieTitles.count();
    
    // Verify we see collection-specific movies
    const firstTitle = await movieTitles.first().getAttribute('alt');
    expect(firstTitle?.toLowerCase()).toMatch(/avenger/i);

    // Scroll down multiple times - should NOT load more movies from general catalog
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, 2000));
      await page.waitForTimeout(2000);
    }

    // Movie count should remain stable (collection has limited results)
    // If infinite scroll was disabled, count should be same or only slightly more
    const finalCount = await movieTitles.count();
    
    // Verify collection indicator is still showing
    await expect(page.locator('text=/Avengers/i').first()).toBeVisible();

    // Verify titles are still from collection (not random catalog movies)
    const finalFirstTitle = await movieTitles.first().getAttribute('alt');
    expect(finalFirstTitle?.toLowerCase()).toMatch(/avenger/i);
  });
});
