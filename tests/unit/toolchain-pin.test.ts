import { describe, it, expect } from 'vitest';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(__dirname, '../..');

describe('toolchain pin', () => {
  it('pins bun exactly in package.json and every workflow, all to the same version', async () => {
    const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8')) as {
      packageManager?: string;
      engines?: { bun?: string };
    };
    const match = pkg.packageManager?.match(/^bun@(\d+\.\d+\.\d+)$/);
    expect(match, 'packageManager must be bun@<exact semver>').not.toBeNull();
    const version = match![1];
    expect(pkg.engines?.bun).toBe(version);

    const dir = resolve(root, '.github/workflows');
    for (const file of await readdir(dir)) {
      const yml = await readFile(resolve(dir, file), 'utf8');
      for (const [, v] of yml.matchAll(/bun-version:\s*(\S+)/g)) {
        expect(v, `${file} bun-version`).toBe(version);
      }
    }
  });
});
