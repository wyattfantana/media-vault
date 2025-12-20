import { Page, expect } from '@playwright/test';

/**
 * Test helper functions for MediaVault filter testing
 * These provide robust, reusable utilities to avoid flaky tests
 */

export class FilterHelpers {
  constructor(private page: Page) {}

  /**
   * Wait for movies to be loaded and visible
   * More robust than arbitrary timeouts
   */
  async waitForMoviesToLoad(minCount: number = 1, timeout: number = 30000) {
    await this.page.waitForFunction(
      (count) => {
        const movies = document.querySelectorAll('img[src*="image.tmdb.org"]');
        return movies.length >= count;
      },
      minCount,
      { timeout }
    );
  }

  /**
   * Wait for the movie grid to stabilize (no new movies loading)
   */
  async waitForGridStable(stabilityMs: number = 1000) {
    let lastCount = 0;
    let stableFor = 0;
    const checkInterval = 200;
    const maxWait = 10000;
    let totalWait = 0;

    while (stableFor < stabilityMs && totalWait < maxWait) {
      await this.page.waitForTimeout(checkInterval);
      const currentCount = await this.page.locator('img[src*="image.tmdb.org"]').count();

      if (currentCount === lastCount) {
        stableFor += checkInterval;
      } else {
        stableFor = 0;
        lastCount = currentCount;
      }

      totalWait += checkInterval;
    }
  }

  /**
   * Perform a movie search with proper waiting
   */
  async searchMovies(query: string) {
    // Ensure we're on the Search tab
    const searchTab = this.page.locator('button:has-text("Search")').first();
    if (await searchTab.isVisible().catch(() => false)) {
      await searchTab.click();
      await this.page.waitForTimeout(300);
    }

    // Find and fill search input
    const searchInput = this.page.locator('input[placeholder*="Search movies"], input[placeholder*="Search"]').first();
    await searchInput.waitFor({ state: 'visible', timeout: 10000 });
    await searchInput.clear();
    await searchInput.fill(query);
    await searchInput.press('Enter');

    // Wait for debounce + search to execute
    await this.page.waitForTimeout(1000);

    // Wait for search indicator or results
    await this.waitForMoviesToLoad(1, 20000);

    // Wait for grid to stabilize
    await this.waitForGridStable(1500);
  }

  /**
   * Select a collection filter
   */
  async selectCollection(collectionName: string) {
    // Click Collection tab
    const collectionTab = this.page.locator('button:has-text("Collection")').first();
    await collectionTab.click();
    await this.page.waitForTimeout(300);

    // Search for collection
    const collectionSearch = this.page.locator('input[placeholder*="collections"]').first();
    await collectionSearch.fill(collectionName);
    await this.page.waitForTimeout(800); // Debounce

    // Click first result
    const firstResult = this.page.locator(`button:has-text("${collectionName}")`).first();
    await firstResult.waitFor({ state: 'visible', timeout: 10000 });
    await firstResult.click();

    // Wait for collection movies to load
    await this.waitForMoviesToLoad(1, 20000);
    await this.waitForGridStable(1500);
  }

  /**
   * Click a quick filter button
   */
  async clickQuickFilter(filterName: 'Worth Watching' | 'Quality Movies' | 'Elite Only') {
    const button = this.page.locator(`button:has-text("${filterName}")`).first();
    await button.waitFor({ state: 'visible', timeout: 10000 });
    await button.click();

    // Wait for filter to apply
    await this.page.waitForTimeout(1000);
    await this.waitForGridStable(1500);
  }

  /**
   * Clear all filters
   */
  async clearAllFilters() {
    const clearButton = this.page.locator('button:has-text("Clear All")').first();
    if (await clearButton.isVisible().catch(() => false)) {
      await clearButton.click();
      await this.page.waitForTimeout(500);
      await this.waitForMoviesToLoad(1, 20000);
      await this.waitForGridStable(1500);
    }
  }

  /**
   * Get movie titles currently visible
   */
  async getVisibleMovieTitles(maxCount: number = 20): Promise<string[]> {
    const titles: string[] = [];
    const movieImages = this.page.locator('img[src*="image.tmdb.org"]');
    const count = Math.min(await movieImages.count(), maxCount);

    for (let i = 0; i < count; i++) {
      const title = await movieImages.nth(i).getAttribute('alt');
      if (title) titles.push(title.toLowerCase());
    }

    return titles;
  }

  /**
   * Verify movies match a pattern
   */
  async verifyMoviesMatch(pattern: RegExp, minMatches: number = 1) {
    const titles = await this.getVisibleMovieTitles();
    const matches = titles.filter(title => pattern.test(title));
    expect(matches.length).toBeGreaterThanOrEqual(minMatches);
    return matches;
  }

  /**
   * Get current movie count
   */
  async getMovieCount(): Promise<number> {
    return await this.page.locator('img[src*="image.tmdb.org"]').count();
  }

  /**
   * Scroll page to trigger infinite scroll
   */
  async scrollAndWait(scrollAmount: number = 2000, times: number = 1) {
    for (let i = 0; i < times; i++) {
      await this.page.evaluate((amount) => window.scrollBy(0, amount), scrollAmount);
      await this.page.waitForTimeout(1000);
    }

    // Wait for any new movies to load
    await this.waitForGridStable(1500);
  }
}
