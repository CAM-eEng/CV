import { test, expect } from '@playwright/test';

test.describe('Activity dashboard on /', () => {
  test('renders the empty-stub state until the first refresh', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/Activity dashboard pending|Recent activity/i)).toBeVisible({
      timeout: 8000,
    });
  });

  test('shows a styled tooltip when hovering a contribution cell', async ({ page }) => {
    await page.goto('/');
    // Wait for the heatmap to hydrate (client:visible on the dashboard).
    const heatmap = page.getByRole('img', { name: /GitHub contributions over the last year/i });
    await heatmap.scrollIntoViewIfNeeded();
    await expect(heatmap).toBeVisible();

    // Hover the first focusable cell; the styled tooltip should appear.
    const firstCell = heatmap.locator('rect[tabindex="0"]').first();
    await firstCell.hover();

    const tooltip = page.getByRole('tooltip');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toHaveText(
      /^(January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, \d{4} · \d+ contributions?$/,
    );
  });
});
