import { describe, it, expect } from 'vitest';
import { writeFile, unlink, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadHtbManual } from '~/lib/activity/htb-manual';

const TMP_DIR = resolve(process.cwd(), 'tests/tmp');
const VALID_PATH = resolve(TMP_DIR, 'htb-manual-valid.json');
const BAD_PATH = resolve(TMP_DIR, 'htb-manual-bad.json');

describe('loadHtbManual', () => {
  it('returns null when the file does not exist', async () => {
    expect(await loadHtbManual('/nonexistent.json')).toBeNull();
  });

  it('parses a valid manual JSON file', async () => {
    await mkdir(TMP_DIR, { recursive: true });
    await writeFile(
      VALID_PATH,
      JSON.stringify({
        rank: 'Pro Hacker',
        points: 1234,
        ownedMachines: 42,
        categories: { web: 10, pwn: 8 },
      }),
    );
    try {
      const result = await loadHtbManual(VALID_PATH);
      expect(result?.rank).toBe('Pro Hacker');
      expect(result?.points).toBe(1234);
      expect(result?.categories.web).toBe(10);
    } finally {
      await unlink(VALID_PATH);
    }
  });

  it('throws on malformed JSON', async () => {
    await mkdir(TMP_DIR, { recursive: true });
    await writeFile(BAD_PATH, JSON.stringify({ rank: 'X', points: -1 }));
    try {
      await expect(loadHtbManual(BAD_PATH)).rejects.toThrow();
    } finally {
      await unlink(BAD_PATH);
    }
  });
});
