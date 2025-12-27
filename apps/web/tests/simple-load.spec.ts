import { test, expect } from '@playwright/test';

test.describe('Simple Page Load Test', () => {
  test('check if movies page renders at all', async ({ page }) => {
    // Enable console logging
    page.on('console', msg => console.log('BROWSER:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error));

    console.log('1. Navigating to /discover?tab=movies...');
    await page.goto('/discover?tab=movies', { waitUntil: 'networkidle', timeout: 60000 });

    console.log('2. Current URL:', page.url());

    // Take screenshot
    await page.screenshot({ path: 'test-results/simple-load.png', fullPage: true });

    // Get page title
    const title = await page.title();
    console.log('3. Page title:', title);

    // Check if React root exists
    const rootExists = await page.locator('#root').isVisible();
    console.log('4. React root visible:', rootExists);

    // Get any text content
    const bodyText = await page.locator('body').textContent();
    console.log('5. Body text (first 500 chars):', bodyText?.substring(0, 500));

    // Check for specific elements
    const hasNavigation = await page.locator('nav, [role="navigation"]').count();
    console.log('6. Navigation elements:', hasNavigation);

    const hasSidebar = await page.locator('aside, .sidebar').count();
    console.log('7. Sidebar elements:', hasSidebar);

    const hasHeadings = await page.locator('h1, h2, h3').count();
    console.log('8. Heading elements:', hasHeadings);

    // Basic assertion
    expect(rootExists).toBe(true);
  });
});
