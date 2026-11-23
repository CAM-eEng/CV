import { z } from 'zod';

// Every field here ends up rendered on the public site, and most of it comes
// from third-party APIs (GitHub, HackTheBox). Bound every string and
// collection so a compromised or misbehaving upstream can't bloat the page or
// smuggle in unexpected shapes. Limits leave generous headroom over real data.
// Unknown keys are stripped (zod's default object behaviour).

const DateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const YearOrYearMonth = z.string().regex(/^\d{4}(-\d{2})?$/);

// https://github.com/<owner>/<repo> only — no other scheme, host, userinfo,
// port, query or fragment. GitHub owner/repo names are [A-Za-z0-9._-].
const GithubRepoUrl = z
  .string()
  .max(200)
  .regex(/^https:\/\/github\.com\/[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/, {
    message: 'Must be an https://github.com/<owner>/<repo> URL',
  });

const ContributionDay = z.object({
  date: DateString,
  count: z.number().int().min(0).max(100_000),
});

const Language = z.object({
  name: z.string().min(1).max(50),
  bytes: z.number().int().min(0),
});

const Repo = z.object({
  name: z.string().min(1).max(100), // GitHub's own repo-name limit
  description: z.string().max(350).nullable(), // GitHub's own description limit
  url: GithubRepoUrl,
  stars: z.number().int().min(0),
  forks: z.number().int().min(0),
  lastPushedAt: z.iso.datetime(),
  primaryLanguage: z.string().max(50).nullable(),
});

const MAX_HTB_CATEGORIES = 50;

export const HtbStatsSchema = z.object({
  rank: z.string().max(50),
  points: z.number().int().min(0),
  ownedMachines: z.number().int().min(0),
  // z.record has no .max(); bound the key count with a refinement.
  categories: z
    .record(z.string().min(1).max(40), z.number().int().min(0))
    .refine((r) => Object.keys(r).length <= MAX_HTB_CATEGORIES, {
      message: `At most ${MAX_HTB_CATEGORIES} HTB categories`,
    }),
});

const FreshnessEntry = z.object({
  name: z.string().min(1).max(80),
  category: z.string().min(1).max(50),
  lastUsed: YearOrYearMonth,
  source: z.enum(['skills.yaml', 'github']),
});

export const ActivitySchema = z.object({
  generatedAt: z.iso.datetime(),
  contributions: z.object({
    days: z.array(ContributionDay).max(400), // ~53 weeks
    totalLastYear: z.number().int().min(0),
  }),
  languages: z.array(Language).max(100),
  repos: z.array(Repo).max(100), // fetchRepos asks for per_page=100
  htb: HtbStatsSchema.nullable(),
  freshness: z.array(FreshnessEntry).max(200),
});

export type Activity = z.infer<typeof ActivitySchema>;
