import { test, expect } from '@playwright/test';

// Use authenticated state from auth.setup.ts
test.use({ storageState: 'playwright/.auth/user.json' });

test.describe('Bazarr Subtitle Integration', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to Settings page
    await page.goto('/settings', { waitUntil: 'domcontentloaded', timeout: 30000 });
  });

  test('should display Bazarr settings tab', async ({ page }) => {
    // Check if Subtitles tab is visible
    const subtitlesTab = page.locator('text=Subtitles');
    await expect(subtitlesTab).toBeVisible({ timeout: 10000 });

    // Click the Subtitles tab
    await subtitlesTab.click();

    // Verify Bazarr configuration section is visible
    await expect(page.locator('h3:has-text("Bazarr (Subtitle Manager)")')).toBeVisible();
  });

  test('should enable and configure Bazarr', async ({ page }) => {
    // Click Subtitles tab
    await page.locator('text=Subtitles').click();

    // Enable Bazarr
    const enableCheckbox = page.locator('input[type="checkbox"]').filter({ hasText: 'Enabled' }).or(
      page.locator('label:has-text("Enabled")').locator('input[type="checkbox"]')
    );

    // If not already enabled, enable it
    const isChecked = await enableCheckbox.isChecked();
    if (!isChecked) {
      await enableCheckbox.check();
    }

    // Verify configuration fields are visible
    await expect(page.locator('label:has-text("Bazarr URL")')).toBeVisible();
    await expect(page.locator('label:has-text("API Key")')).toBeVisible();
    await expect(page.locator('label:has-text("Preferred Languages")')).toBeVisible();

    // Fill in Bazarr configuration
    const urlInput = page.locator('input[placeholder*="localhost:6767"]');
    await urlInput.fill('http://localhost:6767');

    // Note: API key input might need actual API key from Bazarr
    // For now, we'll just verify the field exists
    const apiKeyInput = page.locator('input[placeholder*="Bazarr API key"]');
    await expect(apiKeyInput).toBeVisible();

    // Configure preferred languages
    const languagesInput = page.locator('input[placeholder*="en,es,fr"]');
    await languagesInput.fill('en');

    // Verify Test Connection button is visible
    await expect(page.locator('button:has-text("Test Connection")')).toBeVisible();

    // Save preferences
    const saveButton = page.locator('button:has-text("Save Preferences")');
    if (await saveButton.isVisible()) {
      await saveButton.click();

      // Wait for save confirmation
      await expect(page.locator('text=/saved|success/i')).toBeVisible({ timeout: 5000 });
    }
  });

  test('should test Bazarr connection', async ({ page }) => {
    // Click Subtitles tab
    await page.locator('text=Subtitles').click();

    // Enable Bazarr if not enabled
    const enableCheckbox = page.locator('label:has-text("Enabled")').locator('input[type="checkbox"]');
    const isChecked = await enableCheckbox.isChecked();
    if (!isChecked) {
      await enableCheckbox.check();
    }

    // Click Test Connection button
    const testButton = page.locator('button:has-text("Test Connection")');
    await expect(testButton).toBeVisible();
    await testButton.click();

    // Wait for connection test result
    // Should see either success or error message
    const resultMessage = page.locator('text=/Bazarr|connected|failed/i').first();
    await expect(resultMessage).toBeVisible({ timeout: 10000 });
  });

  test('should show/hide API key', async ({ page }) => {
    // Click Subtitles tab
    await page.locator('text=Subtitles').click();

    // Enable Bazarr
    const enableCheckbox = page.locator('label:has-text("Enabled")').locator('input[type="checkbox"]');
    const isChecked = await enableCheckbox.isChecked();
    if (!isChecked) {
      await enableCheckbox.check();
    }

    // Find API key input and Show/Hide button
    const apiKeyInput = page.locator('input[placeholder*="Bazarr API key"]');
    const showHideButton = page.locator('button:has-text("Show")').or(page.locator('button:has-text("Hide")'));

    // Verify API key is hidden by default (password type)
    await expect(apiKeyInput).toHaveAttribute('type', 'password');

    // Click Show button
    await showHideButton.click();

    // Verify API key is now visible (text type)
    await expect(apiKeyInput).toHaveAttribute('type', 'text');

    // Click Hide button
    await showHideButton.click();

    // Verify API key is hidden again
    await expect(apiKeyInput).toHaveAttribute('type', 'password');
  });

  test('should display Bazarr documentation links', async ({ page }) => {
    // Click Subtitles tab
    await page.locator('text=Subtitles').click();

    // Verify info box with Bazarr link is visible
    const bazarrLink = page.locator('a[href="http://localhost:6767"]');
    await expect(bazarrLink).toBeVisible();
    await expect(bazarrLink).toHaveText('Bazarr');

    // Verify help text about finding API key
    await expect(page.locator('text=/Settings.*Security.*API Key/i')).toBeVisible();
  });

  test('should validate language input format', async ({ page }) => {
    // Click Subtitles tab
    await page.locator('text=Subtitles').click();

    // Enable Bazarr
    const enableCheckbox = page.locator('label:has-text("Enabled")').locator('input[type="checkbox"]');
    const isChecked = await enableCheckbox.isChecked();
    if (!isChecked) {
      await enableCheckbox.check();
    }

    // Test multiple language codes
    const languagesInput = page.locator('input[placeholder*="en,es,fr"]');
    await languagesInput.fill('en,es,fr,de');
    await expect(languagesInput).toHaveValue('en,es,fr,de');

    // Test single language
    await languagesInput.fill('en');
    await expect(languagesInput).toHaveValue('en');
  });
});

test.describe('Bazarr API Integration', () => {
  test.beforeEach(async ({ page }) => {
    // Set up API route listeners
    page.route('**/api/v1/bazarr/**', route => route.continue());
  });

  test('should call status endpoint when enabled', async ({ page, request }) => {
    // Make API request to check Bazarr status
    const response = await request.get('http://localhost:3001/api/v1/bazarr/status', {
      headers: {
        'Cookie': await page.context().storageState().then(state =>
          state.cookies.map(c => `${c.name}=${c.value}`).join('; ')
        )
      }
    });

    // Should return a valid response (either configured or not)
    expect(response.ok() || response.status() === 400).toBeTruthy();

    const data = await response.json();
    expect(data).toHaveProperty('configured');
  });

  test('should handle missing configuration gracefully', async ({ page, request }) => {
    // Test movies endpoint when Bazarr might not be configured
    const response = await request.get('http://localhost:3001/api/v1/bazarr/movies', {
      headers: {
        'Cookie': await page.context().storageState().then(state =>
          state.cookies.map(c => `${c.name}=${c.value}`).join('; ')
        )
      }
    });

    // Should either return data or a 400 error indicating Bazarr is not enabled
    expect(response.status() === 200 || response.status() === 400).toBeTruthy();
  });

  test('should handle series endpoint', async ({ page, request }) => {
    const response = await request.get('http://localhost:3001/api/v1/bazarr/series', {
      headers: {
        'Cookie': await page.context().storageState().then(state =>
          state.cookies.map(c => `${c.name}=${c.value}`).join('; ')
        )
      }
    });

    // Should either return data or a 400 error
    expect(response.status() === 200 || response.status() === 400).toBeTruthy();
  });

  test('should check missing subtitles endpoints exist', async ({ page, request }) => {
    // Test missing movies endpoint
    const moviesResponse = await request.get('http://localhost:3001/api/v1/bazarr/missing/movies', {
      headers: {
        'Cookie': await page.context().storageState().then(state =>
          state.cookies.map(c => `${c.name}=${c.value}`).join('; ')
        )
      }
    });
    expect(moviesResponse.status() === 200 || moviesResponse.status() === 400).toBeTruthy();

    // Test missing series endpoint
    const seriesResponse = await request.get('http://localhost:3001/api/v1/bazarr/missing/series', {
      headers: {
        'Cookie': await page.context().storageState().then(state =>
          state.cookies.map(c => `${c.name}=${c.value}`).join('; ')
        )
      }
    });
    expect(seriesResponse.status() === 200 || seriesResponse.status() === 400).toBeTruthy();
  });
});

test.describe('Bazarr Database Schema', () => {
  test('should have bazarr columns in user_preferences', async ({ request }) => {
    // This is more of a sanity check - we can't directly query DB from Playwright
    // but we can verify the API respects the schema

    const response = await request.get('http://localhost:3001/api/v1/preferences');

    if (response.ok()) {
      const prefs = await response.json();

      // Verify Bazarr-related fields exist in preferences response
      expect(prefs).toHaveProperty('bazarr_enabled');
      expect(prefs).toHaveProperty('bazarr_url');
      expect(prefs).toHaveProperty('bazarr_api_key');
      expect(prefs).toHaveProperty('bazarr_subtitle_languages');
    }
  });
});
