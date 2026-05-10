import { describe, it, expect } from 'vitest';
import { GET } from '~/pages/cv.json';
import { CVSchema } from '~/lib/content/cv-schema';

describe('/cv.json endpoint', () => {
  it('returns valid JSON Resume shape', async () => {
    const res = await GET({} as never);
    expect(res.headers.get('content-type')).toContain('application/json');
    const body = await res.json();
    expect(() => CVSchema.parse(body)).not.toThrow();
  });
});
