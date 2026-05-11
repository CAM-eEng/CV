import { test, expect, type Page } from '@playwright/test';

async function acceptTerms(page: Page) {
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /Agree to Terms and Conditions/i }).click();
  await expect(page.getByRole('dialog', { name: /Terms/i })).not.toBeVisible();
}

test.describe('JD analyzer in demo mode', () => {
  test('paste JD → see scorecard', async ({ page }) => {
    await page.goto('/playground#jd-analyzer');
    await acceptTerms(page);

    // The textarea lives inside the JDAnalyzer island.
    const ta = page.getByPlaceholder(/Paste a job description/i);
    await ta.scrollIntoViewIfNeeded();
    await ta.fill(
      'Senior software engineer, embedded + Python + Docker. Background in test automation a plus.',
    );

    await page.getByRole('button', { name: /Analyze fit/i }).click();

    // Connect sheet appears (no session yet); pick demo.
    await page.getByRole('button', { name: /Try demo mode/i }).click();

    // Demo returns a deterministic shape — fit_score 72.
    await expect(page.getByRole('heading', { name: /Fit score/i })).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('72')).toBeVisible();

    // Matched-skills list rendered.
    await expect(page.getByRole('heading', { name: /Matched skills/i })).toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: /Python/ })).toBeVisible();
  });
});
