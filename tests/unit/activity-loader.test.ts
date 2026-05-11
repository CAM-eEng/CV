import { describe, it, expect } from 'vitest';
import { loadActivity } from '~/lib/activity/loader';
import { resolve } from 'node:path';

describe('loadActivity', () => {
  it('loads and validates the committed activity.json', async () => {
    const data = await loadActivity(resolve(__dirname, '../../data/activity.json'));
    expect(data.generatedAt).toBeTruthy();
    expect(data.contributions.days).toBeInstanceOf(Array);
  });

  it('throws on nonexistent path', async () => {
    await expect(loadActivity('/nope.json')).rejects.toThrow();
  });
});
