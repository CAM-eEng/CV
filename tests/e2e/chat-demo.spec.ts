import { test, expect, type Page } from '@playwright/test';

async function acceptTerms(page: Page) {
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /Agree to Terms and Conditions/i }).click();
  await expect(page.getByRole('dialog', { name: /Terms/i })).not.toBeVisible();
}

test.describe('Chat in demo mode', () => {
  test('connect → ask → stream → cite', async ({ page }) => {
    await page.goto('/playground');
    await acceptTerms(page);

    // The Connect to ask button is visible because no session exists yet.
    await page.getByRole('button', { name: /Connect to ask/i }).click();

    // Pick demo mode.
    await page.getByRole('button', { name: /Try demo mode/i }).click();

    // After connect, the connect button is replaced by ProviderStatus.
    await expect(page.getByText(/Connected · Demo/i)).toBeVisible();

    // Type a question that matches the embedded keyword.
    const ta = page.getByPlaceholder(/Ask about Cameron/i);
    await ta.fill('Tell me about Cameron embedded experience');
    await page.getByRole('button', { name: /^Ask$/ }).click();

    // The assistant streams a response containing one of the embedded keywords.
    const assistantBubble = page.locator('.prose-sm').last();
    await expect(assistantBubble).toContainText(/firmware|embedded|LitePoint/i, { timeout: 8000 });

    // The response contains a citation anchor.
    await expect(page.locator('a[href^="/cv/#work-0-highlights-"]').first()).toBeVisible();
  });

  test('disconnect clears the session', async ({ page }) => {
    await page.goto('/playground');
    await acceptTerms(page);
    await page.getByRole('button', { name: /Connect to ask/i }).click();
    await page.getByRole('button', { name: /Try demo mode/i }).click();
    await expect(page.getByText(/Connected · Demo/i)).toBeVisible();

    await page.getByRole('button', { name: /^Disconnect$/ }).click();
    await expect(page.getByText(/Connected · Demo/i)).not.toBeVisible();
    await expect(page.getByRole('button', { name: /Connect to ask/i })).toBeVisible();
  });
});
