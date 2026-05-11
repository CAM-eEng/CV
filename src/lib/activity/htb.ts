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

// Claim names HTB or other JWT-issuing services have been observed to use for
// the user identifier. Order matters: first match wins.
const USER_ID_CLAIMS = ['sub', 'id', 'user_id', 'userId', 'uid', 'nameid', 'uname'];

/**
 * Decode a user-identifier claim from a JWT without verifying the signature.
 * We trust the token because it lives in our own repo secrets; the API call
 * itself is the verification. Returns null when no recognised claim is found.
 */
export function decodeJwtSub(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as Record<
      string,
      unknown
    >;
    for (const claim of USER_ID_CLAIMS) {
      const v = payload[claim];
      if ((typeof v === 'string' && v) || (typeof v === 'number' && Number.isFinite(v))) {
        return String(v);
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Inspect a JWT payload and return the list of top-level keys (claim names).
 * Used by the refresh script as a debugging aid when no recognised user-ID
 * claim is present — lets us see what HTB ships without ever logging the
 * actual claim values (i.e. without leaking any token contents).
 */
export function jwtClaimNames(token: string): string[] {
  const parts = token.split('.');
  if (parts.length !== 3) return [];
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as Record<
      string,
      unknown
    >;
    return Object.keys(payload);
  } catch {
    return [];
  }
}

/**
 * As a last resort, ask HTB itself who the token belongs to. v4 of the API
 * exposes /user/info (and historically /users/me); we try both and return the
 * first numeric id we find. Returns null if neither endpoint yields one.
 */
async function fetchHtbUserId(token: string): Promise<string | null> {
  for (const path of ['/user/info', '/users/me']) {
    try {
      const res = await htbFetch(path, token);
      if (!res.ok) continue;
      const body = (await res.json()) as Record<string, unknown>;
      // Look for id anywhere obvious: top level, nested in `info`, `user`, or `profile`.
      const candidates: unknown[] = [
        body.id,
        (body.info as Record<string, unknown> | undefined)?.id,
        (body.user as Record<string, unknown> | undefined)?.id,
        (body.profile as Record<string, unknown> | undefined)?.id,
      ];
      for (const c of candidates) {
        if ((typeof c === 'string' && c) || (typeof c === 'number' && Number.isFinite(c))) {
          return String(c);
        }
      }
    } catch {
      // try next endpoint
    }
  }
  return null;
}

export async function fetchHtbStats(opts: { token: string; userId?: string }): Promise<HtbStats> {
  let userId = opts.userId ?? decodeJwtSub(opts.token);
  if (!userId) {
    const claims = jwtClaimNames(opts.token);
    console.log(
      `HTB: no user-ID claim in JWT (found claims: [${claims.join(', ')}]). Falling back to /user/info.`,
    );
    userId = await fetchHtbUserId(opts.token);
  }
  if (!userId) {
    throw new Error(
      'Could not determine HTB user ID from the token or /user/info — set HTB_USER_ID explicitly.',
    );
  }

  // HTB v4 has moved profile endpoints around over the years. Try the current
  // canonical path first, then known older variants. First 2xx wins.
  const PROFILE_PATHS = [
    `/user/profile/basic/${userId}`,
    `/user/profile/info/${userId}`,
    `/profile/${userId}`,
  ];
  let profile: ReturnType<typeof ProfileSchema.parse> | null = null;
  const attempts: Array<{ path: string; status: number }> = [];
  for (const p of PROFILE_PATHS) {
    const res = await htbFetch(p, opts.token);
    attempts.push({ path: p, status: res.status });
    if (res.ok) {
      try {
        profile = ProfileSchema.parse(await res.json());
        console.log(`HTB: profile resolved via ${p}.`);
        break;
      } catch {
        // schema didn't match this endpoint's shape; keep trying
      }
    }
  }
  if (!profile) {
    throw new Error(
      `HTB profile lookup exhausted all known endpoints: ${attempts
        .map((a) => `${a.path}=${a.status}`)
        .join(', ')}`,
    );
  }

  const CATEGORY_PATHS = [
    `/user/profile/progress/categories/${userId}`,
    `/profile/progress/categories/${userId}`,
  ];
  let categories: Record<string, number> = {};
  for (const p of CATEGORY_PATHS) {
    const res = await htbFetch(p, opts.token);
    if (res.ok) {
      try {
        const parsed = CategoryStatsSchema.parse(await res.json());
        categories = parsed.profile?.ranking_bracket?.categories ?? {};
        break;
      } catch {
        // schema drift — silently drop; last-known-good stays
      }
    }
  }

  return {
    rank: profile.profile.rank ?? 'Unknown',
    points: profile.profile.points ?? 0,
    ownedMachines: profile.profile.owns?.machines ?? 0,
    categories,
  };
}
