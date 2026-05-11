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

/**
 * Decode the `sub` (subject) claim from a JWT without verifying the signature.
 * HackTheBox app tokens are JWTs whose `sub` is the user's numeric ID, so we
 * can derive the user ID from the token alone — no need for a separate
 * HTB_USER_ID secret.
 *
 * Returns null for malformed tokens, missing payloads, or non-JWT strings.
 * Caller is expected to fall back gracefully (or accept an explicit userId).
 */
export function decodeJwtSub(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    const candidate =
      (typeof payload.sub === 'string' || typeof payload.sub === 'number') && payload.sub
        ? String(payload.sub)
        : (typeof payload.id === 'string' || typeof payload.id === 'number') && payload.id
          ? String(payload.id)
          : null;
    return candidate;
  } catch {
    return null;
  }
}

export async function fetchHtbStats(opts: { token: string; userId?: string }): Promise<HtbStats> {
  const userId = opts.userId ?? decodeJwtSub(opts.token);
  if (!userId) {
    throw new Error(
      'Could not determine HTB user ID: pass userId explicitly or use a JWT app token with a sub/id claim.',
    );
  }

  const profileRes = await htbFetch(`/profile/${userId}`, opts.token);
  if (!profileRes.ok)
    throw new Error(`HTB profile error (${profileRes.status}): ${await profileRes.text()}`);
  const profile = ProfileSchema.parse(await profileRes.json());

  const catsRes = await htbFetch(`/profile/progress/categories/${userId}`, opts.token);
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
