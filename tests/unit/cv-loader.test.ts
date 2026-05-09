import { describe, it, expect } from 'vitest';
import { loadCV } from '~/lib/content/cv-loader';
import { resolve } from 'node:path';

describe('loadCV', () => {
  it('loads and validates the canonical cv.yaml', async () => {
    const cv = await loadCV(resolve(__dirname, '../../content/cv.yaml'));
    expect(cv.basics.name).toBeTruthy();
    expect(cv.work).toBeInstanceOf(Array);
  });

  it('throws a descriptive error on invalid YAML', async () => {
    await expect(loadCV('/nonexistent.yaml')).rejects.toThrow();
  });
});
