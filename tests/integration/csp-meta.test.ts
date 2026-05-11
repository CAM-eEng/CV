import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

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
