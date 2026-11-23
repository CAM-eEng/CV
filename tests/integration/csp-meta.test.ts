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

const DIST = resolve(__dirname, '../../dist');

async function builtPages(): Promise<string[]> {
  const { readdir } = await import('node:fs/promises');
  const entries = await readdir(DIST, { recursive: true });
  return entries.filter((p) => p.endsWith('.html')).map((p) => resolve(DIST, p));
}

function cspOf(html: string): Map<string, string[]> {
  const m = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/);
  expect(m, 'CSP meta tag').not.toBeNull();
  const policy = m![1].replace(/&#39;/g, "'");
  return new Map(
    policy
      .split(';')
      .map((d) => d.trim().split(/\s+/))
      .filter((parts) => parts[0])
      .map(([name, ...values]) => [name, values]),
  );
}

const sha256 = (s: string) => `'sha256-${createHash('sha256').update(s).digest('base64')}'`;

describe('CSP in built HTML', () => {
  it('emits the expected policy on every page', async () => {
    const pages = await builtPages();
    expect(pages.length).toBeGreaterThan(0);
    for (const page of pages) {
      const csp = cspOf(await readFile(page, 'utf8'));
      expect(csp.get('default-src'), page).toEqual(["'none'"]);
      expect(csp.get('connect-src'), page).toEqual(["'self'"]);
      expect(csp.get('img-src'), page).toEqual(["'self'"]);
      expect(csp.get('font-src'), page).toEqual(["'self'"]);
      expect(csp.get('object-src'), page).toEqual(["'none'"]);
      expect(csp.get('base-uri'), page).toEqual(["'none'"]);
      expect(csp.get('form-action'), page).toEqual(["'none'"]);
      expect(csp.get('style-src-attr'), page).toEqual(["'unsafe-inline'"]);
      for (const d of ['script-src', 'style-src']) {
        const values = csp.get(d) ?? [];
        expect(values[0], `${page} ${d}`).toBe("'self'");
        expect(
          values.slice(1).every((v) => v.startsWith("'sha256-")),
          `${page} ${d} allows only 'self' + hashes`,
        ).toBe(true);
      }
    }
  });

  it('hashes every inline script and style, and lists no unused hash', async () => {
    const used = { 'script-src': new Set<string>(), 'style-src': new Set<string>() };
    let listed: Record<keyof typeof used, string[]> | null = null;
    for (const page of await builtPages()) {
      const html = await readFile(page, 'utf8');
      const csp = cspOf(html);
      listed = {
        'script-src': (csp.get('script-src') ?? []).slice(1),
        'style-src': (csp.get('style-src') ?? []).slice(1),
      };
      const inline: Array<[keyof typeof used, RegExp]> = [
        [
          'script-src',
          /<script(?![^>]*\bsrc=)(?![^>]*application\/ld\+json)[^>]*>([\s\S]*?)<\/script>/g,
        ],
        ['style-src', /<style[^>]*>([\s\S]*?)<\/style>/g],
      ];
      for (const [directive, re] of inline) {
        for (const [, body] of html.matchAll(re)) {
          const h = sha256(body);
          expect(listed[directive], `${page}: inline ${directive} body not hashed`).toContain(h);
          used[directive].add(h);
        }
      }
    }
    for (const d of ['script-src', 'style-src'] as const) {
      expect([...listed![d]].sort(), `stale ${d} hashes`).toEqual([...used[d]].sort());
    }
  });

  it('allowlists no AI provider or other third-party host', async () => {
    for (const page of await builtPages()) {
      const m = (await readFile(page, 'utf8')).match(
        /<meta http-equiv="Content-Security-Policy" content="([^"]+)"/,
      );
      expect(m![1], page).not.toMatch(
        /https?:|anthropic|openai|openrouter|googleapis|\*|'unsafe-eval'/,
      );
    }
  });

  it('does not ship the removed /playground page', async () => {
    const { existsSync } = await import('node:fs');
    expect(existsSync(resolve(__dirname, '../../dist/playground/index.html'))).toBe(false);
  });
});
