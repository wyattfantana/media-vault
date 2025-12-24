import { test, expect } from '@playwright/test';

test.describe('TV Shows - Diagnostic', () => {
  test('check what elements are visible on TV Shows page', async ({ page }) => {
    await page.goto('/discover', { waitUntil: 'domcontentloaded' });

    // Click TV Shows tab
    const tvShowsTab = page.locator('button:has-text("TV Shows")').first();
    await tvShowsTab.click();
    await page.waitForTimeout(2000);

    // Take a screenshot
    await page.screenshot({ path: 'tv-shows-diagnostic.png', fullPage: true });

    // Check for various elements
    const advancedDiscovery = await page.locator('text=Advanced Discovery').count();
    const allShows = await page.locator('text=📺 All TV Shows').count();
    const additionalFilters = await page.locator('text=Show Additional Filters').count();
    const hideFilters = await page.locator('text=Hide Additional Filters').count();

    console.log('====== TV SHOWS PAGE DIAGNOSTIC ======');
    console.log(`Advanced Discovery sections: ${advancedDiscovery}`);
    console.log(`"📺 All TV Shows" text: ${allShows}`);
    console.log(`"Show Additional Filters" button: ${additionalFilters}`);
    console.log(`"Hide Additional Filters" button: ${hideFilters}`);

    // Log all h3 elements
    const h3Elements = await page.locator('h3').allTextContents();
    console.log('All H3 elements:',h3Elements);

    // Log all visible buttons
    const buttons = await page.locator('button:visible').allTextContents();
    console.log('Sample of visible buttons:', buttons.slice(0, 20));

    expect(true).toBeTruthy(); // Always pass
  });
});
