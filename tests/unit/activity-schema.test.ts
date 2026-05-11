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
});
