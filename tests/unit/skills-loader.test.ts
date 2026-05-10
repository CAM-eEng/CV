import { describe, it, expect } from 'vitest';
import { loadSkills } from '~/lib/content/skills-loader';
import { resolve } from 'node:path';

describe('loadSkills', () => {
  it('loads and validates skills.yaml', async () => {
    const skills = await loadSkills(resolve(__dirname, '../../content/skills.yaml'));
    expect(skills.categories).toBeInstanceOf(Array);
    expect(skills.categories.length).toBeGreaterThan(0);
    for (const cat of skills.categories) {
      for (const s of cat.skills) {
        expect(s.last_used).toMatch(/^\d{4}(-\d{2})?$/);
      }
    }
  });
});
