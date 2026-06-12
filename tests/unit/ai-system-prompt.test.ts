import { describe, it, expect } from 'vitest';
import { buildSystemPrompt } from '~/lib/ai/system-prompt';
import type { CV } from '~/lib/content/cv-schema';

const cv: CV = {
  basics: {
    name: 'Cameron Hartman',
    label: 'Software Engineer',
    email: 'c@example.com',
    url: 'https://cameronhartman.dev',
    summary: 'Engineer.',
    location: { city: 'San Jose', region: 'CA', countryCode: 'US' },
    profiles: [],
  },
  work: [
    {
      name: 'LitePoint Corp.',
      position: 'Engineer',
      startDate: '2020-07',
      summary: 'Test eqpt firmware.',
      highlights: ['Built X', 'Shipped Y'],
    },
  ],
  education: [],
  skills: [{ name: 'Embedded', keywords: ['C++', 'Python'] }],
  projects: [],
};

describe('buildSystemPrompt', () => {
  it('includes the candidate name and role', () => {
    const prompt = buildSystemPrompt(cv);
    expect(prompt).toContain('Cameron Hartman');
    expect(prompt).toContain('Software Engineer');
  });

  it('includes every work entry with citation keys', () => {
    const prompt = buildSystemPrompt(cv);
    expect(prompt).toContain('LitePoint Corp.');
    expect(prompt).toContain('[work.0.highlights.0]');
    expect(prompt).toContain('[work.0.highlights.1]');
  });

  it('instructs the model to refuse off-topic questions', () => {
    const prompt = buildSystemPrompt(cv);
    expect(prompt.toLowerCase()).toMatch(/only answer.+cameron|refuse.+off-topic|stay on topic/);
  });

  it('instructs the model to cite using bracketed keys', () => {
    const prompt = buildSystemPrompt(cv);
    expect(prompt).toMatch(/\[work\.\d+\.highlights\.\d+\]/);
    expect(prompt.toLowerCase()).toMatch(/cite|citation/);
  });
});
