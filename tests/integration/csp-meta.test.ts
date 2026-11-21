import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

describe('Base layout CSP meta', () => {
  it("restricts connect-src to 'self' only", async () => {
    const file = await readFile(resolve(__dirname, '../../src/layouts/Base.astro'), 'utf8');
    const match = file.match(/connect-src ([^;]*);/);
    expect(match, 'connect-src directive must exist').not.toBeNull();
    expect(match![1].trim()).toBe("'self'");
  });

  it('forbids inline scripts (no unsafe-inline in script-src)', async () => {
    const file = await readFile(resolve(__dirname, '../../src/layouts/Base.astro'), 'utf8');
    expect(file).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  });
});

describe('Theme bootstrap script', () => {
  it('CSP script-src lists the theme bootstrap hash', async () => {
    const file = await readFile(resolve(__dirname, '../../src/layouts/Base.astro'), 'utf8');
    const match = file.match(/const themeBootstrap = `([^`]+)`;/);
    expect(match, 'themeBootstrap constant must exist in Base.astro').not.toBeNull();
    const body = match![1];
    const expectedHash = createHash('sha256').update(body).digest('base64');
    const expectedToken = `'sha256-${expectedHash}'`;
    expect(file, `CSP script-src must contain ${expectedToken}`).toContain(expectedToken);
  });

  it('bootstrap script body still parses (sanity)', async () => {
    const file = await readFile(resolve(__dirname, '../../src/layouts/Base.astro'), 'utf8');
    const match = file.match(/const themeBootstrap = `([^`]+)`;/);
    const body = match![1];
    expect(body).toContain("localStorage.getItem('cv.theme')");
    expect(body).toContain("matchMedia('(prefers-color-scheme: dark)')");
    expect(body).toContain("classList.add('dark')");
    expect(body).toContain("setAttribute('data-theme','matrix')");
  });
});

describe('CSP in built HTML', () => {
  it('emits Content-Security-Policy meta on /cv', async () => {
    const file = await readFile(resolve(__dirname, '../../dist/cv/index.html'), 'utf8');
    expect(file).toMatch(/http-equiv="Content-Security-Policy"/);
    expect(file).toContain("connect-src 'self';");
    expect(file).not.toContain('openrouter.ai');
  });

  it('does not ship the removed /playground page', async () => {
    const { existsSync } = await import('node:fs');
    expect(existsSync(resolve(__dirname, '../../dist/playground/index.html'))).toBe(false);
  });
});
