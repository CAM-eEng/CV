import { z } from 'zod';

const HTB_BASE = 'https://www.hackthebox.com/api/v4';

const ProfileSchema = z
  .object({
    profile: z
      .object({
        rank: z.string().optional(),
        points: z.number().int().optional(),
        owns: z.object({ machines: z.number().int().optional() }).optional(),
      })
      .passthrough(),
  })
  .passthrough();

const CategoryStatsSchema = z
  .object({
    profile: z
      .object({
        ranking_bracket: z
          .object({
            categories: z.record(z.string(), z.number().int()).optional(),
          })
          .passthrough()
          .optional(),
      })
      .passthrough(),
  })
  .passthrough();

export interface HtbStats {
  rank: string;
  points: number;
  ownedMachines: number;
  categories: Record<string, number>;
}

async function htbFetch(path: string, token: string): Promise<Response> {
  return fetch(`${HTB_BASE}${path}`, {
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/json',
      'user-agent': 'cameronhartman.dev/activity-refresh (CAM-eEng)',
    },
  });
}

export async function fetchHtbStats(opts: { token: string; userId: string }): Promise<HtbStats> {
  const profileRes = await htbFetch(`/profile/${opts.userId}`, opts.token);
  if (!profileRes.ok)
    throw new Error(`HTB profile error (${profileRes.status}): ${await profileRes.text()}`);
  const profile = ProfileSchema.parse(await profileRes.json());

  const catsRes = await htbFetch(`/profile/progress/categories/${opts.userId}`, opts.token);
  let categories: Record<string, number> = {};
  if (catsRes.ok) {
    try {
      const parsed = CategoryStatsSchema.parse(await catsRes.json());
      categories = parsed.profile?.ranking_bracket?.categories ?? {};
    } catch {
      // Schema drift — silently drop, keep last-known-good in repo.
      categories = {};
    }
  }

  return {
    rank: profile.profile.rank ?? 'Unknown',
    points: profile.profile.points ?? 0,
    ownedMachines: profile.profile.owns?.machines ?? 0,
    categories,
  };
}
