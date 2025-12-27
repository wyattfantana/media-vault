import { test, expect } from '@playwright/test';

test('debug documentaries tab switching', async ({ page }) => {
  // Clear localStorage to avoid interference
  await page.goto('/discover?tab=movies');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  console.log('1. Cleared storage, navigating to documentaries...');
  await page.goto('/discover?tab=documentaries', { waitUntil: 'domcontentloaded', timeout: 60000 });

  // Listen for console logs and API calls
  page.on('console', msg => {
    if (msg.text().includes('Documentaries') || msg.text().includes('documentary') || msg.text().includes('Loading')) {
      console.log('   BROWSER LOG:', msg.text());
    }
  });

  page.on('response', response => {
    if (response.url().includes('documentary') || response.url().includes('tmdb')) {
      console.log('   API RESPONSE:', response.status(), response.url().substring(0, 100));
    }
  });

  await page.waitForTimeout(5000); // Wait longer to see if API calls happen

  // Get the URL
  const url = page.url();
  console.log('2. Current URL:', url);

  // Check what's in localStorage
  const savedTab = await page.evaluate(() => localStorage.getItem('discover-active-tab'));
  const savedBrowseState = await page.evaluate(() => localStorage.getItem('documentariesBrowseState'));
  const moviesBrowseState = await page.evaluate(() => localStorage.getItem('moviesBrowseState'));
  const tvBrowseState = await page.evaluate(() => localStorage.getItem('tvShowsBrowseState'));
  console.log('3. localStorage tab:', savedTab);
  console.log('3b. documentariesBrowseState:', savedBrowseState ? 'EXISTS (cached data)' : 'null');
  console.log('3c. moviesBrowseState:', moviesBrowseState ? 'EXISTS (cached data)' : 'null');
  console.log('3d. tvShowsBrowseState:', tvBrowseState ? 'EXISTS (cached data)' : 'null');

  // Check which tab buttons are active
  const activeTabButton = await page.evaluate(() => {
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      if (btn.textContent?.includes('Documentaries') && btn.className.includes('border-brand')) {
        return { text: btn.textContent, classes: btn.className };
      }
    }
    return null;
  });
  console.log('4. Active tab button:', activeTabButton);

  // Check which content div is visible
  const visibleContent = await page.evaluate(() => {
    const divs = document.querySelectorAll('div[class*="block"], div[class*="hidden"]');
    const results: any[] = [];
    for (const div of divs) {
      const classes = div.className;
      if (classes.includes('animate-fadeIn') || classes.includes('hidden')) {
        const hasMovies = div.textContent?.includes('All Movies');
        const hasTVShows = div.textContent?.includes('All TV Shows');
        const hasDocs = div.textContent?.includes('All Documentaries') || div.textContent?.includes('All Docs');

        if (hasMovies || hasTVShows || hasDocs) {
          results.push({
            content: hasMovies ? 'Movies' : hasTVShows ? 'TV Shows' : 'Documentaries',
            classes: classes,
            isVisible: classes.includes('block') && !classes.includes('hidden')
          });
        }
      }
    }
    return results;
  });
  console.log('5. Content divs:', JSON.stringify(visibleContent, null, 2));

  // Check what images are present IN THE VISIBLE DIV ONLY
  const images = await page.evaluate(() => {
    // Find the visible content div (not hidden)
    const visibleDiv = Array.from(document.querySelectorAll('div')).find(div =>
      div.className.includes('block') &&
      div.className.includes('animate-fadeIn') &&
      !div.className.includes('hidden')
    );

    if (!visibleDiv) {
      return { count: 0, sampleTitles: [], error: 'No visible div found' };
    }

    const imgs = visibleDiv.querySelectorAll('img[src*="image.tmdb.org"]');
    const titles = Array.from(imgs).slice(0, 5).map(img => ({
      alt: img.getAttribute('alt'),
      src: img.getAttribute('src')?.substring(0, 80)
    }));
    return { count: imgs.length, sampleTitles: titles };
  });
  console.log('6. Images found IN VISIBLE DIV:', images);

  // Take a screenshot
  await page.screenshot({ path: 'test-results/debug-documentaries.png', fullPage: true });
  console.log('7. Screenshot saved to test-results/debug-documentaries.png');
});
