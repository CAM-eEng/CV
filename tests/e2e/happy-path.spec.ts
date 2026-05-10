import { test, expect } from '@playwright/test';

test.describe('happy path', () => {
  test('home loads and links to /cv', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/');
    await expect(page).toHaveTitle(/Cameron Hartman/);
    await page.getByRole('link', { name: /View full CV/i }).click();
    await expect(page).toHaveURL(/\/cv\/?$/);
    expect(errors).toEqual([]);
  });

  test('/cv page contains JSON-LD Person', async ({ page }) => {
    await page.goto('/cv');
    const ld = await page.locator('script[type="application/ld+json"]').first().textContent();
    expect(ld).toBeTruthy();
    const parsed = JSON.parse(ld!);
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    const person = arr.find((x: { '@type'?: string }) => x['@type'] === 'Person');
    expect(person).toBeTruthy();
  });

  test('/cv.json returns valid JSON Resume', async ({ request }) => {
    const res = await request.get('/cv.json');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.basics.name).toBeTruthy();
  });

  test('/llms.txt is reachable and starts with H1', async ({ request }) => {
    const res = await request.get('/llms.txt');
    expect(res.ok()).toBeTruthy();
    const body = await res.text();
    expect(body.split('\n')[0]).toMatch(/^# /);
  });

  test('/projects/leddisplay renders the case study', async ({ page }) => {
    await page.goto('/projects/leddisplay');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('LedDisplay');
  });
});
