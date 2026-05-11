import { z } from 'zod';

// HackTheBox migrated their REST API from www.hackthebox.com to labs.hackthebox.com
// at some point in 2023–24. The old host returns 404 with an empty body for every
// /api/v4/user/* path; the new host serves them. Source: D3vil0p3r/HackTheBox-API
// community docs + recent PyHackTheBox commits referencing the labs subdomain.
const HTB_BASE = 'https://labs.hackthebox.com/api/v4';

// Profile response shape per Propolisa/htb-api-docs (community-maintained mirror
// of HTB's published Postman collection). The full payload has 30+ fields; we
// keep only the ones we need and let everything else pass through.
const ProfileSchema = z
  .object({
    profile: z
      .object({
        id: z.number().int().optional(),
        rank: z.string().optional(),
        points: z.number().int().optional(),
        user_owns: z.number().int().optional(),
        system_owns: z.number().int().optional(),
      })
      .passthrough(),
  })
  .passthrough();

// Challenge-category breakdown response shape. `challenge_categories` is an
// array of { name, owned_flags, total_flags, ... }; we flatten to a
// name -> owned_flags map for the dashboard's HtbStatsCard.
const ChallengeCategoriesSchema = z
  .object({
    profile: z
      .object({
        challenge_categories: z
          .array(
            z
              .object({
                name: z.string(),
                owned_flags: z.number().int().optional(),
              })
              .passthrough(),
          )
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

export async function fetchHtbStats(opts: { token: string; userId?: string }): Promise<HtbStats> {
  const userId = opts.userId ?? decodeJwtSub(opts.token);
  if (!userId) {
    const claims = jwtClaimNames(opts.token);
    throw new Error(
      `Could not determine HTB user ID. JWT claims present: [${claims.join(', ')}]. ` +
        `Set HTB_USER_ID explicitly to the numeric ID from your HTB profile URL.`,
    );
  }

  const profileRes = await htbFetch(`/user/profile/basic/${userId}`, opts.token);
  if (!profileRes.ok) {
    throw new Error(`HTB profile error (${profileRes.status}): ${await profileRes.text()}`);
  }
  const profile = ProfileSchema.parse(await profileRes.json());

  // Per HTB's profile-card UI, the headline "machines owned" is the count of
  // root pwns (system_owns). We surface that. If the field is absent on the
  // profile (shouldn't happen on a normal account), fall back to user_owns.
  const ownedMachines = profile.profile.system_owns ?? profile.profile.user_owns ?? 0;

  let categories: Record<string, number> = {};
  const catsRes = await htbFetch(`/user/profile/progress/challenges/${userId}`, opts.token);
  if (catsRes.ok) {
    try {
      const parsed = ChallengeCategoriesSchema.parse(await catsRes.json());
      for (const c of parsed.profile?.challenge_categories ?? []) {
        if (c.owned_flags !== undefined) categories[c.name.toLowerCase()] = c.owned_flags;
      }
    } catch {
      // Schema drift — keep categories empty; last-known-good stays in repo.
      categories = {};
    }
  }

  return {
    rank: profile.profile.rank ?? 'Unknown',
    points: profile.profile.points ?? 0,
    ownedMachines,
    categories,
  };
}
