import { describe, it, expect } from 'vitest';
import { ActivitySchema } from '~/lib/activity/schema';

describe('ActivitySchema', () => {
  const minimal = {
    generatedAt: '2026-05-11T03:00:00Z',
    contributions: { days: [], totalLastYear: 0 },
    languages: [],
    repos: [],
    htb: null,
    freshness: [],
  };

  it('accepts the minimal valid shape', () => {
    expect(() => ActivitySchema.parse(minimal)).not.toThrow();
  });

  it('accepts a contributions.days entry', () => {
    const withDay = {
      ...minimal,
      contributions: { days: [{ date: '2026-05-10', count: 4 }], totalLastYear: 4 },
    };
    expect(() => ActivitySchema.parse(withDay)).not.toThrow();
  });

  it('rejects negative contribution count', () => {
    const bad = {
      ...minimal,
      contributions: { days: [{ date: '2026-05-10', count: -1 }], totalLastYear: 0 },
    };
    expect(() => ActivitySchema.parse(bad)).toThrow();
  });

  it('accepts an HTB block when present', () => {
    const withHtb = {
      ...minimal,
      htb: { rank: 'Pro Hacker', points: 1234, ownedMachines: 42, categories: { web: 10, pwn: 8 } },
    };
    expect(() => ActivitySchema.parse(withHtb)).not.toThrow();
  });

  it('accepts a freshness entry', () => {
    const withFresh = {
      ...minimal,
      freshness: [
        { name: 'TypeScript', category: 'Frontend', lastUsed: '2026-05', source: 'skills.yaml' },
      ],
    };
    expect(() => ActivitySchema.parse(withFresh)).not.toThrow();
  });

  describe('hardening', () => {
    const repo = {
      name: 'CV',
      description: 'Online CV',
      url: 'https://github.com/CAM-eEng/CV',
      stars: 0,
      forks: 0,
      lastPushedAt: '2026-05-26T07:07:28Z',
      primaryLanguage: 'TypeScript',
    };
    const withRepo = (overrides: Record<string, unknown>) => ({
      ...minimal,
      repos: [{ ...repo, ...overrides }],
    });

    it('accepts a well-formed repo', () => {
      expect(ActivitySchema.safeParse(withRepo({})).success).toBe(true);
    });

    it.each([
      ['repo name', { name: 'x'.repeat(101) }],
      ['repo description', { description: 'x'.repeat(351) }],
      ['primaryLanguage', { primaryLanguage: 'x'.repeat(51) }],
      ['repo url', { url: `https://github.com/a/${'x'.repeat(200)}` }],
    ])('rejects an oversized %s', (_label, overrides) => {
      expect(ActivitySchema.safeParse(withRepo(overrides)).success).toBe(false);
    });

    it('rejects oversized strings outside repos', () => {
      const long = 'x'.repeat(1000);
      expect(
        ActivitySchema.safeParse({ ...minimal, languages: [{ name: long, bytes: 1 }] }).success,
      ).toBe(false);
      expect(
        ActivitySchema.safeParse({
          ...minimal,
          htb: { rank: long, points: 0, ownedMachines: 0, categories: {} },
        }).success,
      ).toBe(false);
      expect(
        ActivitySchema.safeParse({
          ...minimal,
          freshness: [{ name: long, category: 'x', lastUsed: '2026', source: 'github' }],
        }).success,
      ).toBe(false);
    });

    it('rejects oversized arrays and records', () => {
      const day = { date: '2026-05-10', count: 1 };
      expect(
        ActivitySchema.safeParse({
          ...minimal,
          contributions: { days: Array(401).fill(day), totalLastYear: 0 },
        }).success,
      ).toBe(false);
      expect(ActivitySchema.safeParse({ ...minimal, repos: Array(101).fill(repo) }).success).toBe(
        false,
      );
      const categories = Object.fromEntries(Array.from({ length: 51 }, (_, i) => [`c${i}`, 0]));
      expect(
        ActivitySchema.safeParse({
          ...minimal,
          htb: { rank: 'Noob', points: 0, ownedMachines: 0, categories },
        }).success,
      ).toBe(false);
    });

    it.each([
      'javascript:alert(1)',
      'JavaScript:alert(1)//https://github.com/a/b',
      'data:text/html,<script>alert(1)</script>',
      'http://github.com/CAM-eEng/CV',
      'https://github.com.evil.example/CAM-eEng/CV',
      'https://evil.example/https://github.com/a/b',
      'https://user@github.com/CAM-eEng/CV',
      'https://github.com/CAM-eEng/CV?x=1',
      'https://github.com/CAM-eEng/CV#x',
      'https://github.com/CAM-eEng/CV/../../evil',
    ])('rejects non-GitHub repo url %s', (url) => {
      expect(ActivitySchema.safeParse(withRepo({ url })).success).toBe(false);
    });

    it.each(['2026-05-26', 'yesterday', '2026-05-26 07:07:28'])(
      'rejects non-ISO-datetime lastPushedAt %s',
      (lastPushedAt) => {
        expect(ActivitySchema.safeParse(withRepo({ lastPushedAt })).success).toBe(false);
      },
    );

    it('strips unknown keys at every level', () => {
      const parsed = ActivitySchema.parse({
        ...withRepo({ html: '<b>x</b>' }),
        injected: true,
        contributions: { days: [], totalLastYear: 0, extra: 1 },
      });
      expect(parsed).not.toHaveProperty('injected');
      expect(parsed.contributions).not.toHaveProperty('extra');
      expect(parsed.repos[0]).not.toHaveProperty('html');
    });

    it('keeps HTML in a description as inert text (escaping is the renderer’s job)', () => {
      const description = '<img src=x onerror=alert(1)><script>alert(1)</script>';
      const parsed = ActivitySchema.parse(withRepo({ description }));
      // The schema does not sanitize; it passes the string through unchanged
      // and React escapes it when rendering text content.
      expect(parsed.repos[0].description).toBe(description);
    });
  });
});
