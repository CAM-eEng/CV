import { test, expect } from '@playwright/test';

test.describe('AI terms gate on /playground', () => {
  test('blocks interaction until accepted; checkbox required', async ({ page }) => {
    await page.goto('/playground');

    // Gate visible on first load.
    const dialog = page.getByRole('dialog', { name: /Terms/i });
    await expect(dialog).toBeVisible();

    // The terms text mentions all four harm categories.
    await expect(dialog).toContainText(/financial/i);
    await expect(dialog).toContainText(/emotional/i);
    await expect(dialog).toContainText(/physical/i);
    await expect(dialog).toContainText(/any other harm/i);

    // The agree button is disabled until the checkbox is checked.
    const agreeBtn = page.getByRole('button', { name: /Agree to Terms and Conditions/i });
    await expect(agreeBtn).toBeDisabled();

    // Body scroll is locked while the gate is open.
    const bodyOverflow = await page.evaluate(() => document.body.style.overflow);
    expect(bodyOverflow).toBe('hidden');

    // Check the box and agree.
    await page.getByRole('checkbox').check();
    await expect(agreeBtn).toBeEnabled();
    await agreeBtn.click();

    // Dialog dismissed; chat is now reachable.
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole('button', { name: /^Connect/i })).toBeVisible();
  });

  test('acceptance persists for the tab session', async ({ page }) => {
    await page.goto('/playground');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: /Agree to Terms and Conditions/i }).click();
    await expect(page.getByRole('dialog', { name: /Terms/i })).not.toBeVisible();

    // Navigate away and back — gate should not reappear.
    await page.goto('/');
    await page.goto('/playground');
    await expect(page.getByRole('dialog', { name: /Terms/i })).not.toBeVisible();
    await expect(page.getByRole('button', { name: /^Connect/i })).toBeVisible();
  });
});
