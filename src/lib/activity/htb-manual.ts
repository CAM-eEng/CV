import { readFile, access } from 'node:fs/promises';
import { z } from 'zod';

const HtbManualSchema = z.object({
  rank: z.string(),
  points: z.number().int().min(0),
  ownedMachines: z.number().int().min(0),
  categories: z.record(z.string(), z.number().int().min(0)),
});

export type HtbManual = z.infer<typeof HtbManualSchema>;

/**
 * Load `data/htb-manual.json` if it exists. Returns null if the file is absent
 * (the common case — most contributors won't have HTB stats to publish).
 *
 * Validates against HtbManualSchema; throws if the file exists but is malformed,
 * so the refresh workflow fails loudly rather than silently dropping stale data.
 */
export async function loadHtbManual(path: string): Promise<HtbManual | null> {
  try {
    await access(path);
  } catch {
    return null;
  }
  const raw = await readFile(path, 'utf8');
  const parsed = JSON.parse(raw);
  return HtbManualSchema.parse(parsed);
}
