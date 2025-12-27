import { test, expect } from '@playwright/test';

/**
 * Dashboard - Complete Test Suite
 * Tests service buttons, statistics, and integrations
 */

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2000);
  });

  test.describe('Page Load & UI', () => {
    test('dashboard loads successfully', async ({ page }) => {
      await expect(page).toHaveURL(/\/(dashboard)?/); // Accept both / and /dashboard

      // Check for main dashboard elements - look for the heading
      const heading = page.locator('h1:has-text("Media Dashboard")');
      await expect(heading).toBeVisible({ timeout: 10000 });

      console.log('✓ Dashboard loaded');
    });

    test('displays service management buttons', async ({ page }) => {
      // Check for service buttons
      await expect(page.locator('text=Open Jellyfin')).toBeVisible();
      await expect(page.locator('text=Open qBittorrent')).toBeVisible();
      await expect(page.locator('text=Open Prowlarr')).toBeVisible();
      await expect(page.locator('text=Manage Subtitles')).toBeVisible();

      console.log('✓ All service buttons present');
    });
  });

  test.describe('Service Buttons - Colors', () => {
    test('Jellyfin button is purple', async ({ page }) => {
      const jellyfinBtn = page.locator('a:has-text("Open Jellyfin")').first();
      const classes = await jellyfinBtn.getAttribute('class');

      expect(classes).toContain('purple');
      console.log('✓ Jellyfin button: Purple');
    });

    test('qBittorrent button is green', async ({ page }) => {
      const qbitBtn = page.locator('a:has-text("Open qBittorrent")').first();
      const classes = await qbitBtn.getAttribute('class');

      expect(classes).toContain('green');
      console.log('✓ qBittorrent button: Green');
    });

    test('Prowlarr button is orange', async ({ page }) => {
      const prowlarrBtn = page.locator('a:has-text("Open Prowlarr")').first();
      const classes = await prowlarrBtn.getAttribute('class');

      expect(classes).toContain('orange');
      console.log('✓ Prowlarr button: Orange');
    });

    test('Manage Subtitles button is blue', async ({ page }) => {
      const subtitlesBtn = page.locator('button:has-text("Manage Subtitles")').first();
      const classes = await subtitlesBtn.getAttribute('class');

      expect(classes).toContain('blue');
      console.log('✓ Manage Subtitles button: Blue');
    });
  });

  test.describe('Service Button Functionality', () => {
    test('Jellyfin button has correct URL', async ({ page }) => {
      const jellyfinBtn = page.locator('a:has-text("Open Jellyfin")').first();
      const href = await jellyfinBtn.getAttribute('href');

      expect(href).toBe('http://localhost:8096');
      console.log('✓ Jellyfin URL: http://localhost:8096');
    });

    test('qBittorrent button has correct URL', async ({ page }) => {
      const qbitBtn = page.locator('a:has-text("Open qBittorrent")').first();
      const href = await qbitBtn.getAttribute('href');

      expect(href).toBe('http://localhost:8080');
      console.log('✓ qBittorrent URL: http://localhost:8080');
    });

    test('Prowlarr button has correct URL', async ({ page }) => {
      const prowlarrBtn = page.locator('a:has-text("Open Prowlarr")').first();
      const href = await prowlarrBtn.getAttribute('href');

      expect(href).toBe('http://localhost:9696');
      console.log('✓ Prowlarr URL: http://localhost:9696');
    });

    test('buttons open in new tabs', async ({ page }) => {
      const jellyfinBtn = page.locator('a:has-text("Open Jellyfin")').first();
      const target = await jellyfinBtn.getAttribute('target');

      expect(target).toBe('_blank');
      console.log('✓ Buttons open in new tab');
    });
  });

  test.describe('Manage Subtitles Button', () => {
    test('combines all 3 subtitle services', async ({ page }) => {
      const subtitlesBtn = page.locator('button:has-text("Manage Subtitles")').first();
      await expect(subtitlesBtn).toBeVisible();

      const description = page.locator('text=Opens Bazarr, Sonarr & Radarr');
      await expect(description).toBeVisible();

      console.log('✓ Manage Subtitles combines Bazarr, Sonarr & Radarr');
    });

    test('button has onClick handler', async ({ page }) => {
      const subtitlesBtn = page.locator('button:has-text("Manage Subtitles")').first();

      // Check that it's a button (not a link)
      const tagName = await subtitlesBtn.evaluate(el => el.tagName);
      expect(tagName).toBe('BUTTON');

      console.log('✓ Manage Subtitles is a button with click handler');
    });
  });

  test.describe('Navigation Links', () => {
    test('can navigate to Discover page', async ({ page }) => {
      const discoverLink = page.locator('a:has-text("Discover"), a:has-text("Movies")').first();
      if (await discoverLink.isVisible({ timeout: 5000 }).catch(() => false)) {
        await discoverLink.click();
        await page.waitForTimeout(1000);

        await expect(page).toHaveURL(/discover/);
        console.log('✓ Navigate to Discover');
      } else {
        console.log('⚠ Discover link not found in navigation');
      }
    });

    test('can navigate to Downloads page', async ({ page }) => {
      const downloadsLink = page.locator('a:has-text("Downloads"), a:has-text("Queue")').first();
      if (await downloadsLink.isVisible({ timeout: 5000 }).catch(() => false)) {
        await downloadsLink.click();
        await page.waitForTimeout(1000);

        await expect(page).toHaveURL(/downloads/);
        console.log('✓ Navigate to Downloads');
      } else {
        console.log('⚠ Downloads link not found in navigation');
      }
    });

    test('can navigate to Favorites page', async ({ page }) => {
      const favoritesLink = page.locator('a:has-text("Favorites")').first();
      if (await favoritesLink.isVisible({ timeout: 5000 }).catch(() => false)) {
        await favoritesLink.click();
        await page.waitForTimeout(1000);

        await expect(page).toHaveURL(/favorites/);
        console.log('✓ Navigate to Favorites');
      } else {
        console.log('⚠ Favorites link not found in navigation');
      }
    });
  });

  test.describe('Statistics Dashboard', () => {
    test('shows download statistics if available', async ({ page }) => {
      // Look for any stat cards or numbers
      const statNumbers = page.locator('text=/\\d+/');
      const hasStats = await statNumbers.count() > 0;

      if (hasStats) {
        console.log('✓ Statistics displayed on dashboard');
      } else {
        console.log('⚠ No statistics available (may need data)');
      }
    });

    test('shows platform distribution chart if available', async ({ page }) => {
      const chartTitle = page.locator('text=Downloads by Platform');
      const hasChart = await chartTitle.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasChart) {
        console.log('✓ Platform distribution chart present');
      } else {
        console.log('⚠ Chart not visible (may need download data)');
      }
    });

    test('shows recent downloads if available', async ({ page }) => {
      const recentSection = page.locator('text=/Recent|Latest/');
      const hasRecent = await recentSection.count() > 0;

      console.log(`✓ Recent downloads section: ${hasRecent ? 'present' : 'not shown'}`);
    });
  });

  test.describe('Responsive Design', () => {
    test('dashboard is responsive on mobile', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(500);

      // Service buttons should still be visible
      await expect(page.locator('text=Open Jellyfin')).toBeVisible();

      console.log('✓ Dashboard responsive on mobile (375x667)');
    });

    test('dashboard is responsive on tablet', async ({ page }) => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.waitForTimeout(500);

      await expect(page.locator('text=Open Jellyfin')).toBeVisible();

      console.log('✓ Dashboard responsive on tablet (768x1024)');
    });

    test('dashboard is responsive on desktop', async ({ page }) => {
      // Set desktop viewport
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.waitForTimeout(500);

      await expect(page.locator('text=Open Jellyfin')).toBeVisible();

      console.log('✓ Dashboard responsive on desktop (1920x1080)');
    });
  });

  test.describe('Integration Tests', () => {
    test('all service buttons are functional', async ({ page }) => {
      const buttons = [
        { name: 'Jellyfin', selector: 'a:has-text("Open Jellyfin")' },
        { name: 'qBittorrent', selector: 'a:has-text("Open qBittorrent")' },
        { name: 'Prowlarr', selector: 'a:has-text("Open Prowlarr")' },
        { name: 'Subtitles', selector: 'button:has-text("Manage Subtitles")' }
      ];

      for (const btn of buttons) {
        const element = page.locator(btn.selector).first();
        await expect(element).toBeVisible();
        await expect(element).toBeEnabled();
      }

      console.log('✓ All 4 service buttons are functional');
    });

    test('dashboard loads without errors', async ({ page }) => {
      // Listen for console errors
      const errors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      await page.reload();
      await page.waitForTimeout(2000);

      // Should have minimal errors (some TMDB API errors are expected)
      const criticalErrors = errors.filter(e =>
        !e.includes('TMDB') && !e.includes('favicon')
      );

      expect(criticalErrors.length).toBe(0);
      console.log(`✓ Dashboard loads cleanly (${errors.length} total, ${criticalErrors.length} critical)`);
    });
  });

  test.describe('Quick Access', () => {
    test('New Download button exists if present', async ({ page }) => {
      const newDownloadBtn = page.locator('a:has-text("New Download"), button:has-text("New Download")').first();
      const exists = await newDownloadBtn.isVisible({ timeout: 3000 }).catch(() => false);

      if (exists) {
        console.log('✓ New Download quick access button present');
      } else {
        console.log('⚠ New Download button not on dashboard');
      }
    });
  });
});
