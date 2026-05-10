import { describe, it, expect } from 'vitest';
import { GET } from '~/pages/llms.txt';

describe('/llms.txt endpoint', () => {
  it('returns plain text', async () => {
    const res = await GET({} as never);
    expect(res.headers.get('content-type')).toContain('text/plain');
  });

  it('includes the candidate name and a link to /cv.json', async () => {
    const res = await GET({} as never);
    const body = await res.text();
    expect(body).toMatch(/Cameron Hartman/);
    expect(body).toContain('/cv.json');
  });

  it('starts with an H1 (per llms.txt convention)', async () => {
    const res = await GET({} as never);
    const body = await res.text();
    expect(body.split('\n')[0]).toMatch(/^# /);
  });
});
