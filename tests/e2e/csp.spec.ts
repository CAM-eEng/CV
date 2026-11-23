import { test, expect } from '@playwright/test';

const PAGES = ['/', '/cv', '/projects', '/contact', '/security', '/404'];

for (const path of PAGES) {
  test(`no CSP violations on ${path}`, async ({ page }) => {
    const violations: string[] = [];
    page.on('console', (msg) => {
      if (/Content Security Policy/i.test(msg.text())) violations.push(msg.text());
    });
    await page.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', (e) => {
        console.error(
          `Content Security Policy violation: ${e.violatedDirective} blocked ${e.blockedURI}`,
        );
      });
    });
    await page.goto(path);
    // Scroll so client:visible islands hydrate, then let client:idle run.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    expect(violations).toEqual([]);
  });
}
