import { describe, it, expect } from 'vitest';
import { mergeFreshness } from '~/lib/activity/freshness';
import type { SkillsFile } from '~/lib/content/skills-schema';

describe('mergeFreshness', () => {
  const skills: SkillsFile = {
    categories: [
      {
        name: 'Frontend',
        skills: [
          { name: 'TypeScript', last_used: '2026-04' },
          { name: 'React', last_used: '2026-03' },
        ],
      },
      {
        name: 'Embedded',
        skills: [{ name: 'CircuitPython', last_used: '2026-05' }],
      },
    ],
  };

  it('preserves yaml dates when no github signal is newer', () => {
    const repos = [{ primaryLanguage: 'TypeScript', lastPushedAt: '2026-02-15T00:00:00Z' }];
    const result = mergeFreshness(skills, repos);
    const ts = result.find((r) => r.name === 'TypeScript')!;
    expect(ts.lastUsed).toBe('2026-04');
    expect(ts.source).toBe('skills.yaml');
  });

  it('upgrades when github signal is newer', () => {
    const repos = [{ primaryLanguage: 'TypeScript', lastPushedAt: '2026-05-08T00:00:00Z' }];
    const result = mergeFreshness(skills, repos);
    const ts = result.find((r) => r.name === 'TypeScript')!;
    expect(ts.lastUsed).toBe('2026-05');
    expect(ts.source).toBe('github');
  });

  it('emits one entry per yaml skill, in original order, category preserved', () => {
    const result = mergeFreshness(skills, []);
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.name)).toEqual(['TypeScript', 'React', 'CircuitPython']);
    expect(result[2].category).toBe('Embedded');
  });

  it('matches case-insensitively (CircuitPython vs circuitpython)', () => {
    const repos = [{ primaryLanguage: 'circuitpython', lastPushedAt: '2027-01-01T00:00:00Z' }];
    const result = mergeFreshness(skills, repos);
    const cp = result.find((r) => r.name === 'CircuitPython')!;
    expect(cp.source).toBe('github');
    expect(cp.lastUsed).toBe('2027-01');
  });
});
