import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

describe('Base layout CSP meta', () => {
  it('lists every approved provider host in connect-src', async () => {
    const file = await readFile(resolve(__dirname, '../../src/layouts/Base.astro'), 'utf8');
    const expected = [
      "'self'",
      'https://api.anthropic.com',
      'https://api.openai.com',
      'https://generativelanguage.googleapis.com',
      'https://openrouter.ai',
      'https://api.github.com',
    ];
    for (const host of expected) {
      expect(file, `connect-src must include ${host}`).toContain(host);
    }
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
    expect(file).toContain('https://api.anthropic.com');
    expect(file).toContain('https://openrouter.ai');
  });

  it('emits Content-Security-Policy meta on /playground', async () => {
    const file = await readFile(resolve(__dirname, '../../dist/playground/index.html'), 'utf8');
    expect(file).toMatch(/http-equiv="Content-Security-Policy"/);
  });
});
