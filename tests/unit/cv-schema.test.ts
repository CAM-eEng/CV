import { describe, it, expect } from 'vitest';
import { CVSchema } from '~/lib/content/cv-schema';

describe('CVSchema', () => {
  const minimal = {
    basics: {
      name: 'Cameron Hartman',
      label: 'Firmware Engineer',
      email: 'cameron@example.com',
      url: 'https://cameronhartman.dev',
      summary: 'A summary.',
      profiles: [],
      location: { city: 'San Jose', region: 'CA', countryCode: 'US' },
    },
    work: [],
    education: [],
    skills: [],
    projects: [],
  };

  it('accepts the minimal valid shape', () => {
    const parsed = CVSchema.parse(minimal);
    expect(parsed.basics.name).toBe('Cameron Hartman');
  });

  it('rejects missing basics.name', () => {
    const broken = { ...minimal, basics: { ...minimal.basics, name: undefined } };
    expect(() => CVSchema.parse(broken)).toThrow();
  });

  it('rejects malformed email', () => {
    const broken = { ...minimal, basics: { ...minimal.basics, email: 'not-an-email' } };
    expect(() => CVSchema.parse(broken)).toThrow();
  });

  it('accepts work entries with valid date strings', () => {
    const withWork = {
      ...minimal,
      work: [
        {
          name: 'Litepoint',
          position: 'Firmware Engineer',
          url: 'https://litepoint.com',
          startDate: '2020-06',
          endDate: '2024-12',
          summary: 'Test eqpt firmware',
          highlights: ['Shipped X', 'Built Y'],
        },
      ],
    };
    expect(() => CVSchema.parse(withWork)).not.toThrow();
  });

  it('accepts ongoing work entries (no endDate)', () => {
    const withOngoing = {
      ...minimal,
      work: [
        {
          name: 'Current Co',
          position: 'Engineer',
          startDate: '2025-01',
          summary: '',
          highlights: [],
        },
      ],
    };
    expect(() => CVSchema.parse(withOngoing)).not.toThrow();
  });
});
