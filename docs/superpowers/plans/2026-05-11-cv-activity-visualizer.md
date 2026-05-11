# CV Activity Visualizer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a build-time activity visualizer to the homepage at `cameronhartman.dev` — a contribution heatmap, top-languages donut, tech-freshness timeline, HackTheBox stats card, and a featured-repo carousel — fed by a nightly GitHub Actions cron that fetches GitHub + HackTheBox APIs.

**Architecture:** A single `data/activity.json` artifact, regenerated nightly on a schedule (and on demand via `workflow_dispatch`) by a GitHub Actions workflow that has access to repo secrets. The site renders the visualizer from that committed JSON — no runtime API calls, no client-side secret handling, no AI inference. Visualizations are hand-rolled React + SVG components (no chart library) to keep the bundle lean and the architecture transparent.

**Tech Stack:** GitHub Actions cron, GitHub REST API v3 (public + authenticated for higher rate limits), HackTheBox API v4, existing Astro/React 19/Tailwind 4 substrate. **No new runtime dependencies.** New dev/script-only dep: nothing required — `node:fetch` is enough.

**Reference docs:**
- Spec: `docs/superpowers/specs/2026-05-09-cv-design.md` (§7.5 and §8.1)
- `READ-BEFORE-BURNING.md` — workflow secret hygiene, PAT rotation
- Plans 1 and 2 (already shipped)

**No T&C gate.** The activity visualizer doesn't perform AI inference and doesn't accept user input; the existing `/playground` T&C gate stays scoped to AI features.

---

## File structure (locked here)

```
src/
├── lib/
│   └── activity/
│       ├── schema.ts           # Zod schema for data/activity.json
│       ├── loader.ts           # load + validate activity.json (build-time)
│       ├── github.ts           # GitHub API fetchers (used only by refresh script)
│       ├── htb.ts              # HackTheBox API fetchers (used only by refresh script)
│       └── freshness.ts        # merge skills.yaml + activity into freshness timeline
├── components/
│   └── activity/
│       ├── ContributionHeatmap.tsx
│       ├── LanguagesDonut.tsx
│       ├── FreshnessTimeline.tsx
│       ├── HtbStatsCard.tsx
│       ├── FeaturedRepoCarousel.tsx
│       └── ActivityDashboard.tsx        # composition wrapper
data/
└── activity.json                         # committed, regenerated nightly
scripts/
└── refresh-activity.ts                   # invoked by the workflow
.github/
└── workflows/
    └── refresh-activity.yml              # cron + workflow_dispatch
src/pages/
└── index.astro                           # MODIFY: insert <ActivityDashboard client:visible />
tests/
├── unit/
│   ├── activity-schema.test.ts
│   ├── activity-loader.test.ts
│   ├── activity-freshness.test.ts
│   └── activity-github.test.ts            # mocked-fetch tests for fetchers
└── e2e/
    └── activity-dashboard.spec.ts         # 1 spec: dashboard visible on /
```

**Splitting rationale.**
- `lib/activity/github.ts` and `lib/activity/htb.ts` are isolated so they can be unit-tested with mocked `fetch` and reused only by the refresh script (never imported into client code — keeps the client bundle free of API logic).
- One viz component per file. Each is independent SVG; no chart library needed.
- `freshness.ts` is its own module because it combines two data sources (`skills.yaml` + computed dates from activity) and benefits from focused testing.

---

## Decisions baked in

- **Build-time fetch, not runtime.** The dashboard renders from a committed `data/activity.json`. A nightly cron regenerates it. If the fetch fails the workflow exits non-zero and the last-known-good JSON stays in repo — site keeps rendering. No live API calls from visitor browsers.
- **No chart library.** Each component is a small React + SVG file. Bundle stays small, the implementation itself becomes part of the portfolio.
- **Featured repos come from `cv.yaml`'s `projects[].featured: true`.** The refresh script enriches those with live GitHub metadata (stars, last commit) and writes that into `activity.json`.
- **Tech freshness merges two sources.** `skills.yaml` provides categorized skills with `last_used` dates. The refresh script also looks at GitHub repos to bump `last_used` to the date of the most recent commit using each language. Final dates are written into `activity.json` so the timeline renders deterministically.
- **HackTheBox API stability is a known risk** (the spec flagged this in §12). The HTB fetcher Zod-validates the response with `.passthrough()` and silently drops unexpected fields. If the API breaks entirely, the workflow logs the error, exits non-zero, and the deploy doesn't update — last-known-good JSON wins.
- **Workflow trigger discipline (per spec §8.1 and `READ-BEFORE-BURNING.md`):** `refresh-activity.yml` triggers only on `schedule:` and `workflow_dispatch`, never on `pull_request`. All third-party Actions pinned to commit SHA.
- **Initial empty JSON.** Before the first cron runs, `data/activity.json` exists with stubbed content so the build doesn't break.

---

## Task 1: Activity schema

**Files:**
- Create: `src/lib/activity/schema.ts`, `tests/unit/activity-schema.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/activity-schema.test.ts
import { describe, it, expect } from 'vitest';
import { ActivitySchema } from '~/lib/activity/schema';

describe('ActivitySchema', () => {
  const minimal = {
    generatedAt: '2026-05-11T03:00:00Z',
    contributions: { days: [], totalLastYear: 0 },
    languages: [],
    repos: [],
    htb: null,
    freshness: [],
  };

  it('accepts the minimal valid shape', () => {
    expect(() => ActivitySchema.parse(minimal)).not.toThrow();
  });

  it('accepts a contributions.days entry', () => {
    const withDay = {
      ...minimal,
      contributions: { days: [{ date: '2026-05-10', count: 4 }], totalLastYear: 4 },
    };
    expect(() => ActivitySchema.parse(withDay)).not.toThrow();
  });

  it('rejects negative contribution count', () => {
    const bad = { ...minimal, contributions: { days: [{ date: '2026-05-10', count: -1 }], totalLastYear: 0 } };
    expect(() => ActivitySchema.parse(bad)).toThrow();
  });

  it('accepts an HTB block when present', () => {
    const withHtb = {
      ...minimal,
      htb: { rank: 'Pro Hacker', points: 1234, ownedMachines: 42, categories: { web: 10, pwn: 8 } },
    };
    expect(() => ActivitySchema.parse(withHtb)).not.toThrow();
  });

  it('accepts a freshness entry', () => {
    const withFresh = {
      ...minimal,
      freshness: [{ name: 'TypeScript', category: 'Frontend', lastUsed: '2026-05', source: 'skills.yaml' }],
    };
    expect(() => ActivitySchema.parse(withFresh)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
PATH="$HOME/.bun/bin:$PATH" bun run test tests/unit/activity-schema.test.ts
```

- [ ] **Step 3: Write `src/lib/activity/schema.ts`**

```ts
import { z } from 'zod';

const DateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const YearOrYearMonth = z.string().regex(/^\d{4}(-\d{2})?$/);

const ContributionDay = z.object({
  date: DateString,
  count: z.number().int().min(0),
});

const Language = z.object({
  name: z.string(),
  bytes: z.number().int().min(0),
});

const Repo = z.object({
  name: z.string(),
  description: z.string().nullable(),
  url: z.string().url(),
  stars: z.number().int().min(0),
  forks: z.number().int().min(0),
  lastPushedAt: z.string(),
  primaryLanguage: z.string().nullable(),
});

const HtbStats = z.object({
  rank: z.string(),
  points: z.number().int().min(0),
  ownedMachines: z.number().int().min(0),
  categories: z.record(z.string(), z.number().int().min(0)),
});

const FreshnessEntry = z.object({
  name: z.string(),
  category: z.string(),
  lastUsed: YearOrYearMonth,
  source: z.enum(['skills.yaml', 'github']),
});

export const ActivitySchema = z.object({
  generatedAt: z.string().datetime(),
  contributions: z.object({
    days: z.array(ContributionDay),
    totalLastYear: z.number().int().min(0),
  }),
  languages: z.array(Language),
  repos: z.array(Repo),
  htb: HtbStats.nullable(),
  freshness: z.array(FreshnessEntry),
});

export type Activity = z.infer<typeof ActivitySchema>;
```

- [ ] **Step 4: Run, expect pass**

```bash
PATH="$HOME/.bun/bin:$PATH" bun run test tests/unit/activity-schema.test.ts
```

Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/activity/schema.ts tests/unit/activity-schema.test.ts
git commit -m "$(cat <<'EOF'
feat(activity): Zod schema for data/activity.json

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Activity loader + initial empty JSON

**Files:**
- Create: `src/lib/activity/loader.ts`, `data/activity.json`, `tests/unit/activity-loader.test.ts`

- [ ] **Step 1: Write `data/activity.json` (empty-but-valid stub)**

```json
{
  "generatedAt": "2026-05-11T00:00:00Z",
  "contributions": { "days": [], "totalLastYear": 0 },
  "languages": [],
  "repos": [],
  "htb": null,
  "freshness": []
}
```

- [ ] **Step 2: Write the failing test**

```ts
// tests/unit/activity-loader.test.ts
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
```

- [ ] **Step 3: Run, expect fail**

```bash
PATH="$HOME/.bun/bin:$PATH" bun run test tests/unit/activity-loader.test.ts
```

- [ ] **Step 4: Write `src/lib/activity/loader.ts`**

```ts
import { readFile } from 'node:fs/promises';
import { ActivitySchema, type Activity } from './schema';

export async function loadActivity(path: string): Promise<Activity> {
  const raw = await readFile(path, 'utf8');
  const parsed = JSON.parse(raw);
  const result = ActivitySchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`activity.json validation failed at ${path}:\n${result.error.toString()}`);
  }
  return result.data;
}
```

- [ ] **Step 5: Run, expect pass**

```bash
PATH="$HOME/.bun/bin:$PATH" bun run test tests/unit/activity-loader.test.ts
```

Expected: 2 passed.

- [ ] **Step 6: Commit**

```bash
git add src/lib/activity/loader.ts data/activity.json tests/unit/activity-loader.test.ts
git commit -m "$(cat <<'EOF'
feat(activity): loader + empty-but-valid stub

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: GitHub API fetcher

**Files:**
- Create: `src/lib/activity/github.ts`, `tests/unit/activity-github.test.ts`

The fetcher reads three things from GitHub's REST API: user's public repos, languages-per-repo, and contribution counts (via GraphQL).

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/activity-github.test.ts
import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { fetchGithubActivity } from '~/lib/activity/github';

let fetchSpy: MockInstance<typeof fetch>;
beforeEach(() => { fetchSpy = vi.spyOn(globalThis, 'fetch'); });
afterEach(() => fetchSpy.mockRestore());

const ok = (body: object) => new Response(JSON.stringify(body), { status: 200 });

describe('fetchGithubActivity', () => {
  it('sends Authorization Bearer token', async () => {
    fetchSpy.mockResolvedValue(ok({ data: { user: { contributionsCollection: { contributionCalendar: { totalContributions: 0, weeks: [] } } } } }));
    await fetchGithubActivity({ token: 'ghp_xxx', login: 'CAM-eEng' }).catch(() => null);
    const headers = (fetchSpy.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers['authorization']).toBe('Bearer ghp_xxx');
    expect(headers['accept']).toContain('application/json');
  });

  it('flattens GraphQL contribution weeks into a flat days array', async () => {
    fetchSpy.mockResolvedValueOnce(ok({
      data: {
        user: {
          contributionsCollection: {
            contributionCalendar: {
              totalContributions: 7,
              weeks: [
                { contributionDays: [
                  { date: '2026-05-04', contributionCount: 1 },
                  { date: '2026-05-05', contributionCount: 2 },
                ] },
                { contributionDays: [
                  { date: '2026-05-11', contributionCount: 4 },
                ] },
              ],
            },
          },
        },
      },
    }));
    // Subsequent calls (repos, languages) return empty so test focuses on calendar parsing.
    fetchSpy.mockResolvedValue(ok([]));

    const result = await fetchGithubActivity({ token: 't', login: 'u' });
    expect(result.contributions.totalLastYear).toBe(7);
    expect(result.contributions.days).toHaveLength(3);
    expect(result.contributions.days[0]).toEqual({ date: '2026-05-04', count: 1 });
  });

  it('throws on non-200', async () => {
    fetchSpy.mockResolvedValue(new Response('{"message":"bad credentials"}', { status: 401 }));
    await expect(fetchGithubActivity({ token: 't', login: 'u' })).rejects.toThrow(/bad credentials/);
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
PATH="$HOME/.bun/bin:$PATH" bun run test tests/unit/activity-github.test.ts
```

- [ ] **Step 3: Write `src/lib/activity/github.ts`**

```ts
const GRAPHQL_URL = 'https://api.github.com/graphql';
const REST_BASE = 'https://api.github.com';

interface ContributionDay { date: string; count: number }
interface Language { name: string; bytes: number }
interface Repo {
  name: string;
  description: string | null;
  url: string;
  stars: number;
  forks: number;
  lastPushedAt: string;
  primaryLanguage: string | null;
}

interface GithubActivity {
  contributions: { days: ContributionDay[]; totalLastYear: number };
  languages: Language[];
  repos: Repo[];
}

interface GhCalendarWeek {
  contributionDays: Array<{ date: string; contributionCount: number }>;
}

interface GhContributionsResponse {
  data?: {
    user?: {
      contributionsCollection?: {
        contributionCalendar?: {
          totalContributions?: number;
          weeks?: GhCalendarWeek[];
        };
      };
    };
  };
  message?: string;
  errors?: Array<{ message: string }>;
}

interface GhRepo {
  name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  forks_count: number;
  pushed_at: string;
  language: string | null;
  fork: boolean;
  archived: boolean;
}

async function ghFetch(url: string, token: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      ...(init.headers ?? {}),
    },
  });
}

async function fetchContributions(token: string, login: string): Promise<GithubActivity['contributions']> {
  const query = `
    query($login: String!) {
      user(login: $login) {
        contributionsCollection {
          contributionCalendar {
            totalContributions
            weeks { contributionDays { date contributionCount } }
          }
        }
      }
    }
  `;
  const res = await ghFetch(GRAPHQL_URL, token, {
    method: 'POST',
    body: JSON.stringify({ query, variables: { login } }),
  });
  if (!res.ok) throw new Error(`GitHub GraphQL error (${res.status}): ${await res.text()}`);
  const json = (await res.json()) as GhContributionsResponse;
  if (json.errors?.length) throw new Error(`GitHub GraphQL errors: ${json.errors.map((e) => e.message).join('; ')}`);
  const cal = json.data?.user?.contributionsCollection?.contributionCalendar;
  const days: ContributionDay[] = [];
  for (const week of cal?.weeks ?? []) {
    for (const day of week.contributionDays) {
      days.push({ date: day.date, count: day.contributionCount });
    }
  }
  return { days, totalLastYear: cal?.totalContributions ?? 0 };
}

async function fetchRepos(token: string, login: string): Promise<Repo[]> {
  const res = await ghFetch(`${REST_BASE}/users/${login}/repos?per_page=100&sort=pushed&type=public`, token);
  if (!res.ok) throw new Error(`GitHub repos error (${res.status}): ${await res.text()}`);
  const json = (await res.json()) as GhRepo[];
  return json
    .filter((r) => !r.fork && !r.archived)
    .map((r) => ({
      name: r.name,
      description: r.description,
      url: r.html_url,
      stars: r.stargazers_count,
      forks: r.forks_count,
      lastPushedAt: r.pushed_at,
      primaryLanguage: r.language,
    }));
}

async function fetchLanguages(token: string, login: string, repos: Repo[]): Promise<Language[]> {
  const byLang = new Map<string, number>();
  // Cap at 30 repos for rate-limit hygiene.
  for (const r of repos.slice(0, 30)) {
    const res = await ghFetch(`${REST_BASE}/repos/${login}/${r.name}/languages`, token);
    if (!res.ok) continue;
    const json = (await res.json()) as Record<string, number>;
    for (const [name, bytes] of Object.entries(json)) {
      byLang.set(name, (byLang.get(name) ?? 0) + bytes);
    }
  }
  return [...byLang.entries()]
    .map(([name, bytes]) => ({ name, bytes }))
    .sort((a, b) => b.bytes - a.bytes);
}

export async function fetchGithubActivity(opts: { token: string; login: string }): Promise<GithubActivity> {
  const contributions = await fetchContributions(opts.token, opts.login);
  const repos = await fetchRepos(opts.token, opts.login);
  const languages = await fetchLanguages(opts.token, opts.login, repos);
  return { contributions, languages, repos };
}
```

- [ ] **Step 4: Run, expect pass**

```bash
PATH="$HOME/.bun/bin:$PATH" bun run test tests/unit/activity-github.test.ts
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/activity/github.ts tests/unit/activity-github.test.ts
git commit -m "$(cat <<'EOF'
feat(activity): GitHub API fetcher (contributions + repos + languages)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: HackTheBox API fetcher

**Files:**
- Create: `src/lib/activity/htb.ts`

HTB's v4 API is undocumented; the implementation must be tolerant of unexpected fields.

- [ ] **Step 1: Write `src/lib/activity/htb.ts`**

```ts
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
  if (!profileRes.ok) throw new Error(`HTB profile error (${profileRes.status}): ${await profileRes.text()}`);
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
```

> No unit tests for `htb.ts` — the API surface is undocumented and likely to drift; the schemas use `.passthrough()` and the fetcher swallows category-stat schema drift. Failure mode: if the *profile* endpoint changes shape, `fetchHtbStats` throws, the refresh workflow exits non-zero, last-known-good `data/activity.json` stays in repo and the site keeps rendering. That's the design; testing the schema's `.passthrough()` behavior wouldn't catch real drift.

- [ ] **Step 2: Verify it compiles**

```bash
PATH="$HOME/.bun/bin:$PATH" bun run lint
PATH="$HOME/.bun/bin:$PATH" bun run build
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/activity/htb.ts
git commit -m "$(cat <<'EOF'
feat(activity): HackTheBox v4 API fetcher with passthrough schemas

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Tech-freshness merger

**Files:**
- Create: `src/lib/activity/freshness.ts`, `tests/unit/activity-freshness.test.ts`

Merges `skills.yaml` (hand-authored `last_used`) with GitHub repo-language activity. If a skill has a GitHub-derived date newer than its YAML date, use the GitHub date and mark source as 'github'; otherwise keep the YAML date with source 'skills.yaml'.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/activity-freshness.test.ts
import { describe, it, expect } from 'vitest';
import { mergeFreshness } from '~/lib/activity/freshness';

describe('mergeFreshness', () => {
  const skills = {
    categories: [
      { name: 'Frontend', skills: [
        { name: 'TypeScript', last_used: '2026-04' },
        { name: 'React', last_used: '2026-03' },
      ] },
      { name: 'Embedded', skills: [
        { name: 'CircuitPython', last_used: '2026-05' },
      ] },
    ],
  };

  it('preserves yaml dates when no github signal is newer', () => {
    const repos = [{ primaryLanguage: 'TypeScript', lastPushedAt: '2026-02-15T00:00:00Z' }];
    const result = mergeFreshness(skills, repos);
    const ts = result.find((r) => r.name === 'TypeScript')!;
    expect(ts.lastUsed).toBe('2026-04');
    expect(ts.source).toBe('skills.yaml');
  });

  it('upgrades when github signal is newer', () => {
    const repos = [{ primaryLanguage: 'TypeScript', lastPushedAt: '2026-05-08T00:00:00Z' }];
    const result = mergeFreshness(skills, repos);
    const ts = result.find((r) => r.name === 'TypeScript')!;
    expect(ts.lastUsed).toBe('2026-05');
    expect(ts.source).toBe('github');
  });

  it('emits one entry per yaml skill, in original order, category preserved', () => {
    const result = mergeFreshness(skills, []);
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.name)).toEqual(['TypeScript', 'React', 'CircuitPython']);
    expect(result[2].category).toBe('Embedded');
  });

  it('matches case-insensitively (CircuitPython vs circuitpython)', () => {
    const repos = [{ primaryLanguage: 'circuitpython', lastPushedAt: '2027-01-01T00:00:00Z' }];
    const result = mergeFreshness(skills, repos);
    const cp = result.find((r) => r.name === 'CircuitPython')!;
    expect(cp.source).toBe('github');
    expect(cp.lastUsed).toBe('2027-01');
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
PATH="$HOME/.bun/bin:$PATH" bun run test tests/unit/activity-freshness.test.ts
```

- [ ] **Step 3: Write `src/lib/activity/freshness.ts`**

```ts
import type { SkillsFile } from '~/lib/content/skills-schema';

interface RepoMinimal {
  primaryLanguage: string | null;
  lastPushedAt: string;
}

interface FreshnessEntry {
  name: string;
  category: string;
  lastUsed: string;       // YYYY-MM
  source: 'skills.yaml' | 'github';
}

function isoToYearMonth(iso: string): string {
  return iso.slice(0, 7);
}

function compareYearMonth(a: string, b: string): number {
  return a.localeCompare(b);
}

export function mergeFreshness(skills: SkillsFile, repos: RepoMinimal[]): FreshnessEntry[] {
  const ghByLang = new Map<string, string>();
  for (const r of repos) {
    if (!r.primaryLanguage) continue;
    const lang = r.primaryLanguage.toLowerCase();
    const ym = isoToYearMonth(r.lastPushedAt);
    const prev = ghByLang.get(lang);
    if (!prev || compareYearMonth(ym, prev) > 0) ghByLang.set(lang, ym);
  }

  const out: FreshnessEntry[] = [];
  for (const cat of skills.categories) {
    for (const s of cat.skills) {
      const yamlMonth = s.last_used.length === 4 ? `${s.last_used}-01` : s.last_used;
      const ghMonth = ghByLang.get(s.name.toLowerCase());
      const useGh = ghMonth && compareYearMonth(ghMonth, yamlMonth) > 0;
      out.push({
        name: s.name,
        category: cat.name,
        lastUsed: useGh ? ghMonth! : yamlMonth,
        source: useGh ? 'github' : 'skills.yaml',
      });
    }
  }
  return out;
}
```

- [ ] **Step 4: Run, expect pass**

```bash
PATH="$HOME/.bun/bin:$PATH" bun run test tests/unit/activity-freshness.test.ts
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/activity/freshness.ts tests/unit/activity-freshness.test.ts
git commit -m "$(cat <<'EOF'
feat(activity): tech-freshness merger (skills.yaml + GitHub language signals)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Refresh script

**Files:**
- Create: `scripts/refresh-activity.ts`

The script invoked by the workflow. Composes the three fetchers and writes `data/activity.json`.

- [ ] **Step 1: Write the script**

```ts
// scripts/refresh-activity.ts
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ActivitySchema } from '~/lib/activity/schema';
import { fetchGithubActivity } from '~/lib/activity/github';
import { fetchHtbStats } from '~/lib/activity/htb';
import { mergeFreshness } from '~/lib/activity/freshness';
import { loadSkills } from '~/lib/content/skills-loader';

const REQUIRED_ENV = ['GH_API_TOKEN', 'GH_LOGIN'] as const;
const OPTIONAL_ENV = ['HTB_API_TOKEN', 'HTB_USER_ID'] as const;

function readEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

async function main() {
  for (const k of REQUIRED_ENV) readEnv(k);

  const ghLogin = readEnv('GH_LOGIN');
  const ghToken = readEnv('GH_API_TOKEN');

  console.log(`Fetching GitHub activity for ${ghLogin}…`);
  const gh = await fetchGithubActivity({ token: ghToken, login: ghLogin });

  let htb = null;
  if (process.env.HTB_API_TOKEN && process.env.HTB_USER_ID) {
    try {
      console.log('Fetching HackTheBox stats…');
      htb = await fetchHtbStats({ token: process.env.HTB_API_TOKEN, userId: process.env.HTB_USER_ID });
    } catch (e) {
      console.error('HTB fetch failed, continuing with htb=null:', e instanceof Error ? e.message : String(e));
    }
  } else {
    console.log('HTB env not configured; skipping.');
  }

  const skills = await loadSkills(resolve(process.cwd(), 'content/skills.yaml'));
  const freshness = mergeFreshness(skills, gh.repos);

  const activity = {
    generatedAt: new Date().toISOString(),
    contributions: gh.contributions,
    languages: gh.languages,
    repos: gh.repos,
    htb,
    freshness,
  };

  // Validate before writing — fail loud if our own shape drifted.
  ActivitySchema.parse(activity);

  const outPath = resolve(process.cwd(), 'data/activity.json');
  await writeFile(outPath, JSON.stringify(activity, null, 2) + '\n', 'utf8');
  console.log(`Wrote ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

> Note: this references `OPTIONAL_ENV` only for documentation — TypeScript may flag it as unused. Either remove it or annotate.

- [ ] **Step 2: Add an npm script**

In `package.json`, add to the `scripts` section:

```json
"refresh-activity": "bun run scripts/refresh-activity.ts"
```

- [ ] **Step 3: Compile-check**

```bash
PATH="$HOME/.bun/bin:$PATH" bun run lint
PATH="$HOME/.bun/bin:$PATH" bun run build
```

- [ ] **Step 4: Commit**

```bash
git add scripts/refresh-activity.ts package.json bun.lock
git commit -m "$(cat <<'EOF'
feat(activity): refresh-activity script — composes fetchers, writes data/activity.json

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: GitHub Actions refresh workflow

**Files:**
- Create: `.github/workflows/refresh-activity.yml`

**Critical:** this workflow holds secrets. Triggers must NEVER include `pull_request` or `pull_request_target`.

- [ ] **Step 1: Write the workflow**

```yaml
name: refresh-activity

on:
  schedule:
    - cron: '0 6 * * *'   # 06:00 UTC nightly
  workflow_dispatch:

permissions:
  contents: write    # so the workflow can commit data/activity.json

concurrency:
  group: refresh-activity
  cancel-in-progress: false

jobs:
  refresh:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@692973e3d937129bcbf40652eb9f2f61becf3332  # v4.1.7
        with:
          token: ${{ secrets.GITHUB_TOKEN }}

      - uses: oven-sh/setup-bun@4bc047ad259df6fc24a6c9b0f9a0cb08cf17fbe5  # v2.0.1
        with:
          bun-version: latest

      - name: Install
        run: bun install --frozen-lockfile

      - name: Refresh activity
        env:
          GH_API_TOKEN: ${{ secrets.GH_API_TOKEN }}
          GH_LOGIN: CAM-eEng
          HTB_API_TOKEN: ${{ secrets.HTB_API_TOKEN }}
          HTB_USER_ID: ${{ secrets.HTB_USER_ID }}
        run: bun run refresh-activity

      - name: Commit & push if changed
        run: |
          if git diff --quiet data/activity.json; then
            echo "No changes."
            exit 0
          fi
          git config user.name 'github-actions[bot]'
          git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
          git add data/activity.json
          git commit -m "chore(activity): nightly refresh ($(date -u +%Y-%m-%dT%H:%MZ))"
          git push
```

> `permissions: contents: write` is required so the bot can push the updated `data/activity.json`. This is the minimum scope — no `id-token`, no `pages` write, no `actions` write.

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/refresh-activity.yml
git commit -m "$(cat <<'EOF'
ci: nightly refresh-activity workflow (cron + workflow_dispatch only)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

> The workflow will fail until the repo secrets `GH_API_TOKEN`, `HTB_API_TOKEN`, `HTB_USER_ID` are configured (Task 15). It's safe to commit — without secrets the workflow exits non-zero and `data/activity.json` is unchanged.

---

## Task 8: Contribution heatmap

**Files:**
- Create: `src/components/activity/ContributionHeatmap.tsx`

Hand-rolled SVG. 53 columns × 7 rows; each cell is a small `<rect>`; intensity bucketed into 5 levels.

- [ ] **Step 1: Write the component**

```tsx
import type { Activity } from '~/lib/activity/schema';

interface Props {
  days: Activity['contributions']['days'];
}

const CELL = 11;
const GAP = 3;
const ROWS = 7;
const WEEKS = 53;

function bucket(count: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (count === 0) return 0;
  const ratio = count / max;
  if (ratio < 0.25) return 1;
  if (ratio < 0.5) return 2;
  if (ratio < 0.75) return 3;
  return 4;
}

const BUCKET_FILL = [
  'fill-neutral-200 dark:fill-neutral-800',
  'fill-green-200 dark:fill-green-900',
  'fill-green-400 dark:fill-green-700',
  'fill-green-500 dark:fill-green-500',
  'fill-green-600 dark:fill-green-400',
];

export function ContributionHeatmap({ days }: Props) {
  // Bucket by week starting from Sunday of the earliest date.
  const byDate = new Map(days.map((d) => [d.date, d.count]));
  const max = Math.max(1, ...days.map((d) => d.count));

  const today = new Date();
  // Show last 53 weeks ending Saturday of the current week.
  const end = new Date(today);
  end.setDate(end.getDate() + (6 - end.getDay()));
  const start = new Date(end);
  start.setDate(end.getDate() - WEEKS * 7 + 1);

  const cells: Array<{ x: number; y: number; count: number; date: string }> = [];
  for (let w = 0; w < WEEKS; w++) {
    for (let d = 0; d < ROWS; d++) {
      const cur = new Date(start);
      cur.setDate(start.getDate() + w * 7 + d);
      const date = cur.toISOString().slice(0, 10);
      cells.push({ x: w * (CELL + GAP), y: d * (CELL + GAP), count: byDate.get(date) ?? 0, date });
    }
  }

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${WEEKS * (CELL + GAP)} ${ROWS * (CELL + GAP)}`}
        role="img"
        aria-label="GitHub contributions over the last year"
        className="w-full max-w-2xl"
      >
        {cells.map((c) => (
          <rect
            key={c.date}
            x={c.x}
            y={c.y}
            width={CELL}
            height={CELL}
            rx={2}
            className={BUCKET_FILL[bucket(c.count, max)]}
          >
            <title>{`${c.date}: ${c.count} contributions`}</title>
          </rect>
        ))}
      </svg>
    </div>
  );
}
```

- [ ] **Step 2: Compile-check**

```bash
PATH="$HOME/.bun/bin:$PATH" bun run lint
PATH="$HOME/.bun/bin:$PATH" bun run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/activity/ContributionHeatmap.tsx
git commit -m "$(cat <<'EOF'
feat(activity): ContributionHeatmap — 53-week SVG grid

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Top languages donut

**Files:**
- Create: `src/components/activity/LanguagesDonut.tsx`

Hand-rolled SVG donut showing top 6 languages by byte count.

- [ ] **Step 1: Write the component**

```tsx
import type { Activity } from '~/lib/activity/schema';

const COLORS = ['#22c55e', '#3b82f6', '#a855f7', '#f97316', '#ef4444', '#facc15'];

interface Props {
  languages: Activity['languages'];
}

export function LanguagesDonut({ languages }: Props) {
  const top = languages.slice(0, 6);
  const total = top.reduce((sum, l) => sum + l.bytes, 0) || 1;
  const radius = 36;
  const stroke = 12;
  const circ = 2 * Math.PI * radius;

  let offset = 0;
  const arcs = top.map((l, i) => {
    const frac = l.bytes / total;
    const arc = { ...l, color: COLORS[i % COLORS.length], dashOffset: offset, dashArray: circ * frac };
    offset += circ * frac;
    return arc;
  });

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 80 80" className="w-24 h-24 -rotate-90">
        <circle cx={40} cy={40} r={radius} stroke="rgba(0,0,0,.08)" strokeWidth={stroke} fill="none" />
        {arcs.map((a, i) => (
          <circle
            key={i}
            cx={40}
            cy={40}
            r={radius}
            stroke={a.color}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${a.dashArray} ${circ - a.dashArray}`}
            strokeDashoffset={-a.dashOffset}
          />
        ))}
      </svg>
      <ul className="text-xs space-y-1">
        {arcs.map((a, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-sm" style={{ background: a.color }} />
            <span className="font-mono">{a.name}</span>
            <span className="text-neutral-500">{((a.bytes / total) * 100).toFixed(0)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/activity/LanguagesDonut.tsx
git commit -m "$(cat <<'EOF'
feat(activity): LanguagesDonut — top-6 by-byte SVG donut

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Tech freshness timeline

**Files:**
- Create: `src/components/activity/FreshnessTimeline.tsx`

Horizontal bar per skill, length proportional to how recently it was used. "Today" anchored at the right.

- [ ] **Step 1: Write the component**

```tsx
import type { Activity } from '~/lib/activity/schema';

interface Props {
  freshness: Activity['freshness'];
}

function monthsAgo(yyyymm: string): number {
  const [y, m] = yyyymm.split('-').map(Number);
  const target = new Date(y, (m ?? 1) - 1, 1);
  const now = new Date();
  return (now.getFullYear() - target.getFullYear()) * 12 + (now.getMonth() - target.getMonth());
}

export function FreshnessTimeline({ freshness }: Props) {
  if (!freshness.length) return null;
  const MAX_MONTHS = 24;  // anything older than 2 years gets a min-length bar

  // Group by category for visual structure.
  const byCategory = new Map<string, typeof freshness>();
  for (const f of freshness) {
    if (!byCategory.has(f.category)) byCategory.set(f.category, []);
    byCategory.get(f.category)!.push(f);
  }

  return (
    <div className="space-y-4">
      {[...byCategory.entries()].map(([category, items]) => (
        <section key={category}>
          <h4 className="text-xs uppercase tracking-wider text-neutral-500 mb-2">{category}</h4>
          <ul className="space-y-1.5">
            {items.map((f) => {
              const months = monthsAgo(f.lastUsed);
              const ratio = Math.max(0, Math.min(1, 1 - months / MAX_MONTHS));
              const widthPct = Math.max(8, ratio * 100);
              const fresh = months <= 3;
              return (
                <li key={f.name} className="text-xs flex items-center gap-3">
                  <span className="w-32 truncate font-mono">{f.name}</span>
                  <div className="flex-1 bg-neutral-100 dark:bg-neutral-900 rounded h-2 overflow-hidden">
                    <div
                      className={`h-full ${fresh ? 'bg-green-500' : ratio > 0.4 ? 'bg-amber-500' : 'bg-neutral-400 dark:bg-neutral-700'}`}
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                  <span className="w-16 tabular-nums text-neutral-500 text-right">{f.lastUsed}</span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/activity/FreshnessTimeline.tsx
git commit -m "$(cat <<'EOF'
feat(activity): FreshnessTimeline — horizontal bars per skill, grouped by category

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: HackTheBox stats card

**Files:**
- Create: `src/components/activity/HtbStatsCard.tsx`

- [ ] **Step 1: Write the component**

```tsx
import type { Activity } from '~/lib/activity/schema';

interface Props {
  htb: Activity['htb'];
}

export function HtbStatsCard({ htb }: Props) {
  if (!htb) return null;
  const sortedCats = Object.entries(htb.categories).sort((a, b) => b[1] - a[1]);
  return (
    <div className="border border-neutral-200 dark:border-neutral-800 rounded p-5 space-y-3">
      <header className="flex items-baseline justify-between">
        <h4 className="font-medium">HackTheBox</h4>
        <span className="text-xs uppercase tracking-wider text-neutral-500">{htb.rank}</span>
      </header>
      <div className="flex items-baseline gap-6">
        <div>
          <div className="text-3xl font-semibold tabular-nums">{htb.points.toLocaleString()}</div>
          <div className="text-xs text-neutral-500">points</div>
        </div>
        <div>
          <div className="text-3xl font-semibold tabular-nums">{htb.ownedMachines}</div>
          <div className="text-xs text-neutral-500">machines owned</div>
        </div>
      </div>
      {sortedCats.length > 0 && (
        <ul className="text-xs space-y-1">
          {sortedCats.map(([cat, n]) => (
            <li key={cat} className="flex justify-between">
              <span className="font-mono">{cat}</span>
              <span className="tabular-nums text-neutral-500">{n}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/activity/HtbStatsCard.tsx
git commit -m "$(cat <<'EOF'
feat(activity): HtbStatsCard — rank, points, machines, category breakdown

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Featured repo carousel

**Files:**
- Create: `src/components/activity/FeaturedRepoCarousel.tsx`

Filters live repo data to those whose name matches a `featured: true` project in `cv.yaml`. Renders a row of cards with star/fork count and last-pushed date.

- [ ] **Step 1: Write the component**

```tsx
import type { Activity } from '~/lib/activity/schema';
import type { CV } from '~/lib/content/cv-schema';

interface Props {
  repos: Activity['repos'];
  projects: CV['projects'];
}

function relativeDate(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days < 7) return `${days}d ago`;
  if (days < 60) return `${Math.floor(days / 7)}w ago`;
  if (days < 730) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export function FeaturedRepoCarousel({ repos, projects }: Props) {
  const featuredNames = new Set(
    projects
      .filter((p) => p.featured)
      .map((p) => p.name.toLowerCase()),
  );
  const cards = repos.filter((r) => featuredNames.has(r.name.toLowerCase()));
  if (!cards.length) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {cards.map((r) => (
        <a
          key={r.name}
          href={r.url}
          className="block border border-neutral-200 dark:border-neutral-800 rounded p-4 hover:bg-neutral-50 dark:hover:bg-neutral-900"
        >
          <div className="flex items-baseline justify-between mb-1">
            <h5 className="font-mono font-medium">{r.name}</h5>
            <span className="text-xs text-neutral-500">{relativeDate(r.lastPushedAt)}</span>
          </div>
          {r.description && (
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2 line-clamp-2">{r.description}</p>
          )}
          <div className="flex gap-4 text-xs text-neutral-500 font-mono">
            <span>★ {r.stars}</span>
            <span>⑂ {r.forks}</span>
            {r.primaryLanguage && <span>{r.primaryLanguage}</span>}
          </div>
        </a>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/activity/FeaturedRepoCarousel.tsx
git commit -m "$(cat <<'EOF'
feat(activity): FeaturedRepoCarousel — featured projects with live repo metadata

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: ActivityDashboard composition

**Files:**
- Create: `src/components/activity/ActivityDashboard.tsx`

- [ ] **Step 1: Write the component**

```tsx
import type { Activity } from '~/lib/activity/schema';
import type { CV } from '~/lib/content/cv-schema';
import { ContributionHeatmap } from './ContributionHeatmap';
import { LanguagesDonut } from './LanguagesDonut';
import { FreshnessTimeline } from './FreshnessTimeline';
import { HtbStatsCard } from './HtbStatsCard';
import { FeaturedRepoCarousel } from './FeaturedRepoCarousel';

interface Props {
  activity: Activity;
  cv: CV;
}

export function ActivityDashboard({ activity, cv }: Props) {
  const empty =
    activity.contributions.days.length === 0 &&
    activity.languages.length === 0 &&
    activity.repos.length === 0;

  if (empty) {
    return (
      <p className="text-sm text-neutral-500 italic">
        Activity dashboard pending first nightly refresh.
      </p>
    );
  }

  const generatedAgo = new Date(activity.generatedAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="space-y-8">
      <header className="flex items-baseline justify-between">
        <h2 className="text-sm uppercase tracking-wider text-neutral-500">Recent activity</h2>
        <span className="text-xs text-neutral-500 font-mono">refreshed {generatedAgo}</span>
      </header>

      <section>
        <h3 className="text-xs uppercase tracking-wider text-neutral-500 mb-3">
          GitHub contributions · last year ({activity.contributions.totalLastYear})
        </h3>
        <ContributionHeatmap days={activity.contributions.days} />
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h3 className="text-xs uppercase tracking-wider text-neutral-500 mb-3">Top languages</h3>
          <LanguagesDonut languages={activity.languages} />
        </div>
        <HtbStatsCard htb={activity.htb} />
      </section>

      {activity.freshness.length > 0 && (
        <section>
          <h3 className="text-xs uppercase tracking-wider text-neutral-500 mb-3">Tech freshness</h3>
          <FreshnessTimeline freshness={activity.freshness} />
        </section>
      )}

      <section>
        <h3 className="text-xs uppercase tracking-wider text-neutral-500 mb-3">Featured projects</h3>
        <FeaturedRepoCarousel repos={activity.repos} projects={cv.projects} />
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/activity/ActivityDashboard.tsx
git commit -m "$(cat <<'EOF'
feat(activity): ActivityDashboard composition

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: Wire into the homepage

**Files:**
- Modify: `src/pages/index.astro`

- [ ] **Step 1: Update `src/pages/index.astro` to load activity + render dashboard**

Add imports to the frontmatter:

```astro
import { ActivityDashboard } from '~/components/activity/ActivityDashboard';
import { loadActivity } from '~/lib/activity/loader';
```

After `const cv = await loadCV(...)`:

```astro
const activity = await loadActivity(resolve(process.cwd(), 'data/activity.json'));
```

In the body, insert a section between the "Recent" work block and the link buttons:

```astro
  <section class="py-8 border-t border-neutral-200 dark:border-neutral-800">
    <ActivityDashboard activity={activity} cv={cv} client:visible />
  </section>
```

- [ ] **Step 2: Verify build**

```bash
PATH="$HOME/.bun/bin:$PATH" bun run lint
PATH="$HOME/.bun/bin:$PATH" bun run build
```

Expected: clean build. The empty-stub `data/activity.json` will render the "pending first nightly refresh" message until the cron runs.

- [ ] **Step 3: Commit**

```bash
git add src/pages/index.astro
git commit -m "$(cat <<'EOF'
feat(activity): wire ActivityDashboard into homepage

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 15: E2E test

**Files:**
- Create: `tests/e2e/activity-dashboard.spec.ts`

- [ ] **Step 1: Write the test**

```ts
import { test, expect } from '@playwright/test';

test.describe('Activity dashboard on /', () => {
  test('renders the empty-stub state until the first refresh', async ({ page }) => {
    await page.goto('/');
    // The dashboard island is below "Recent"; scroll to it.
    await expect(page.getByText(/Activity dashboard pending|Recent activity/i)).toBeVisible({
      timeout: 8000,
    });
  });
});
```

- [ ] **Step 2: Run**

```bash
PATH="$HOME/.bun/bin:$PATH" bun run build
PATH="$HOME/.bun/bin:$PATH" bun run test:e2e tests/e2e/activity-dashboard.spec.ts
```

Expected: 1 passed.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/activity-dashboard.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): activity dashboard renders on homepage

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 16: Manual setup — PATs + secrets

**Files:** none (user-side operational task)

This task is for the user. Implementer should not attempt to do these from a subagent.

- [ ] **Step 1: Create a fine-grained PAT for GitHub**

At `https://github.com/settings/personal-access-tokens/new`:
- Resource owner: CAM-eEng (your account)
- Repository access: Public repositories (read-only) — or just `CAM-eEng/CV` if you prefer narrower scope
- Permissions:
  - Account permissions → none
  - Repository permissions: Contents = Read-only, Metadata = Read-only (auto)
- Expiration: 90 days
- Note: `cv-refresh-activity-2026Q2`
- Generate and copy the token (starts with `github_pat_…`).

- [ ] **Step 2: Find your HackTheBox API token**

If you have an HTB account: profile → API → Generate App Token. Copy the JWT. Also note your numeric user ID (visible in the URL of your HTB profile page).

If you don't use HackTheBox, skip this — the workflow will set `htb: null` and the HTB card won't render.

- [ ] **Step 3: Add the secrets to the GitHub repo**

```bash
gh secret set GH_API_TOKEN --body 'github_pat_…'
gh secret set HTB_API_TOKEN --body 'eyJ…'    # only if HTB
gh secret set HTB_USER_ID --body 'NNNNN'      # only if HTB
```

Verify:

```bash
gh secret list
```

Should show all three (or just `GH_API_TOKEN` if you skipped HTB).

- [ ] **Step 4: Add a calendar reminder for PAT rotation**

Per `READ-BEFORE-BURNING.md`: PAT expiry is 90 days; rotate at day 80 to avoid breakage. Add a calendar event with the next rotation date.

- [ ] **Step 5: Trigger the first refresh manually**

```bash
gh workflow run refresh-activity.yml
gh run watch
```

If it succeeds, a commit lands on `main` from `github-actions[bot]` with the updated `data/activity.json`, the deploy workflow fires automatically, and the homepage at `https://cameronhartman.dev/` shows the live dashboard within ~3 minutes.

---

## Task 17: Final integration + tag

**Files:** none

- [ ] **Step 1: Full local suite green**

```bash
PATH="$HOME/.bun/bin:$PATH" bun run lint
PATH="$HOME/.bun/bin:$PATH" bun run build
PATH="$HOME/.bun/bin:$PATH" bun run test
PATH="$HOME/.bun/bin:$PATH" bun run test:e2e
```

All four must exit 0. Unit/integration tests should be ≥ 85 (75 from prior plans + ~10 new); E2E should be 11 (10 prior + 1 new dashboard).

- [ ] **Step 2: Open PR**

```bash
gh pr create --title "Plan 3: activity visualizer (GitHub + HTB nightly refresh)" --body "$(cat <<'EOF'
## Summary
- Build-time activity dashboard on the homepage: contribution heatmap, top-languages donut, tech-freshness timeline, HTB stats card, featured-repo carousel
- Nightly GitHub Actions cron at 06:00 UTC fetches GitHub + HTB, writes data/activity.json, commits, redeploys
- Workflow secrets isolated from CI; never triggered by pull_request
- No runtime API calls, no AI inference, no T&C gate — pure build-time data
- Hand-rolled React + SVG components; no chart library

## Test plan
- [ ] CI green
- [ ] After merge + secrets configured, manually trigger refresh-activity.yml
- [ ] data/activity.json updates with real data, deploy fires
- [ ] cameronhartman.dev/ shows the dashboard

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Tag after merge**

```bash
git checkout main
git pull --ff-only origin main
git tag -a v3.0-activity-visualizer -m "Plan 3 (activity visualizer) shipped"
git push origin v3.0-activity-visualizer
```

---

## Self-review (plan author's checklist)

- ✅ **Spec §7.5 (activity visualizer):**
  - Nightly cron → Task 7
  - GitHub + HTB API fetchers → Tasks 3, 4
  - data/activity.json committed for fallback → Tasks 2, 6
  - Renders client-side as React → Tasks 8-13
  - Contribution heatmap → Task 8 ✓
  - Top-languages donut → Task 9 ✓
  - Tech-freshness timeline → Tasks 5, 10 ✓
  - HTB rank/points/categories → Tasks 4, 11 ✓
  - Featured-repo carousel filtered by `featured: true` in cv.yaml → Task 12 ✓
- ✅ **Spec §8.1 (build pipeline / secret hygiene):**
  - `refresh-activity.yml` triggers only on `schedule` + `workflow_dispatch` (Task 7) ✓
  - Action SHAs pinned (Task 7) ✓
  - PAT scope, expiry, rotation cadence (Task 16) ✓
- ✅ **Out-of-scope explicitly preserved:**
  - No runtime API calls from visitor browsers ✓
  - No AI / T&C interaction (Plan 2 keeps that scope) ✓
- ✅ **Type consistency:** `Activity` and its sub-types defined once in Task 1, used identically in Tasks 2/3/5/6/8/9/10/11/12/13. `FreshnessEntry` defined in Task 1 schema, returned by Task 5's `mergeFreshness`, consumed by Task 10. `RepoMinimal` in Task 5 is a structural subset of the schema's `Repo`.
- ✅ **No placeholders** in any step.

Open polish carried forward — handle as separate PR(s):
- Centralize `https://cameronhartman.dev` in `src/pages/llms.txt.ts` (Plan 1 review note)
- Add `is:inline` to `src/components/JsonLd.astro` (Plan 1 review note)
- README pointer to where content lives (`content/cv.yaml`, etc.)
- Optional `src/pages/404.astro` for branded 404s
