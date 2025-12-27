import { test, expect } from '@playwright/test';

/**
 * TV Shows Advanced Filter Tests
 * Verifies that filters work correctly and return TV shows, not movies
 */

async function authenticate(page: any) {
  await page.goto('/sign-in', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1000);
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  await page.locator('input[type="email"]').fill('test@example.com');
  await page.locator('input[type="password"]').fill('TestPass123');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/(dashboard|discover|favorites|downloads|settings)/, { timeout: 30000 });
  await page.waitForTimeout(2000);
}

test.describe('TV Shows Advanced Filters', () => {
  test.beforeEach(async ({ page }) => {
    await authenticate(page);
    await page.goto('/discover?tab=tvshows', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('img[src*="image.tmdb.org"]', { timeout: 30000 });
    await page.waitForTimeout(1000);
  });

  test('Actor filter returns TV shows, not movies', async ({ page }) => {
    // Click on Actor tab
    await page.locator('button:has-text("Actor"):visible').click();
    await page.waitForTimeout(500);

    // Search for Bryan Cranston
    const actorInput = page.locator('input[placeholder*="actors"]');
    await expect(actorInput).toBeVisible({ timeout: 5000 });
    await actorInput.fill('Bryan Cranston');
    await page.waitForTimeout(2000);

    // Wait for dropdown results (they appear in a div with text content)
    const dropdown = page.locator('.bg-gray-900.border-2.border-blue-500\\/50');
    await expect(dropdown).toBeVisible({ timeout: 10000 });

    // Click on the first result containing Bryan Cranston
    await dropdown.locator('button').first().click();
    await page.waitForTimeout(3000);

    // Wait for results to load
    await page.waitForSelector('img[src*="image.tmdb.org"]', { timeout: 15000 });

    // Get all visible show titles from the card titles
    const titles = await page.locator('[class*="line-clamp"]').allTextContents();
    console.log('Results for Bryan Cranston:', titles.slice(0, 15));

    // These are TV shows Bryan Cranston is known for
    const expectedTVShows = ['Breaking Bad', 'Malcolm in the Middle', 'Your Honor', 'Seinfeld'];
    // These are movies that should NOT appear
    const unexpectedMovies = ['Saving Private Ryan', 'Kung Fu Panda', 'Drive', 'Godzilla', 'Total Recall', 'Little Miss Sunshine'];

    // Check that at least one expected TV show appears
    const foundExpected = expectedTVShows.some(show =>
      titles.some(t => t.toLowerCase().includes(show.toLowerCase()))
    );

    // Check that no movies appear
    const foundUnexpected = unexpectedMovies.some(movie =>
      titles.some(t => t.toLowerCase().includes(movie.toLowerCase()))
    );

    console.log('Found expected TV show:', foundExpected);
    console.log('Found unexpected movie:', foundUnexpected);

    // Breaking Bad should be there
    expect(foundExpected).toBe(true);
    // Movies should NOT be there
    expect(foundUnexpected).toBe(false);
  });

  test('Creator filter returns TV shows', async ({ page }) => {
    // Click on Creator tab
    await page.locator('button:has-text("Creator"):visible').click();
    await page.waitForTimeout(500);

    // Search for Vince Gilligan
    const creatorInput = page.locator('input[placeholder*="creators"]');
    await expect(creatorInput).toBeVisible({ timeout: 5000 });
    await creatorInput.fill('Vince Gilligan');
    await page.waitForTimeout(2000);

    // Wait for dropdown results
    const dropdown = page.locator('.bg-gray-900.border-2.border-blue-500\\/50, .bg-gray-900.border-2');
    await expect(dropdown.first()).toBeVisible({ timeout: 10000 });

    // Click on the first result
    await dropdown.first().locator('button').first().click();
    await page.waitForTimeout(3000);

    // Wait for results
    await page.waitForSelector('img[src*="image.tmdb.org"]', { timeout: 15000 });

    const titles = await page.locator('[class*="line-clamp"]').allTextContents();
    console.log('Results for Vince Gilligan:', titles.slice(0, 10));

    // Should include Breaking Bad or Better Call Saul
    const expectedShows = ['Breaking Bad', 'Better Call Saul'];
    const foundExpected = expectedShows.some(show =>
      titles.some(t => t.toLowerCase().includes(show.toLowerCase()))
    );

    expect(foundExpected).toBe(true);
  });

  test('Network filter returns TV shows', async ({ page }) => {
    // Click on Network tab
    await page.locator('button:has-text("Network"):visible').click();
    await page.waitForTimeout(500);

    // Search for HBO
    const networkInput = page.locator('input[placeholder*="networks"]');
    await expect(networkInput).toBeVisible({ timeout: 5000 });
    await networkInput.fill('HBO');
    await page.waitForTimeout(2000);

    // Wait for dropdown results
    const dropdown = page.locator('.bg-gray-900.border-2');
    await expect(dropdown.first()).toBeVisible({ timeout: 10000 });

    // Click on HBO result
    await dropdown.first().locator('button').first().click();
    await page.waitForTimeout(3000);

    // Wait for results
    await page.waitForSelector('img[src*="image.tmdb.org"]', { timeout: 15000 });

    const titles = await page.locator('[class*="line-clamp"]').allTextContents();
    console.log('Results for HBO:', titles.slice(0, 10));

    // HBO TV shows
    const expectedShows = ['Game of Thrones', 'The Sopranos', 'The Wire', 'Succession', 'House of the Dragon', 'Euphoria', 'True Detective', 'Westworld'];
    const foundExpected = expectedShows.some(show =>
      titles.some(t => t.toLowerCase().includes(show.toLowerCase()))
    );

    expect(foundExpected).toBe(true);
  });
});
