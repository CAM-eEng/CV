import { test, expect } from '@playwright/test';

test.describe('Activity dashboard on /', () => {
  test('renders the empty-stub state until the first refresh', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/Activity dashboard pending|Recent activity/i)).toBeVisible({
      timeout: 8000,
    });
  });
});
