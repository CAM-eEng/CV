import { describe, it, expect } from 'vitest';
import { workExperienceJsonLd } from '~/lib/jsonld/work-experience';

describe('workExperienceJsonLd', () => {
  it('emits one WorkRole per work entry', () => {
    const cv = {
      work: [
        {
          name: 'Litepoint',
          position: 'Firmware Engineer',
          startDate: '2020-06',
          endDate: '2024-12',
          summary: 's',
          highlights: [],
        },
      ],
    } as never;
    const ld = workExperienceJsonLd(cv);
    expect(ld).toHaveLength(1);
    expect(ld[0]['@type']).toBe('WorkRole');
    expect(ld[0].roleName).toBe('Firmware Engineer');
    expect(ld[0].startDate).toBe('2020-06');
    expect(ld[0].endDate).toBe('2024-12');
    expect(ld[0].worksFor['@type']).toBe('Organization');
    expect(ld[0].worksFor.name).toBe('Litepoint');
  });

  it('omits endDate for ongoing roles', () => {
    const cv = {
      work: [
        {
          name: 'Co',
          position: 'Eng',
          startDate: '2025-01',
          summary: '',
          highlights: [],
        },
      ],
    } as never;
    const ld = workExperienceJsonLd(cv);
    expect(ld[0].endDate).toBeUndefined();
  });
});
