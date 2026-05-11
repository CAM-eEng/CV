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
