import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import yaml from 'js-yaml';

const root = resolve(__dirname, '../..');
const DAY = 86_400_000;

async function fields(): Promise<Map<string, string[]>> {
  const txt = await readFile(resolve(root, 'public/.well-known/security.txt'), 'utf8');
  const out = new Map<string, string[]>();
  for (const line of txt.split('\n')) {
    const m = line.match(/^([A-Za-z-]+):\s*(.+)$/);
    if (!m) continue;
    out.set(m[1], [...(out.get(m[1]) ?? []), m[2].trim()]);
  }
  return out;
}

describe('security.txt (RFC 9116)', () => {
  it('uses the same contact address /contact publishes', async () => {
    const cv = yaml.load(await readFile(resolve(root, 'content/cv.yaml'), 'utf8')) as {
      basics: { email: string };
    };
    expect((await fields()).get('Contact')).toEqual([`mailto:${cv.basics.email}`]);
  });

  it('has exactly one Expires, in the future but under a year out', async () => {
    const expires = (await fields()).get('Expires');
    expect(expires).toHaveLength(1);
    const t = Date.parse(expires![0]);
    expect(Number.isNaN(t)).toBe(false);
    // Fails 30 days before expiry, as a reminder to bump the date.
    expect(t - Date.now(), 'Expires is within 30 days — bump it').toBeGreaterThan(30 * DAY);
    expect(t - Date.now(), 'RFC 9116 recommends under a year').toBeLessThan(366 * DAY);
  });

  it('has a Canonical URL at the well-known path on the live domain', async () => {
    expect((await fields()).get('Canonical')).toEqual([
      'https://cameronhartman.dev/.well-known/security.txt',
    ]);
  });

  it('is copied into the build output', () => {
    expect(existsSync(resolve(root, 'dist/.well-known/security.txt'))).toBe(true);
  });
});
