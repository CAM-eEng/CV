import { describe, it, expect } from 'vitest';
import { personJsonLd } from '~/lib/jsonld/person';

describe('personJsonLd', () => {
  const cv = {
    basics: {
      name: 'Cameron Hartman',
      label: 'Engineer',
      email: 'c@example.com',
      url: 'https://cameronhartman.dev',
      summary: 's',
      profiles: [{ network: 'GitHub', username: 'CAM-eEng', url: 'https://github.com/CAM-eEng' }],
      location: { city: 'San Jose', region: 'CA', countryCode: 'US' },
    },
  } as never;

  it('produces a valid Person object', () => {
    const ld = personJsonLd(cv);
    expect(ld['@context']).toBe('https://schema.org');
    expect(ld['@type']).toBe('Person');
    expect(ld.name).toBe('Cameron Hartman');
    expect(ld.email).toBe('mailto:c@example.com');
    expect(ld.url).toBe('https://cameronhartman.dev');
    expect(ld.sameAs).toContain('https://github.com/CAM-eEng');
    expect(ld.address.addressLocality).toBe('San Jose');
  });
});
