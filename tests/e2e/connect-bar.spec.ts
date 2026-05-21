import { test, expect } from '@playwright/test';

test.describe('ConnectBar', () => {
  test('Connect button appears next to the Playground title and opens the sheet', async ({
    page,
  }) => {
    // Pre-accept T&C so the modal doesn't block the page
    await page.addInitScript(() => {
      sessionStorage.setItem('ai-terms-accepted-v1', 'yes');
    });
    await page.goto('/playground/');

    // Title is visible
    await expect(page.getByRole('heading', { name: 'Playground' })).toBeVisible();

    // Page-level Connect button is visible
    const connectButton = page.getByRole('button', { name: /^Connect/i });
    await expect(connectButton).toBeVisible();

    // Clicking it opens the ConnectSheet
    await connectButton.click();
    await expect(page.getByRole('heading', { name: /connect to ask/i })).toBeVisible();
  });

  test('Submitting in Chat without a session opens the ConnectSheet via the page-level bar', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('ai-terms-accepted-v1', 'yes');
    });
    await page.goto('/playground/');

    // Type something and submit in the Chat textarea
    const chatInput = page.locator('textarea').first();
    await chatInput.fill('hello');
    await page.keyboard.press('Enter');

    // The ConnectSheet (owned by ConnectBar) opens
    await expect(page.getByRole('heading', { name: /connect to ask/i })).toBeVisible();
  });
});
