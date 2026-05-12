import { test, expect } from '@playwright/test';

test.describe('Playground security', () => {
  test('chat input maxLength clamps a 9000-char paste', async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('ai-terms-accepted-v1', 'yes'));
    await page.goto('/playground/');
    const ta = page.locator('textarea').first();
    const huge = 'A'.repeat(9000);
    await ta.fill(huge);
    const val = await ta.inputValue();
    expect(val.length).toBeLessThanOrEqual(8000);
  });

  test('no-terms state shows the placeholder, not the live chat', async ({ page }) => {
    await page.goto('/playground/');
    await expect(
      page.getByText(/Accept the playground terms above to use the chat/i),
    ).toBeVisible();
  });

  test('no-terms state shows the JD analyzer placeholder', async ({ page }) => {
    await page.goto('/playground/');
    await expect(
      page.getByText(/Accept the playground terms above to use the JD analyzer/i),
    ).toBeVisible();
  });

  test('chat rate cap blocks the 51st message', async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('ai-terms-accepted-v1', 'yes');
      sessionStorage.setItem('cv.chat.count', '50');
      sessionStorage.setItem(
        'byok-session',
        JSON.stringify({ providerId: 'demo', token: 'x', model: 'demo-default' }),
      );
    });
    await page.goto('/playground/');
    const input = page.locator('textarea').first();
    await input.fill('this should be rejected');
    await page.keyboard.press('Enter');
    await expect(page.getByText(/Session limit reached \(50 messages\)/)).toBeVisible();
  });

  test('domain badge displays current hostname in BYOK paste form', async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('ai-terms-accepted-v1', 'yes'));
    await page.goto('/playground/');
    await page.getByText(/Connect to ask|Change provider/i).first().click();
    const anthropicBtn = page.getByRole('button', { name: /anthropic/i }).first();
    if (await anthropicBtn.isVisible()) await anthropicBtn.click();
    await expect(page.getByText(/pasting into/i)).toBeVisible();
    await expect(page.locator('code').filter({ hasText: /localhost|cameronhartman/ })).toBeVisible();
  });
});
