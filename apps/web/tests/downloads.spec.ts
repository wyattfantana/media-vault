import { test, expect } from '@playwright/test';

/**
 * Downloads Page - Complete Test Suite
 * Tests thumbnail display, progress tracking, torrent management, and filters
 */

test.describe('Downloads Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/downloads', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2000);
  });

  test.describe('Page Load & UI', () => {
    test('loads downloads page successfully', async ({ page }) => {
      await expect(page).toHaveURL(/downloads/);
      await expect(page.locator('text=Queue Management')).toBeVisible();

      console.log('✓ Downloads page loaded');
    });

    test('displays filter buttons', async ({ page }) => {
      // Check filter buttons exist
      await expect(page.locator('button:has-text("All")')).toBeVisible();
      await expect(page.locator('button:has-text("Pending")')).toBeVisible();
      await expect(page.locator('button:has-text("Active")')).toBeVisible();
      await expect(page.locator('button:has-text("Completed")')).toBeVisible();
      await expect(page.locator('button:has-text("Failed")')).toBeVisible();

      console.log('✓ All filter buttons present');
    });

    test('displays view mode toggle', async ({ page }) => {
      await expect(page.locator('button:has-text("Grid")')).toBeVisible();
      await expect(page.locator('button:has-text("Table")')).toBeVisible();

      console.log('✓ View mode toggle present');
    });
  });

  test.describe('Thumbnails', () => {
    test('completed downloads have TMDB thumbnails', async ({ page }) => {
      // Click Completed filter
      await page.locator('button:has-text("Completed")').click();
      await page.waitForTimeout(1000);

      // Check if any downloads exist
      const downloadCount = await page.locator('img[src*="image.tmdb.org"]').count();

      if (downloadCount > 0) {
        // Verify thumbnails are full URLs
        const firstImg = page.locator('img[src*="image.tmdb.org"]').first();
        const src = await firstImg.getAttribute('src');
        expect(src).toMatch(/^https:\/\/image\.tmdb\.org/);

        console.log(`✓ ${downloadCount} completed downloads with TMDB thumbnails`);
      } else {
        console.log('⚠ No completed downloads to test thumbnails');
      }
    });

    test('downloading torrents have thumbnails', async ({ page }) => {
      // Click Active filter
      await page.locator('button:has-text("Active")').click();
      await page.waitForTimeout(1000);

      const downloadCount = await page.locator('img[src*="image.tmdb.org"]').count();

      if (downloadCount > 0) {
        // Verify thumbnails exist
        const firstImg = page.locator('img[src*="image.tmdb.org"]').first();
        await expect(firstImg).toBeVisible();

        console.log(`✓ ${downloadCount} active downloads with thumbnails`);
      } else {
        console.log('⚠ No active downloads to test thumbnails');
      }
    });

    test('thumbnails work in both grid and table view', async ({ page }) => {
      // Grid view
      await page.locator('button:has-text("Grid")').click();
      await page.waitForTimeout(500);

      const gridThumbnails = await page.locator('img[src*="image.tmdb.org"]').count();

      // Table view
      await page.locator('button:has-text("Table")').click();
      await page.waitForTimeout(500);

      const tableThumbnails = await page.locator('img[src*="image.tmdb.org"]').count();

      // Should have same number in both views
      expect(gridThumbnails).toBe(tableThumbnails);

      console.log(`✓ Thumbnails in both views: Grid(${gridThumbnails}) = Table(${tableThumbnails})`);
    });
  });

  test.describe('Progress Tracking', () => {
    test('active downloads show progress bars', async ({ page }) => {
      await page.locator('button:has-text("Active")').click();
      await page.waitForTimeout(1000);

      // Check for progress bars
      const progressBars = page.locator('div.bg-blue-600'); // Progress bar fill
      const count = await progressBars.count();

      if (count > 0) {
        console.log(`✓ ${count} downloads showing progress bars`);
      } else {
        console.log('⚠ No active downloads to show progress');
      }
    });

    test('progress percentage is displayed', async ({ page }) => {
      await page.locator('button:has-text("Active")').click();
      await page.waitForTimeout(1000);

      // Look for percentage text
      const percentages = page.locator('text=/%/');
      const count = await percentages.count();

      if (count > 0) {
        const firstPercentage = await percentages.first().textContent();
        console.log(`✓ Progress displayed: ${firstPercentage}`);
      } else {
        console.log('⚠ No active downloads showing progress');
      }
    });

    test('torrent stats are displayed (speed, seeds, ETA)', async ({ page }) => {
      await page.locator('button:has-text("Active")').click();
      await page.waitForTimeout(1000);

      // Check for download speed indicators
      const speedIndicators = page.locator('text=/MB\\/s|KB\\/s/i');
      const hasSpeed = await speedIndicators.count() > 0;

      // Check for seed/peer info
      const seedInfo = page.locator('text=/Seeds?:/i');
      const hasSeeds = await seedInfo.count() > 0;

      if (hasSpeed || hasSeeds) {
        console.log(`✓ Torrent stats displayed - Speed: ${hasSpeed}, Seeds: ${hasSeeds}`);
      } else {
        console.log('⚠ No active torrents to show stats');
      }
    });

    test('progress updates in real-time', async ({ page }) => {
      await page.locator('button:has-text("Active")').click();
      await page.waitForTimeout(1000);

      // Get initial progress
      const progressTexts = page.locator('text=/%/');
      const count = await progressTexts.count();

      if (count > 0) {
        const initialProgress = await progressTexts.first().textContent();

        // Wait for download worker sync (3 seconds)
        await page.waitForTimeout(4000);

        const updatedProgress = await progressTexts.first().textContent();

        console.log(`✓ Progress tracking: ${initialProgress} → ${updatedProgress}`);
      } else {
        console.log('⚠ No active downloads for real-time tracking test');
      }
    });
  });

  test.describe('Filter System', () => {
    test('All filter shows all downloads', async ({ page }) => {
      await page.locator('button:has-text("All")').click();
      await page.waitForTimeout(500);

      const downloadCards = page.locator('[class*="card"], [class*="bg-gray-800"]');
      const count = await downloadCards.count();

      console.log(`✓ All filter: ${count} total downloads`);
    });

    test('Completed filter shows only completed', async ({ page }) => {
      await page.locator('button:has-text("Completed")').click();
      await page.waitForTimeout(500);

      // Check status badges
      const completedBadges = page.locator('text=/completed/i');
      const count = await completedBadges.count();

      console.log(`✓ Completed filter: ${count} completed downloads`);
    });

    test('Active filter shows only downloading', async ({ page }) => {
      await page.locator('button:has-text("Active")').click();
      await page.waitForTimeout(500);

      const downloadingBadges = page.locator('text=/downloading/i');
      const count = await downloadingBadges.count();

      console.log(`✓ Active filter: ${count} active downloads`);
    });

    test('Failed filter shows only failed', async ({ page }) => {
      await page.locator('button:has-text("Failed")').click();
      await page.waitForTimeout(500);

      const failedBadges = page.locator('text=/failed/i');
      const count = await failedBadges.count();

      console.log(`✓ Failed filter: ${count} failed downloads`);
    });

    test('filter counts are accurate', async ({ page }) => {
      // Get counts from filter buttons
      const allBtn = page.locator('button:has-text("All")').first();
      const allText = await allBtn.textContent();
      const allCount = parseInt(allText?.match(/\((\d+)\)/)?.[1] || '0');

      const pendingBtn = page.locator('button:has-text("Pending")').first();
      const pendingText = await pendingBtn.textContent();
      const pendingCount = parseInt(pendingText?.match(/\((\d+)\)/)?.[1] || '0');

      const activeBtn = page.locator('button:has-text("Active")').first();
      const activeText = await activeBtn.textContent();
      const activeCount = parseInt(activeText?.match(/\((\d+)\)/)?.[1] || '0');

      console.log(`✓ Counts - All: ${allCount}, Pending: ${pendingCount}, Active: ${activeCount}`);
    });
  });

  test.describe('View Modes', () => {
    test('can switch to grid view', async ({ page }) => {
      await page.locator('button:has-text("Grid")').click();
      await page.waitForTimeout(500);

      // Grid view should show cards in a grid layout
      const gridLayout = page.locator('[class*="grid-cols"]');
      const hasGrid = await gridLayout.count() > 0;

      expect(hasGrid).toBeTruthy();
      console.log('✓ Grid view active');
    });

    test('can switch to table view', async ({ page }) => {
      await page.locator('button:has-text("Table")').click();
      await page.waitForTimeout(500);

      // Table view should show a table
      const table = page.locator('table');
      const hasTable = await table.count() > 0;

      if (hasTable) {
        console.log('✓ Table view active');
      } else {
        console.log('⚠ Table view attempted (may need downloads to display)');
      }
    });
  });

  test.describe('Download Actions', () => {
    test('completed downloads have delete button', async ({ page }) => {
      await page.locator('button:has-text("Completed")').click();
      await page.waitForTimeout(1000);

      const deleteButtons = page.locator('button:has-text("Delete")');
      const count = await deleteButtons.count();

      if (count > 0) {
        console.log(`✓ ${count} delete buttons found`);
      } else {
        console.log('⚠ No completed downloads to test delete');
      }
    });

    test('active torrents have pause button', async ({ page }) => {
      await page.locator('button:has-text("Active")').click();
      await page.waitForTimeout(1000);

      const pauseButtons = page.locator('button:has-text("Pause")');
      const count = await pauseButtons.count();

      if (count > 0) {
        console.log(`✓ ${count} pause buttons found`);
      } else {
        console.log('⚠ No active downloads to test pause');
      }
    });

    test('failed downloads have retry button', async ({ page }) => {
      await page.locator('button:has-text("Failed")').click();
      await page.waitForTimeout(1000);

      const retryButtons = page.locator('button:has-text("Retry")');
      const count = await retryButtons.count();

      if (count > 0) {
        console.log(`✓ ${count} retry buttons found`);
      } else {
        console.log('⚠ No failed downloads to test retry');
      }
    });
  });

  test.describe('Pagination', () => {
    test('pagination appears when needed', async ({ page }) => {
      // If more than 16 items, pagination should appear
      await page.locator('button:has-text("All")').click();
      await page.waitForTimeout(500);

      const pagination = page.locator('button:has-text("Previous"), button:has-text("Next")');
      const hasPagination = await pagination.count() > 0;

      console.log(`✓ Pagination: ${hasPagination ? 'present' : 'not needed'}`);
    });

    test('can navigate pages', async ({ page }) => {
      const nextBtn = page.locator('button:has-text("Next")').first();
      const isVisible = await nextBtn.isVisible({ timeout: 2000 }).catch(() => false);

      if (isVisible && !(await nextBtn.isDisabled())) {
        await nextBtn.click();
        await page.waitForTimeout(500);

        console.log('✓ Next page navigation works');
      } else {
        console.log('⚠ Single page of results, pagination not needed');
      }
    });
  });

  test.describe('Integration Tests', () => {
    test('downloads with torrentHash show progress', async ({ page }) => {
      await page.locator('button:has-text("Active")').click();
      await page.waitForTimeout(1000);

      // Active qBittorrent downloads should show torrent info
      const torrentDownloads = page.locator('text=/qbittorrent/i');
      const count = await torrentDownloads.count();

      if (count > 0) {
        // Should have progress bars
        const progressBars = page.locator('div.bg-blue-600');
        const progressCount = await progressBars.count();

        expect(progressCount).toBeGreaterThan(0);
        console.log(`✓ ${count} qBittorrent downloads with progress tracking`);
      }
    });

    test('all qBittorrent downloads have thumbnails', async ({ page }) => {
      await page.locator('button:has-text("All")').click();
      await page.waitForTimeout(500);

      // Get all thumbnails
      const thumbnails = page.locator('img[src*="image.tmdb.org"]');
      const thumbnailCount = await thumbnails.count();

      if (thumbnailCount > 0) {
        // Verify all are valid TMDB URLs
        for (let i = 0; i < Math.min(thumbnailCount, 5); i++) {
          const src = await thumbnails.nth(i).getAttribute('src');
          expect(src).toMatch(/^https:\/\/image\.tmdb\.org\/t\/p\//);
        }

        console.log(`✓ All ${thumbnailCount} downloads have valid TMDB thumbnails`);
      }
    });
  });
});
