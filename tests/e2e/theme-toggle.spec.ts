import { test, expect } from '@playwright/test';

test.describe('Theme toggle', () => {
  test('default is system, OS-light → no dark class', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    await expect(page.locator('html')).not.toHaveClass(/(^| )dark( |$)/);
    await expect(page.getByRole('radio', { name: 'System' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  test('default is system, OS-dark → dark class applied', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await expect(page.locator('html')).toHaveClass(/(^| )dark( |$)/);
  });

  test('click Light → no dark class, no data-theme', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await page.getByRole('radio', { name: 'Light' }).click();
    await expect(page.locator('html')).not.toHaveClass(/(^| )dark( |$)/);
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.*/);
  });

  test('click Dark → dark class, no data-theme', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    await page.getByRole('radio', { name: 'Dark' }).click();
    await expect(page.locator('html')).toHaveClass(/(^| )dark( |$)/);
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.*/);
  });

  test('click Matrix → dark class + data-theme=matrix', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('radio', { name: 'Matrix' }).click();
    await expect(page.locator('html')).toHaveClass(/(^| )dark( |$)/);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'matrix');
    // Foreground swatch is the neon green.
    const fg = await page.evaluate(() => getComputedStyle(document.body).color);
    // jsdom-style "rgb(57, 255, 20)" — assert green-dominant.
    const match = fg.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    expect(match).not.toBeNull();
    const [, r, g, b] = match!.map(Number);
    expect(g).toBeGreaterThan(200);
    expect(g).toBeGreaterThan(r);
    expect(g).toBeGreaterThan(b);
  });

  test('persistence: reload preserves Matrix', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('radio', { name: 'Matrix' }).click();
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'matrix');
    await expect(page.getByRole('radio', { name: 'Matrix' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  test('system mode reacts to OS-pref change live', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    await page.getByRole('radio', { name: 'System' }).click();
    await expect(page.locator('html')).not.toHaveClass(/(^| )dark( |$)/);
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('html')).toHaveClass(/(^| )dark( |$)/);
  });

  test('no FOUC: html attributes are set before first paint when stored=matrix', async ({
    page,
  }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('cv.theme', 'matrix'));
    await page.reload();
    const dataTheme = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme'),
    );
    expect(dataTheme).toBe('matrix');
  });
});
