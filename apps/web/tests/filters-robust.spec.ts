import { test, expect } from '@playwright/test';
import { FilterHelpers } from './helpers/filter-helpers';

/**
 * Comprehensive MediaVault Movies Filter Tests
 * Using robust helpers to avoid flakiness
 */

test.describe('Movies Filter System - Robust', () => {
  let helpers: FilterHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new FilterHelpers(page);

    // Navigate to movies page
    await page.goto('/discover?tab=movies', { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Wait for page to be ready
    await page.waitForSelector('text=Advanced Discovery', { timeout: 60000 });

    // Wait for initial movies to load
    await helpers.waitForMoviesToLoad(5, 60000);
    await helpers.waitForGridStable(2000);
  });

  test('should load movies page with initial content', async ({ page }) => {
    // Verify we're on the correct page
    await expect(page).toHaveURL(/discover/);

    // Verify Advanced Discovery is visible
    await expect(page.locator('text=Advanced Discovery')).toBeVisible();

    // Verify movies are loaded
    const count = await helpers.getMovieCount();
    expect(count).toBeGreaterThan(0);
  });

  test('CRITICAL: search should return relevant results (not overwritten by catalog)', async ({ page }) => {
    // Search for The Matrix
    await helpers.searchMovies('The Matrix');

    // Verify we got Matrix-related results
    const matches = await helpers.verifyMoviesMatch(/matrix/i, 3);
    console.log(`✓ Found ${matches.length} Matrix movies`);

    // Store initial count
    const initialCount = await helpers.getMovieCount();

    // Scroll to trigger pagination
    await helpers.scrollAndWait(2000, 3);

    // Get titles after scroll
    const titlesAfterScroll = await helpers.getVisibleMovieTitles(10);

    // Verify results are STILL Matrix movies (not general catalog)
    const matrixAfterScroll = titlesAfterScroll.filter(t => /matrix/i.test(t));
    expect(matrixAfterScroll.length).toBeGreaterThan(0);

    console.log(`✓ After scroll: ${matrixAfterScroll.length}/${titlesAfterScroll.length} are Matrix movies`);
  });

  test('should filter by collection successfully', async ({ page }) => {
    // Select Avengers collection
    await helpers.selectCollection('Avengers');

    // Verify we got Avengers movies
    const matches = await helpers.verifyMoviesMatch(/avenger/i, 2);
    console.log(`✓ Found ${matches.length} Avengers movies`);

    // Verify collection is active
    await expect(page.locator('text=/Avengers/i').first()).toBeVisible();
  });

  test('should apply quick filter (Quality Movies)', async ({ page }) => {
    // Get initial count
    const countBefore = await helpers.getMovieCount();

    // Apply Quality Movies filter
    await helpers.clickQuickFilter('Quality Movies');

    // Verify movies are loaded
    const countAfter = await helpers.getMovieCount();
    expect(countAfter).toBeGreaterThan(0);

    console.log(`✓ Movies after Quality filter: ${countAfter}`);
  });

  test('should combine collection + quick filter', async ({ page }) => {
    // Select collection
    await helpers.selectCollection('Avengers');

    const collectionCount = await helpers.getMovieCount();

    // Apply quick filter on top of collection
    await helpers.clickQuickFilter('Quality Movies');

    // Wait for filter to apply
    await helpers.waitForGridStable(2000);

    const filteredCount = await helpers.getMovieCount();

    // Should still have movies
    expect(filteredCount).toBeGreaterThan(0);

    // Should be filtering collection movies (may be same or less)
    console.log(`✓ Collection: ${collectionCount} → Filtered: ${filteredCount}`);
  });

  test('should clear filters and return to catalog', async ({ page }) => {
    // Apply collection filter
    await helpers.selectCollection('Avengers');

    // Verify collection is active
    await expect(page.locator('text=/Avengers/i').first()).toBeVisible();

    // Clear all filters
    await helpers.clearAllFilters();

    // Verify we're back to general catalog
    await page.waitForTimeout(1000);

    const count = await helpers.getMovieCount();
    expect(count).toBeGreaterThan(0);

    console.log(`✓ After clear: ${count} movies loaded from catalog`);
  });

  test('should toggle quick filters on/off', async ({ page }) => {
    const worthWatchingBtn = page.locator('button:has-text("Worth Watching")').first();

    // Click to activate
    await worthWatchingBtn.click();
    await page.waitForTimeout(800);

    // Should have active class
    const activeClass = await worthWatchingBtn.getAttribute('class');
    expect(activeClass).toMatch(/bg-blue-600/);

    // Click to deactivate
    await worthWatchingBtn.click();
    await page.waitForTimeout(800);

    // Should return to inactive
    const inactiveClass = await worthWatchingBtn.getAttribute('class');
    expect(inactiveClass).toMatch(/bg-gray-/);
  });

  test('collection filter should disable infinite scroll', async ({ page }) => {
    // Select collection
    await helpers.selectCollection('Avengers');

    const countBefore = await helpers.getMovieCount();

    // Scroll multiple times
    await helpers.scrollAndWait(2000, 5);

    const countAfter = await helpers.getMovieCount();

    // Count should be stable or minimal increase (not loading general catalog)
    const increase = countAfter - countBefore;
    expect(increase).toBeLessThan(20); // Should not load pages of general catalog

    // Verify still showing collection
    await expect(page.locator('text=/Avengers/i').first()).toBeVisible();

    console.log(`✓ Scroll test: ${countBefore} → ${countAfter} (increase: ${increase})`);
  });
});
